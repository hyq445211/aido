'use strict';

const { ValidationError } = require('./validate');

/** 404 */
function notFound(req, res) {
  res.status(404).json({ error: '接口不存在' });
}

/** 统一错误处理（必须保留 4 个参数，Express 据此识别错误中间件） */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, details: err.details });
  }

  // 唯一约束冲突（用户名/邮箱已注册）
  if (err.code === '23505') {
    const key = err.constraint || '';
    const field = key.includes('email') ? 'email' : 'username';
    return res.status(409).json({
      error: '注册信息冲突',
      details: [{ field, message: field === 'email' ? '该邮箱已被注册' : '该用户名已被使用' }],
    });
  }

  console.error('[error]', err);
  return res.status(500).json({ error: '服务器内部错误，请稍后重试' });
}

/** 把异步路由中抛出的异常统一转交错误中间件 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
