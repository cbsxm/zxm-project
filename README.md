# English Study

一个面向英国留学准备的英语学习网站，包含每日任务、词库导入、间隔复习、听力记录、英文输出和进度统计。

## 本地自用

```bash
node server.mjs
```

打开 `http://127.0.0.1:5178/`。

学习数据保存在本地 SQLite：`data/english-study.sqlite`。

## 展示给别人看

展示模式会使用独立演示数据，不会读取或修改你的个人学习记录。

PowerShell:

```powershell
$env:PUBLIC_DEMO="1"
$env:HOST="0.0.0.0"
node server.mjs
```

部署平台可配置：

```txt
PUBLIC_DEMO=1
HOST=0.0.0.0
PORT=平台分配的端口
```

启动命令：

```bash
npm start
```

需要 Node.js 24 或更新版本。
