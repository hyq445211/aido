'use strict';

/**
 * 集中读取并校验环境变量。
 * 关键配置缺失时直接 fail-fast，避免服务以错误配置静默运行。
 */
require('dotenv').config();

function required(name, value) {
  if (!value || !value.trim()) {
    throw new Error(`缺少必需的环境变量 ${name}，请参考 .env.example 配置 .env 文件`);
  }
  return value.trim();
}

const isProd = process.env.NODE_ENV === 'production';

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),

  // 数据库：优先使用 DATABASE_URL（docker-compose 注入），否则用分立参数拼装
  databaseUrl:
    process.env.DATABASE_URL ||
    (process.env.POSTGRES_USER
      ? `postgres://${process.env.POSTGRES_USER}:${encodeURIComponent(
          process.env.POSTGRES_PASSWORD || ''
        )}@${process.env.POSTGRES_HOST || 'localhost'}:${
          process.env.POSTGRES_PORT || '5432'
        }/${process.env.POSTGRES_DB || 'aido'}`
      : null),

  jwt: {
    // 开发环境给出临时密钥并告警；生产环境必须显式配置
    secret:
      process.env.JWT_SECRET ||
      (isProd
        ? null
        : 'dev-only-insecure-secret-do-not-use-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  ai: {
    baseUrl: (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    mockMode: process.env.AI_MOCK_MODE === 'true',
  },
};

// fail-fast 校验
if (!config.databaseUrl) {
  throw new Error('数据库未配置：请设置 DATABASE_URL 或 POSTGRES_* 系列环境变量');
}
if (isProd) {
  required('JWT_SECRET', config.jwt.secret || '');
}
if (!config.ai.mockMode && !config.ai.apiKey && !isProd) {
  // 开发环境仅打印提醒；真正调用时 service 层会返回明确错误
  console.warn('[config] 未设置 AI_API_KEY 且未开启 AI_MOCK_MODE，对话功能将返回配置提示错误');
}

module.exports = config;
