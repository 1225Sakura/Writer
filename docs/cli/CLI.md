# Writer CLI - Command Line Interface

Auto Novel Writer CLI tool for managing writing projects from the command line.

## Usage

```bash
python src/backend/cli.py <command> [options]
```

## Global Options

- `--version` - Show version
- `-h, --help` - Show help for any command

---

## Commands

### `init` - Initialize Project

Initialize a new Writer project with database and configuration.

```bash
writer init [--path PATH]
```

**Options:**
- `-p, --path PATH` - Project directory path (default: current directory)

**Example:**
```bash
writer init --path /path/to/my novel
```

---

### `dev` - Development Server (Legacy)

Start the development server.

```bash
writer dev [--host HOST] [--port PORT] [--reload]
```

**Options:**
- `-h, --host HOST` - Host to bind to (default: 127.0.0.1)
- `-p, --port PORT` - Port to bind to (default: 8000)
- `-r, --reload` - Enable auto-reload

---

### `serve` - Production Server

Start the API server with full configuration options.

```bash
writer serve [--host HOST] [--port PORT] [--reload] [--workers N] [--env MODE]
```

**Options:**
- `-h, --host HOST` - Host to bind to (default: 0.0.0.0)
- `-p, --port PORT` - Port to bind to (default: 8000)
- `-r, --reload` - Enable auto-reload for development
- `-w, --workers N` - Number of worker processes (default: 1, ignored with --reload)
- `-e, --env MODE` - Environment mode: `development` or `production` (default: development)

**Examples:**
```bash
# Start on default 0.0.0.0:8000
writer serve

# Production mode with custom port
writer serve -h 127.0.0.1 -p 9000 --env production

# Development with auto-reload
writer serve --reload
```

---

### `build` - Build Application

Build the Writer application for distribution.

```bash
writer build
```

---

### `config` - Show Configuration

Display current configuration settings.

```bash
writer config [--json] [--env MODE]
```

**Options:**
- `--json` - Output configuration as JSON
- `-e, --env MODE` - Filter by environment mode

**Examples:**
```bash
# Show human-readable config
writer config

# Show as JSON
writer config --json

# Filter for production
writer config --env production
```

**Output includes:**
- Application name and version
- Database URL and type
- API key status (set/not set)
- CORS origins
- Cache settings

---

### `export` - Export Project Data

Export project data to a file.

```bash
writer export OUTPUT_FILE [--format FORMAT] [--pretty]
```

**Arguments:**
- `OUTPUT_FILE` - Path to output file

**Options:**
- `-f, --format FORMAT` - Export format: `json` or `zip` (default: json)
- `--pretty` - Pretty-print JSON (default: true)

**Example:**
```bash
writer export my_project.json --format json
```

---

### `import` - Import Project Data

Import project data from a file.

```bash
writer import INPUT_FILE [--mode MODE] [--format FORMAT]
```

**Arguments:**
- `INPUT_FILE` - Path to input file

**Options:**
- `-m, --mode MODE` - Import mode: `merge` or `replace` (default: merge)
- `-f, --format FORMAT` - Input format: `json` or `zip` (default: json)

**Example:**
```bash
writer import backup.zip --mode replace --format zip
```

---

## Database Commands

All database commands are under the `db` subcommand.

```bash
writer db <subcommand>
```

### `db init` - Initialize Database

Initialize the database schema.

```bash
writer db init [--path PATH]
```

**Options:**
- `--path PATH` - Database file path (default: data/writer.db)

---

### `db status` - Check Database Status

Check database connection and status.

```bash
writer db status
```

---

### `db migrate` - Generate & Apply Migration

Auto-generate a migration from model changes and optionally apply it.

```bash
writer db migrate MESSAGE [--apply]
```

**Arguments:**
- `MESSAGE` - Migration message describing the change

**Options:**
- `--apply` - Apply the migration after generation (default: true)

**Example:**
```bash
writer db migrate "add user preferences table"
```

---

### `db upgrade` - Apply Migrations

Apply database migrations up to the target revision.

```bash
writer db upgrade [--revision REVISION]
```

**Options:**
- `-r, --revision REVISION` - Target revision (default: head)

**Example:**
```bash
writer db upgrade --revision head
```

---

### `db downgrade` - Rollback Migrations

Rollback database migrations to the target revision.

```bash
writer db downgrade [--revision REVISION]
```

**Options:**
- `-r, --revision REVISION` - Target revision (default: -1)

**Example:**
```bash
writer db downgrade --revision -1
```

---

### `db current` - Show Current Version

Show the current migration version.

```bash
writer db current
```

---

### `db history` - Show Migration History

Show the complete migration history.

```bash
writer db history [--verbose]
```

**Options:**
- `-v, --verbose` - Show verbose output

---

### `db seed` - Seed Test Data

Seed the database with sample test data (characters, chapters, etc.).

```bash
writer db seed [--force]
```

**Options:**
- `--force` - Force re-seed even if data exists

**Example:**
```bash
# Only seed if database is empty
writer db seed

# Re-seed even with existing data
writer db seed --force
```

**Creates sample data:**
- 3 Characters (李青云, 叶轻舞, 魔君厉无痕)
- Character relationships and storylines
- World settings (修仙界, 凡界)
- Locations (青云峰, 魔域)
- Factions (青云宗, 万魔门)
- Rules
- 4 Chapters (with various statuses)
- 1 IF Line (叶轻舞线)
- Items (青云剑, 九转还魂草)
- Writing settings

---

### `db reset` - Reset Database

Reset the database by dropping all tables and re-creating the schema.

```bash
writer db reset --confirm
```

**Options:**
- `--confirm` - Required flag to confirm the operation

**WARNING:** This will DELETE ALL DATA in the database!

**Example:**
```bash
writer db reset --confirm
```

**After reset, you can seed sample data:**
```bash
writer db reset --confirm && writer db seed
```

---

## Environment Variables

The CLI respects the following environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Database connection URL |
| `MINIMAX_API_KEY` | MiniMax API key for AI features |
| `ENVIRONMENT` | Set by `--env` flag (development/production) |

---

## Error Handling

All commands provide actionable error messages:

- **Missing `alembic`**: Suggests `pip install alembic`
- **Database not found**: Suggests running `writer db init` or `writer init`
- **No frontend build**: Suggests running `npm run build` in frontend directory
- **Import/Export failures**: Shows detailed error and suggests fixes

---

## Quick Reference

| Task | Command |
|------|---------|
| Initialize new project | `writer init` |
| Start development server | `writer dev` |
| Start production server | `writer serve --env production` |
| Check database status | `writer db status` |
| Seed test data | `writer db seed` |
| Reset database | `writer db reset --confirm` |
| Generate migration | `writer db migrate "description"` |
| Apply migrations | `writer db upgrade` |
| Show configuration | `writer config` |
| Export project | `writer export backup.json` |
| Import project | `writer import backup.zip` |
