'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT 认证中间件。
 * 要求请求头： Authorization: Bearer <token>
 * 验证通过后将 { id, username } 挂载到 req.user。
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: '未提供认证令牌，请先登录' });
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期或令牌无效，请重新登录' });
  }
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

module.exports = { authenticate, signToken };
