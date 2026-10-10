'use strict';

/**
 * 轻量输入校验工具（零依赖）。
 * 所有面向用户的字符串输入统一做：类型检查 + 去首尾空格 + 长度限制，
 * 防止超长内容、空白内容与意外类型进入服务层 / SQL。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5-]{3,30}$/;

class ValidationError extends Error {
  constructor(details) {
    super('输入校验失败');
    this.status = 400;
    this.details = details;
  }
}

function pickString(body, field) {
  const v = body == null ? undefined : body[field];
  return typeof v === 'string' ? v.trim() : '';
}

function validateRegister(body) {
  const username = pickString(body, 'username');
  const email = pickString(body, 'email').toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  const errors = [];

  if (!USERNAME_RE.test(username)) {
    errors.push({ field: 'username', message: '用户名需为 3-30 位，支持中英文、数字、下划线与连字符' });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    errors.push({ field: 'email', message: '邮箱格式不正确' });
  }
  if (password.length < 8 || password.length > 128) {
    errors.push({ field: 'password', message: '密码长度需为 8-128 位' });
  }
  if (errors.length) throw new ValidationError(errors);
  return { username, email, password };
}

function validateLogin(body) {
  const email = pickString(body, 'email').toLowerCase();
  const password = typeof body?.password === 'string' ? body.password : '';
  const errors = [];

  if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: '邮箱格式不正确' });
  if (!password) errors.push({ field: 'password', message: '请输入密码' });
  if (errors.length) throw new ValidationError(errors);
  return { email, password };
}

function validateConversation(body) {
  const title = pickString(body, 'title') || '新对话';
  if (title.length > 100) {
    throw new ValidationError([{ field: 'title', message: '会话标题不能超过 100 字' }]);
  }
  return { title };
}

function validateMessage(body) {
  const content = pickString(body, 'content');
  if (!content) {
    throw new ValidationError([{ field: 'content', message: '消息内容不能为空' }]);
  }
  if (content.length > 8000) {
    throw new ValidationError([{ field: 'content', message: '单条消息不能超过 8000 字' }]);
  }
  return { content };
}

function validateSearch(query) {
  const q = pickString(query, 'q');
  if (!q) {
    throw new ValidationError([{ field: 'q', message: '搜索关键词不能为空' }]);
  }
  if (q.length > 100) {
    throw new ValidationError([{ field: 'q', message: '搜索关键词不能超过 100 字' }]);
  }
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize, 10) || 20));
  return { q, page, pageSize };
}

module.exports = {
  ValidationError,
  validateRegister,
  validateLogin,
  validateConversation,
  validateMessage,
  validateSearch,
};
