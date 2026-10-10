'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/pool');
const { authenticate, signToken } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/error');

const router = express.Router();

/** 注册：校验 -> 密码哈希 -> 入库 -> 直接签发令牌 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { username, email, password } = validateRegister(req.body);
    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );
    const user = rows[0];
    const token = signToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  })
);

/** 登录：查用户 -> 比对密码 -> 签发令牌（错误信息不区分账号/密码，防止枚举） */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = validateLogin(req.body);

    const { rows } = await pool.query(
      'SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!ok) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  })
);

/** 获取当前登录用户 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(401).json({ error: '用户不存在' });
    res.json({ user: rows[0] });
  })
);

module.exports = router;
