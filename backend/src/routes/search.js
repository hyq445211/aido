'use strict';

const express = require('express');
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { validateSearch } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();
router.use(authenticate);

/**
 * 问题查询：在当前用户的历史提问（role=user）中全文检索。
 * GET /api/search?q=关键词&page=1&pageSize=20
 * 返回命中片段（前后各取约 60 字）及所属会话，前端点击可跳转定位。
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = validateSearch(req.query);

    // ILIKE 走 pg_trgm GIN 索引；% 作为转义符防止用户输入通配符
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const offset = (page - 1) * pageSize;

    const { rows } = await pool.query(
      `SELECT m.id,
              m.conversation_id,
              c.title AS conversation_title,
              m.content,
              m.created_at,
              GREATEST(POSITION(LOWER($1) IN LOWER(m.content)) - 1, 0) AS match_pos,
              COUNT(*) OVER () AS total_count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE c.user_id = $3
          AND m.role = 'user'
          AND m.content ILIKE $2 ESCAPE '\\'
        ORDER BY m.created_at DESC
        LIMIT $4 OFFSET $5`,
      [q, like, req.user.id, pageSize, offset]
    );

    const total = rows.length ? parseInt(rows[0].total_count, 10) : 0;
    const results = rows.map((r) => {
      const pos = parseInt(r.match_pos, 10);
      const start = Math.max(0, pos - 30);
      const end = Math.min(r.content.length, pos + q.length + 60);
      const snippet =
        (start > 0 ? '…' : '') +
        r.content.slice(start, end) +
        (end < r.content.length ? '…' : '');
      return {
        id: r.id,
        conversationId: r.conversation_id,
        conversationTitle: r.conversation_title,
        content: r.content,
        snippet,
        createdAt: r.created_at,
      };
    });

    res.json({ query: q, page, pageSize, total, results });
  })
);

module.exports = router;
