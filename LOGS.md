# Logging System Documentation

## Overview

The Writer API uses a structured logging system with rotation support for production observability.

## Log Directory

```
D:\writer\logs\
```

## Log Files

| File | Description | Level |
|------|-------------|-------|
| `writer-api.log` | Main application log (midnight rotation + size backup) | DEBUG+ |
| `error.log` | Error-only log (5xx responses, exceptions) | ERROR+ |
| `access.log` | Request/response access log | INFO+ |

## Log Format

### JSON Format (Production)

```json
{
  "timestamp": "2026-04-21T10:30:00.000000+00:00",
  "level": "INFO",
  "logger": "writer-api.middleware",
  "message": "Request completed: GET /api/chapters 200 45.23ms",
  "module": "logging",
  "function": "dispatch",
  "line": 145,
  "thread": 12345,
  "context": {
    "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "correlation_id": null
  },
  "extra": {
    "event": "request_complete",
    "method": "GET",
    "path": "/api/chapters",
    "status_code": 200,
    "duration_ms": 45.23,
    "operation_type": "content_management"
  }
}
```

### Human-Readable Format (Development)

```
2026-04-21 10:30:00 | INFO     | writer-api.middleware [req=a1b2c3d4] | Request completed: GET /api/chapters 200 45.23ms
```

## Structured Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO8601 | UTC timestamp of log event |
| `level` | string | Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| `logger` | string | Logger name (typically module path) |
| `message` | string | Human-readable log message |
| `context` | object | Request context (request_id, correlation_id, user_id) |
| `extra.event` | string | Event type (request_start, request_complete, slow_request, request_error) |
| `extra.method` | string | HTTP method |
| `extra.path` | string | Request path |
| `extra.status_code` | int | HTTP response status code |
| `extra.duration_ms` | float | Request duration in milliseconds |
| `extra.operation_type` | string | Inferred operation category |
| `extra.request_id` | string | Unique request identifier |
| `extra.correlation_id` | string | Correlation ID for request tracing |

## Operation Types

Requests are categorized by path:

| Operation Type | Path Pattern | Description |
|----------------|--------------|-------------|
| `chat` | `/chat/`, `/conversation` | Chat/initialization operations |
| `ai_generation` | `/ai/` | AI content generation |
| `configuration` | `/settings`, `/config` | Settings management |
| `content_management` | `/chapters`, `/outline` | Story content operations |
| `authentication` | `/auth` | Auth-related operations |
| `data_sync` | `/export`, `/import` | Data import/export |
| `general` | * | Default category |

## Rotation Strategy

### Daily Rotation

- New log file created at midnight local time
- `when='midnight', interval=1` in `TimedRotatingFileHandler`
- Configurable backup count (default: 7 days)

### Size-Based Backup

- Maximum file size: 10MB per log file
- Backup count: 7 files per log type
- When max size reached, rotates to numbered backup file

### Slow Request Detection

Requests exceeding the threshold (default: 1000ms) trigger a `slow_request` event:

```
WARNING | Slow request detected: GET /api/ai/generate took 2345.67ms (threshold: 1000ms)
```

Fields:
- `duration_ms`: Actual duration
- `threshold_ms`: Configured threshold
- `slow_threshold_exceeded_by_ms`: Amount over threshold

## Module-Specific Log Levels

Default configuration in `config.py`:

```python
log_module_levels: dict = {
    "writer-api.middleware": "INFO",   # Request logging
    "writer-api.api": "INFO",          # API endpoints
    "writer-api.db": "DEBUG",          # Database queries (verbose)
    "sqlalchemy": "WARNING",           # SQLAlchemy internals (quiet)
    "uvicorn": "INFO",                 # Server logs
    "uvicorn.access": "WARNING",      # Access logs (minimal)
}
```

## Configuration

In `config.py`:

```python
# Logging
log_level: str = "INFO"                          # Global log level
log_json_format: bool = False                    # JSON vs human-readable
log_dir: Path = Path("logs")                     # Log directory
log_max_bytes: int = 10 * 1024 * 1024            # 10MB per file
log_backup_count: int = 7                        # Backup files to keep
log_slow_request_threshold_ms: int = 1000        # Slow request threshold
log_sql_level: str = "DEBUG"                     # SQL query log level
```

## Usage Examples

### Getting a Logger

```python
from utils.logging import get_logger

logger = get_logger("writer-api.my_module")
logger.info("Something happened", extra={"custom_field": "value"})
```

### Log Analysis Queries

#### Find slow requests:
```bash
grep '"event": "slow_request"' logs/access.log | jq '.extra.duration_ms'
```

#### Find errors by path:
```bash
grep '"status_code": 500' logs/error.log | jq '.extra.path'
```

#### Request count by operation type:
```bash
cat logs/access.log | jq -r '.extra.operation_type' | sort | uniq -c
```

#### Average response time by endpoint:
```bash
cat logs/access.log | jq -r '.extra | "\(.path) \(.duration_ms)"' | \
  awk '{sum[$1]+=$2; count[$1]++} END {for (p in sum) print p, sum[p]/count[p]}'
```

## Integration

### FastAPI Application

```python
from fastapi import FastAPI
from middleware.logging import setup_logging_middleware

app = FastAPI()

# Setup with custom slow request threshold
setup_logging_middleware(app, slow_request_threshold_ms=2000)
```

### Manual Logger Setup

```python
from utils.logging import setup_logging

# Setup with custom configuration
setup_logging(
    level="DEBUG",
    json_logs=True,
    log_dir="logs",
    max_bytes=5*1024*1024,  # 5MB
    backup_count=14,
    module_levels={
        "sqlalchemy": "WARNING",
        "myapp": "DEBUG",
    }
)
```

## Environment Variables

```bash
# Set log level
LOG_LEVEL=DEBUG

# Enable JSON format
LOG_JSON_FORMAT=true

# Custom slow request threshold
LOG_SLOW_REQUEST_THRESHOLD_MS=2000
```
