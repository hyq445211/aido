# ========== 后端镜像：多阶段构建，最终镜像不含开发依赖 ==========
FROM node:20-alpine AS deps
WORKDIR /app
# 先拷贝依赖清单，利用 Docker 层缓存
COPY package.json ./
# 本项目锁定精确版本，使用 npm install 即可；如引入 package-lock.json 可改用 npm ci
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000

# 以非 root 用户运行
RUN addgroup -g 1001 -S nodeapp && adduser -S nodeapp -u 1001 -G nodeapp

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

USER nodeapp
EXPOSE 4000

# 容器级健康检查（compose 中也有声明，双保险）
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
