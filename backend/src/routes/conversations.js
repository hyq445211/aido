'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { validateConversation } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();
router.use(authenticate);

/** 当前用户的全部会话（按最近消息时间倒序） */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, title, created_at, updated_at
         FROM conversations
        WHERE user_id = $1
        ORDER BY updated_at DESC
        LIMIT 200`,
      [req.user.id]
    );
    res.json({ conversations: rows });
  })
);

/** 创建会话 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { title } = validateConversation(req.body || {});
    const { rows } = await pool.query(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, title, created_at, updated_at`,
      [req.user.id, title]
    );
    res.status(201).json({ conversation: rows[0] });
  })
);

/** 获取单个会话及其完整消息历史（必须是本人的会话） */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const convId = parseInt(req.params.id, 10);
    if (!Number.isInteger(convId)) return res.status(400).json({ error: '会话 ID 无效' });

    const convResult = await pool.query(
      'SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2',
      [convId, req.user.id]
    );
    if (!convResult.rows[0]) return res.status(404).json({ error: '会话不存在' });

    const msgResult = await pool.query(
      `SELECT id, role, content, created_at
         FROM messages
        WHERE conversation_id = $1
        ORDER BY id ASC
        LIMIT 1000`,
      [convId]
    );

    res.json({
      conversation: convResult.rows[0],
      messages: msgResult.rows,
    });
  })
);

/** 重命名会话 */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const convId = parseInt(req.params.id, 10);
    const { title } = validateConversation(req.body || {});
    const { rows } = await pool.query(
      `UPDATE conversations SET title = $1
        WHERE id = $2 AND user_id = $3
        RETURNING id, title, created_at, updated_at`,
      [title, convId, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: '会话不存在' });
    res.json({ conversation: rows[0] });
  })
);

/** 删除会话（消息通过外键级联删除） */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const convId = parseInt(req.params.id, 10);
    const result = await pool.query(
      'DELETE FROM conversations WHERE id = $1 AND user_id = $2',
      [convId, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: '会话不存在' });
    res.status(204).end();
  })
);

module.exports = router;
