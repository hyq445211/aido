# AIDO · AI 智能聊天网站

一个功能完整、可直接用 Docker 一键部署的 AI 聊天网站。支持用户注册登录、多轮 AI 对话（流式输出）、消息历史记录与历史问题检索，接入任何兼容 OpenAI 协议的大模型（OpenAI / DeepSeek / Moonshot / 本地 vLLM、Ollama 等）。

## 功能一览

- **用户系统**：邮箱注册、登录、JWT 鉴权；bcrypt（cost=12）密码哈希存储
- **AI 对话**：多轮上下文、SSE 流式逐字输出、加载/打字动画、随时"停止生成"、失败重试提示
- **历史记录**：会话自动以首条问题命名、按最近时间排序、重命名（接口）、删除（级联删除消息）
- **问题查询**：在本人全部历史提问中关键词检索，命中片段高亮，点击直达所在会话
- **安全**：Helmet 安全头、接口限流、输入校验（长度/格式/SQL 通配符转义）、参数化 SQL、API Key 仅保存在后端、非 root 容器运行、数据库端口默认仅绑定 127.0.0.1
- **体验**：响应式布局（手机侧栏抽屉）、乐观 UI、空状态引导、错误横幅
- **可扩展**：前后端分离、服务层/路由层分层、pg 连接池、无状态 JWT（可水平扩容后端）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + Vite 5 + React Router 6（纯 CSS，无 UI 框架依赖） |
| 后端 | Node.js 20 + Express 4（pg、bcryptjs、jsonwebtoken、helmet、express-rate-limit） |
| 数据库 | PostgreSQL 16（pg_trgm 模糊检索索引） |
| AI | OpenAI 兼容 Chat Completions API（`stream=true`，SSE 解析） |
| 部署 | Docker + Docker Compose（多阶段构建；nginx 托管前端并反代 API） |

## 架构

```
浏览器 ──HTTP──> nginx:80(前端容器 aido-frontend)
                   ├─ /            -> 静态文件 (React SPA)
                   └─ /api/        -> 反向代理 http://backend:4000 (SSE 关闭缓冲)
                                                  │
                                         Express API 容器 aido-backend
                                                  │ SQL(TCP 5432)
                                                  ▼
                                          PostgreSQL 16 容器 aido-db
                                                  │
                                          命名卷 pgdata（持久化）
```

## 目录结构

```
aido/
├── docker-compose.yml          # 三容器编排 + 健康检查 + 数据卷
├── .env.example                # 环境变量模板（复制为 .env 使用）
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js           # 入口：中间件、路由、优雅退出
│       ├── config.js           # 环境变量读取与 fail-fast 校验
│       ├── db/
│       │   ├── pool.js         # pg 连接池 + 启动重试
│       │   └── init.sql        # 首次启动自动建表/索引/触发器
│       ├── middleware/         # auth / validate / error
│       ├── routes/             # auth、conversations、messages(SSE)、search
│       └── services/ai.js      # OpenAI 兼容流式客户端 + 演示模式
└── frontend/
    ├── Dockerfile              # Node 构建 -> nginx 运行
    ├── nginx.conf              # SPA + /api 反代（SSE 专用配置）
    ├── package.json
    ├── vite.config.js          # 本地 dev 代理 /api -> :4000
    ├── index.html
    └── src/
        ├── api/client.js       # fetch 封装 + SSE 流解析
        ├── context/AuthContext.jsx
        ├── pages/              # Login / Register / Chat
        └── components/         # Sidebar / SearchPanel / MessageList / ChatInput
```

---

## 一、Docker 环境搭建

### 1. 前置要求

- **Docker** ≥ 24.0，且 **Docker Compose v2**（`docker compose` 命令）可用
- 可用内存 ≥ 2 GB；首次构建需要外网访问 npm / Docker Hub
- 端口：前端默认 **8080**、后端调试口 **4000**、数据库调试口 **5432**（均可在 `.env` 调整）

安装方式：

- **Windows / macOS**：安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)，安装后启动并确认右下角图标为 Running，在 PowerShell / 终端执行 `docker compose version` 能看到版本号即可。
- **Linux (Ubuntu/Debian)**：
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # 重新登录后生效
  ```
- 国内网络拉取镜像/安装 npm 包较慢时，可在 Docker Desktop 设置中配置 registry mirror，或为构建配置 HTTP 代理。

### 2. 配置环境变量

在项目根目录（`docker-compose.yml` 所在目录）执行：

```bash
# Linux / macOS
cp .env.example .env

# Windows PowerShell
copy .env.example .env
```

编辑 `.env`，**必须修改**两项：

1. `POSTGRES_PASSWORD` —— 改成强密码（仅容器内网使用，但不要保留示例值）
2. `JWT_SECRET` —— 随机长字符串，生成方式：
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

配置 AI 模型（以 OpenAI 为例）：

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-你的真实密钥
AI_MODEL=gpt-4o-mini
AI_MOCK_MODE=false
```

> `.env` 已被 `.gitignore` 忽略，密钥不会进入版本库。**不要**把真实密钥写进任何其他文件。

### 3. 构建并启动

```bash
# 在项目根目录执行；--build 会按 Dockerfile 构建前后端镜像
docker compose up -d --build
```

首次构建约 3–8 分钟（取决于网络）。完成后查看状态：

```bash
docker compose ps
# 三个容器状态应为 running / healthy：
# aido-db        (healthy)
# aido-backend   (healthy)
# aido-frontend (running)
```

### 4. 初始化与访问

- 数据库表结构由 `backend/src/db/init.sql` 在**数据卷首次创建时**自动初始化，无需手动建库。
- 浏览器打开 <http://localhost:8080> → 点击"立即注册"创建账号 → 开始对话。
- 健康检查：<http://localhost:4000/health> 返回 `{"status":"ok",...}`（4000 端口默认仅绑定 127.0.0.1）。

> **想先体验但暂时没有 AI Key？** 在 `.env` 设置 `AI_MOCK_MODE=true`，执行 `docker compose up -d`（后端重启即可），系统会返回模拟流式回复，完整链路（流式渲染 + 入库 + 历史检索）都可验证。

---

## 二、常用运维命令

均在项目根目录执行：

| 目的 | 命令 |
|---|---|
| 查看全部容器状态 | `docker compose ps` |
| 查看实时日志（全部服务） | `docker compose logs -f` |
| 只看后端日志 | `docker compose logs -f backend` |
| 修改代码后重新构建启动 | `docker compose up -d --build` |
| 重启某个服务 | `docker compose restart backend` |
| 停止（保留数据） | `docker compose down` |
| 停止并**删除数据库数据**（彻底重置） | `docker compose down -v` |
| 进入数据库执行 SQL | `docker compose exec db psql -U aido -d aido` |
| 备份数据库 | `docker compose exec -T db pg_dump -U aido aido > backup.sql` |
| 恢复备份 | `Get-Content backup.sql \| docker compose exec -T db psql -U aido -d aido`（PowerShell）/ `psql ... < backup.sql`（Linux） |
| 清理悬空镜像释放空间 | `docker image prune -f` |

---

## 三、接入不同 AI 模型

后端只依赖 OpenAI 兼容协议，改 `.env` 中三个变量后 `docker compose restart backend` 即可：

| 模型服务 | AI_BASE_URL | AI_MODEL 示例 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Moonshot Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 本机 Ollama（容器内访问宿主机） | `http://host.docker.internal:11434/v1` | `qwen2.5:7b` |
| 本机 vLLM | `http://host.docker.internal:8000/v1` | 你的部署模型名 |

> Linux 上使用 `host.docker.internal` 时，需在 compose 的 backend 服务中添加 `extra_hosts: ["host.docker.internal:host-gateway"]`。
> 内网自签名/无鉴权网关时，`AI_API_KEY` 可随意填非空字符串（代码仅在 mock 关闭时检查非空）。

---

## 四、不使用 Docker 的本地开发方式

需要本机安装 Node.js ≥ 20 与 PostgreSQL ≥ 14。

1. 创建数据库：`createdb aido`，并手动执行 `psql -d aido -f backend/src/db/init.sql`
2. 后端：
   ```bash
   cd backend
   npm install
   # 配置 DATABASE_URL / JWT_SECRET / AI_API_KEY 等环境变量（可写 backend/.env）
   # PowerShell 示例：$env:DATABASE_URL="postgres://aido:密码@localhost:5432/aido"
   npm run dev
   ```
3. 前端（另开终端）：
   ```bash
   cd frontend
   npm install
   npm run dev      # http://localhost:5173 ，/api 已配置代理到 :4000
   ```

---

## 五、API 一览

除注册登录外均需请求头 `Authorization: Bearer <token>`。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | 注册 `{username,email,password}`，返回 token |
| POST | `/api/auth/login` | 登录 `{email,password}`，返回 token |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/conversations` | 会话列表（按最近更新倒序） |
| POST | `/api/conversations` | 创建会话 `{title?}` |
| GET | `/api/conversations/:id` | 会话详情 + 全部消息 |
| PATCH | `/api/conversations/:id` | 重命名 |
| DELETE | `/api/conversations/:id` | 删除（消息级联删除） |
| POST | `/api/conversations/:id/messages` | 发送问题，**SSE 流式**返回回复（事件：meta/delta/done/error） |
| GET | `/api/search?q=关键词&page=1` | 历史问题检索（高亮片段 + 所属会话） |
| GET | `/health` | 健康检查（无需鉴权） |

限流：单 IP 120 次/分钟；请求体上限 100 KB；单条消息 8000 字、搜索词 100 字。

## 六、安全与可扩展性说明

- 密钥只存在于后端 `.env`（不打入镜像、不发送给浏览器）；前端通过同源 nginx 代理访问，无跨域密钥暴露问题。
- 所有 SQL 均为参数化查询；搜索关键词中的 `%`、`_`、`\` 做了转义。
- 鉴权使用 JWT（HS256，有效期默认 7 天），生产环境务必配置高强度 `JWT_SECRET`。
- 后端服务无状态，可在 compose 中通过 `deploy.replicas` 或在 Kubernetes 中水平扩容（数据库连接池需按实例数评估 `max` 与 PG `max_connections`）。
- 需要更强检索时，可将 `messages.content` 的 ILIKE 检索升级为 PostgreSQL `tsvector` 全文检索或外部搜索引擎（OpenSearch 等）。

---

## 七、常见问题排查

**1. `docker compose` 命令不存在**
说明是旧版 Compose v1（`docker-compose`）。请升级 Docker Desktop / Docker Engine 以获得 `docker compose` v2。

**2. 端口被占用（`bind: address already in use`）**
编辑 `.env`：改 `FRONTEND_PORT`（如 8081）、`BACKEND_PORT`、`DB_PORT`，然后 `docker compose up -d`。Windows 排查占用：`netstat -ano | findstr :8080`。

**3. backend 容器反复重启，日志报 "数据库连接失败"**
- `docker compose ps` 看 db 是否 healthy；不健康时 `docker compose logs db` 查看原因（常见于以前用其他密码初始化过旧数据卷）。
- 改过 `POSTGRES_USER/PASSWORD` 但数据卷已存在：PostgreSQL 只在**空数据卷**时应用这些变量。要么改回旧密码，要么执行 `docker compose down -v` 清空数据重建（数据会丢失）。

**4. 修改了 `init.sql` 但没有生效**
初始化脚本只在数据卷首次创建时执行一次。开发环境重置：`docker compose down -v && docker compose up -d --build`。已在运行的库请直接用 `docker compose exec db psql -U aido -d aido` 手动执行变更 SQL。

**5. AI 回复提示"未配置 AI_API_KEY"或 401/403**
- 检查 `.env` 中 `AI_MOCK_MODE`、`AI_API_KEY`、`AI_BASE_URL` 是否正确，改后必须 `docker compose restart backend`。
- `docker compose logs backend` 中可以看到上游返回的真实状态码；401 通常是 Key 错误或欠费，404 多为 `AI_BASE_URL` 路径不对（应保留 `/v1`，且末尾不要带斜杠路径段重复）。

**6. 模型回答不是逐字出现，而是卡顿后一次性出现**
说明流式响应被某一层缓冲。项目中已关闭：后端 SSE 头 `X-Accel-Buffering: no`、nginx `proxy_buffering off`。若你在前面再套一层网关（CDN/Cloudflare/其他反代），也需要在该层关闭缓冲/开启 streaming。

**7. 浏览器控制台报 CORS 错误**
容器部署时前端与 API 同源（都走 8080 端口经 nginx 代理），不应有 CORS 问题。本地 `npm run dev` 开发时由 Vite 代理解决。若前端单独部署到其他域名，把该域名加入后端 `CORS_ORIGIN`（逗号分隔）后重启后端。

**8. 注册提示邮箱/用户名已存在**
唯一约束冲突（HTTP 409），更换用户名或邮箱即可；注册接口与登录接口返回信息不通用，避免账号枚举。

**9. Windows 上 PowerShell 执行策略 / 中文乱码问题**
本项目运行完全在容器内，不依赖宿主机脚本，不会受 PowerShell 执行策略影响。`docker compose` 输出乱码时可执行 `chcp 65001` 切换 UTF-8 代码页。

**10. 构建时 npm install 很慢或超时**
为 Docker 配置国内镜像加速或代理；也可在各自 Dockerfile 中 `npm config set registry https://registry.npmmirror.com`（在 `npm install` 行之前加一行 RUN）。依赖均锁定精确版本，重新构建结果可复现。

**11. 忘记密码**
当前版本无找回邮件流程。开发期可直接在数据库重置（生成 bcrypt 哈希后更新 `users.password_hash`），或新建账号。
