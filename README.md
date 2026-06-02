# English Study

一个面向英国留学准备的英语学习网站，包含每日任务、词库导入、间隔复习、听力记录、英文输出和进度统计。

现在已经支持注册 / 登录。每个账号拥有独立的单词、听力、日记、任务和进度数据。
登录和注册使用独立页面：`/auth.html`。成功后会进入 `/auth-success.html`，再跳转到学习主页。
进度页会根据复习历史生成每日学习计划，并自动整理“模糊 / 不认识”的易忘词。
英文输出保存后会生成本地基础反馈，包含分数、优点、修改建议和轻量修正版。
单词页支持按目标生成词库，例如英国租房、课堂发言和雅思写作。
跟读练习支持浏览器语音识别和本地相似度评分，保存后会计入进度统计。

## 本地自用

```bash
node server.mjs
```

打开 `http://127.0.0.1:5178/`。

学习数据保存在本地 SQLite：`data/english-study.sqlite`。

## 公开演示

如果只是给别人体验，可以开启演示模式。演示模式会使用独立数据库目录，并在服务启动或点击重置时恢复默认演示数据。

PowerShell：

```powershell
$env:PUBLIC_DEMO="1"
$env:HOST="0.0.0.0"
node server.mjs
```

演示模式不会开放真实注册 / 登录，也不会读取本地个人学习数据。

## 部署到线上

部署平台可配置：

```txt
HOST=0.0.0.0
PORT=平台分配的端口
DATA_DIR=持久化数据目录
BACKUP_DIR=备份输出目录
PUBLIC_DEMO=0
COOKIE_SECURE=1
AUTH_RATE_LIMIT_PER_MINUTE=20
```

启动命令：

```bash
npm start
```

需要 Node.js 24 或更新版本。

健康检查：

```bash
curl http://127.0.0.1:5178/api/health
```

环境变量模板见 `.env.example`。

## 数据和安全

- 生产环境一定要把 `DATA_DIR` 指向平台的持久化磁盘，否则重启或重新部署可能丢数据。
- SQLite 文件是核心数据：`english-study.sqlite`。可以用 `npm run backup` 生成一致性 SQLite 备份。
- 用户登录使用 HttpOnly Cookie 会话，密码使用 scrypt 哈希保存。
- 上线 HTTPS 后建议设置 `COOKIE_SECURE=1`，登录 / 注册默认每分钟最多 20 次请求。
- `/api/export` 可以导出当前登录用户自己的学习数据、复习历史和学习洞察，适合做手动备份。
- 当前写作反馈不依赖外部 AI 服务；如果之后接入 OpenAI API，再配置 `OPENAI_API_KEY`。
- 当前跟读评分使用浏览器语音识别和本地文本相似度，不会上传录音。
- 目标词库当前使用本地精选词表生成，不依赖外部服务。
- 不要把 `data/`、`demo-data/`、`backups/` 或 `.env` 提交到 Git。
