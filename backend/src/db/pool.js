'use strict';

const { Pool } = require('pg');
const config = require('../config');

/**
 * PostgreSQL 连接池（全应用共享单例）。
 */
const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // 容器内数据库短暂重启时允许 pg 自动重连
  allowExitOnIdle: false,
});

pool.on('error', (err) => {
  // 空闲连接出错不能让进程崩溃
  console.error('[pg] 空闲连接发生错误:', err.message);
});

/**
 * 带重试的连通性检查，供服务启动时等待数据库就绪
 * （compose 已配置 healthcheck，这里再加一层保险）。
 */
async function waitForDatabase(retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      console.log('[pg] 数据库连接成功');
      return;
    } catch (err) {
      console.log(`[pg] 等待数据库就绪 (${i}/${retries})：${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('数据库连接失败：已达到最大重试次数');
}

module.exports = { pool, waitForDatabase };
