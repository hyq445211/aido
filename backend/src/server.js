'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { waitForDatabase, pool } = require('./db/pool');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth');
const conversationRoutes = require('./routes/conversations');
const messageRoutes = require('./routes/messages');
const searchRoutes = require('./routes/search');

function createApp() {
  const app = express();

  app.set('trust proxy', 1); // 容器位于 nginx 之后，获取真实 IP 以正确限流
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: false }));
  app.use(express.json({ limit: '100kb' }));

  // 全局限流：单 IP 每分钟最多 120 次请求
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: '请求过于频繁，请稍后再试' },
    })
  );

  // 健康检查（compose healthcheck / 负载均衡探测用）
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'up', ai: config.ai.mockMode ? 'mock' : 'live' });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/conversations', messageRoutes); // /:id/messages
  app.use('/api/search', searchRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

async function main() {
  await waitForDatabase();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[server] AIDO 后端运行于 http://0.0.0.0:${config.port}（${config.env}）`);
    console.log(
      `[server] AI 模式：${config.ai.mockMode ? '演示模式(mock)' : `真实模型(${config.ai.model} @ ${config.ai.baseUrl})`}`
    );
  });

  // 优雅退出
  const shutdown = (signal) => {
    console.log(`[server] 收到 ${signal}，开始关闭…`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
    // 10 秒后强制退出
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[server] 启动失败:', err.message);
  process.exit(1);
});
