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

### 初始化数据库

```bash
python scripts/init_db.py
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

## 常用命令

| 命令 | 说明 |
|------|------|
| `python scripts/init_db.py` | 初始化数据库 |
| `python scripts/backup.py` | 备份数据库 |
| `python scripts/restore.py` | 恢复数据库 |
