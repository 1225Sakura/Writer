# 开发者指南

## 环境要求

- Python 3.11+
- Node.js 18+
- SQLite 3

## 后端开发

### 安装依赖

```bash
cd src/backend
pip install -r requirements.txt
```

### 启动后端服务

```bash
cd src/backend
uvicorn main:app --reload --port 8000
```

## 前端开发

### 安装依赖

```bash
cd src/frontend
npm install
```

### 启动开发服务器

```bash
npm run dev
```

## CLI 命令速查

| 命令 | 说明 |
|------|------|
| `python cli.py serve` | 启动 API 服务器 |
| `python cli.py serve --reload` | 开发模式（自动重载） |
| `python cli.py serve --env production` | 生产模式 |
| `python cli.py db init` | 初始化数据库 |
| `python cli.py db status` | 检查数据库状态 |
| `python cli.py db migrate "描述"` | 生成并应用迁移 |
| `python cli.py db upgrade` | 应用所有待执行迁移 |
| `python cli.py db downgrade -1` | 回滚到上一个版本 |
| `python cli.py db current` | 查看当前迁移版本 |
| `python cli.py db history` | 查看迁移历史 |
| `python cli.py db seed` | 填充测试数据 |
| `python cli.py db reset --confirm` | 重置数据库（危险！） |
| `python cli.py config` | 显示配置 |
| `python cli.py config --json` | 配置输出为 JSON |
| `python cli.py export backup.json` | 导出项目数据 |
| `python cli.py import backup.zip --mode replace` | 导入项目数据 |

详细 CLI 文档请参考 [cli/CLI.md](./cli/CLI.md)

## 项目目录结构

```
writer/
├── docs/              # 项目文档
├── config/            # 配置文件
│   ├── backend/       # 后端配置
│   └── electron/      # Electron 构建配置
├── scripts/           # 工具脚本
├── public/            # 静态资源
└── src/
    ├── backend/       # FastAPI 后端
    └── frontend/      # React 前端
```

## 调试技巧

### 后端调试

```bash
# 启用详细日志
LOG_LEVEL=DEBUG python cli.py serve --reload

# 查看数据库内容
sqlite3 data/writer.db ".tables"
sqlite3 data/writer.db "SELECT * FROM characters LIMIT 5;"

# 检查 API 健康状态
curl http://localhost:8000/health
```

### 前端调试

```bash
# TypeScript 类型检查
cd src/frontend && npx tsc --noEmit

# 构建检查
npm run build
```

### 数据库调试

```bash
# 查看当前迁移状态
python cli.py db current

# 查看迁移历史
python cli.py db history --verbose

# 手动使用 Alembic
cd src/backend
.venv/Scripts/python -m alembic current
.venv/Scripts/python -m alembic upgrade head
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `python cli.py db init` | 初始化数据库 |
| `python cli.py db seed` | 填充测试数据 |
| `npm run build` | 前端生产构建 |
