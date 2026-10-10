# ========== 前端镜像：Node 构建静态资源 -> nginx 托管 ==========

# ---- 构建阶段 ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
# API 地址默认走同源相对路径 /api（由 nginx 反代到后端）；
# 如需指向外部 API，可在构建时传入：--build-arg VITE_API_BASE_URL=https://api.example.com/api
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- 运行阶段 ----
FROM nginx:1.27-alpine AS runtime
# 删除默认配置，使用项目自带 nginx 配置（含 SPA fallback 与 /api 反代）
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/aido.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
