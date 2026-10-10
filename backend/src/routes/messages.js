'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { validateMessage } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');
const { streamChatCompletion, AiConfigError } = require('../services/ai');

const router = express.Router();
router.use(authenticate);

/**
 * 发送消息并以 SSE 流式接收 AI 回复。
 * POST /api/conversations/:id/messages  { content: "..." }
 *
 * 事件协议（text/event-stream）：
 *   event: meta   data: {"userMessageId":123}
 *   event: delta  data: {"content":"你"}
 *   event: done   data: {"assistantMessageId":124}
 *   event: error  data: {"error":"..."}
 */
router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    const convId = parseInt(req.params.id, 10);
    if (!Number.isInteger(convId)) return res.status(400).json({ error: '会话 ID 无效' });
    const { content } = validateMessage(req.body);

    // 1) 校验会话归属
    const convResult = await pool.query(
      'SELECT id, title FROM conversations WHERE id = $1 AND user_id = $2',
      [convId, req.user.id]
    );
    const conversation = convResult.rows[0];
    if (!conversation) return res.status(404).json({ error: '会话不存在' });

    // 2) 建立 SSE 响应头
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // 关闭 nginx 缓冲，保证流式实时性
    });
    res.flushHeaders?.();

    const send = (event, data) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // 客户端主动断开时中止对上游模型的请求
    const ac = new AbortController();
    req.on('close', () => ac.abort());

    const client = await pool.connect();
    try {
      // 3) 持久化用户消息（同一会话的历史先读出，供模型保持上下文）
      const inserted = await client.query(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id, created_at',
        [convId, 'user', content]
      );
      const userMessageId = inserted.rows[0].id;

      // 首条消息时，用问题前 30 字自动命名会话
      const countResult = await client.query(
        'SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1',
        [convId]
      );
      if (countResult.rows[0].n === 1) {
        const autoTitle = content.length > 30 ? `${content.slice(0, 30)}…` : content;
        await client.query(
          "UPDATE conversations SET title = $1 WHERE id = $2 AND title = '新对话'",
          [autoTitle, convId]
        );
      }

      const historyResult = await client.query(
        'SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY id ASC LIMIT 40',
        [convId]
      );

      send('meta', { userMessageId });

      // 4) 流式调用模型并累积完整回复
      let fullReply = '';
      for await (const delta of streamChatCompletion(historyResult.rows, ac.signal)) {
        fullReply += delta;
        send('delta', { content: delta });
      }

      // 5) 空回复兜底
      if (!fullReply.trim()) {
        fullReply = '（模型未返回内容，请换一种问法再试一次）';
        send('delta', { content: fullReply });
      }

      // 6) 持久化 AI 回复并结束流
      const aiInserted = await client.query(
        'INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id',
        [convId, 'assistant', fullReply]
      );
      send('done', { assistantMessageId: aiInserted.rows[0].id });
    } catch (err) {
      if (err.name === 'AbortError') {
        // 客户端主动停止：流直接结束，不报错
      } else if (err instanceof AiConfigError) {
        send('error', { error: err.message });
      } else {
        console.error('[messages]', err);
        send('error', { error: 'AI 服务调用失败，请稍后重试' });
      }
    } finally {
      client.release();
      res.end();
    }
  })
);

module.exports = router;
