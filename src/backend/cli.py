# Auto Novel Writer - CLI Tool
# Command-line interface for Writer app operations

import sys
import os
import json
import asyncio
import subprocess
import click
from pathlib import Path

# Setup paths to match start.py
BASE_DIR = Path(__file__).parent.parent.parent  # D:/writer
sys.path.insert(0, str(BASE_DIR / 'src'))
os.chdir(BASE_DIR / 'src' / 'backend')

from dotenv import load_dotenv
load_dotenv()

from config import settings
from database import engine, async_session_maker, Base
from services.export_import import (
    export_project,
    export_to_json,
    export_to_zip,
    import_project,
    import_from_json,
    import_from_zip,
)

# Alembic config path (now inside src/backend/)
ALEMBIC_INI = BASE_DIR / "src" / "backend" / "alembic.ini"


def _get_alembic_cmd():
    """Resolve the alembic executable (venv first, then PATH)."""
    venv_alembic = BASE_DIR / "src" / "backend" / ".venv" / "Scripts" / "alembic.exe"
    if venv_alembic.exists():
        return str(venv_alembic)
    venv_alembic_unix = BASE_DIR / "src" / "backend" / ".venv" / "bin" / "alembic"
    if venv_alembic_unix.exists():
        return str(venv_alembic_unix)
    return "alembic"


@click.group()
@click.version_option(version="1.0.0")
def writer():
    """Auto Novel Writer - CLI tool for managing your writing projects."""
    pass


@writer.command()
@click.option("--path", "-p", default=".", help="Project directory path")
def init(path):
    """Initialize a new Writer project."""
    project_path = Path(path).resolve()
    click.echo(f"Initializing Writer project at: {project_path}")

    # Create necessary directories
    data_dir = project_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    # Create .env file if not exists
    env_file = project_path / ".env"
    if not env_file.exists():
        env_content = f"""# Writer Project Configuration
DATABASE_URL=sqlite+aiosqlite:///{data_dir / 'writer.db'}
MINIMAX_API_KEY=
MINIMAX_API_URL=https://api.minimax.chat/v1
"""
        env_file.write_text(env_content, encoding="utf-8")
        click.echo(f"Created {env_file}")
    else:
        click.echo(f"{env_file} already exists")

    # Create project marker
    marker_file = project_path / ".writer"
    marker_file.write_text("1.0.0", encoding="utf-8")

    click.echo("Project initialized successfully!")


@writer.command()
@click.option("--host", "-h", default="127.0.0.1", help="Host to bind to")
@click.option("--port", "-p", default=8000, help="Port to bind to")
@click.option("--reload", "-r", is_flag=True, help="Enable auto-reload")
def dev(host, port, reload):
    """Start the development server."""
    import uvicorn
    from src.backend.main import app

    click.echo(f"Starting Writer dev server at http://{host}:{port}")
    uvicorn.run(
        "src.backend.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
    )


@writer.command()
def build():
    """Build the Writer application for distribution."""
    click.echo("Building Writer application...")

    # Check for frontend build
    frontend_dist = Path("dist")
    if frontend_dist.exists():
        click.echo(f"Frontend build found in: {frontend_dist}")
    else:
        click.echo("Warning: No frontend build found. Run 'npm run build' in the frontend directory.")

    # Check database
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
    if Path(db_path).exists():
        click.echo(f"Database found: {db_path}")
    else:
        click.echo("Warning: Database not initialized. Run 'writer init' first.")

    click.echo("Build check complete!")


@writer.command()
@click.argument("output_file", type=click.Path())
@click.option("--format", "-f", type=click.Choice(["json", "zip"]), default="json", help="Export format")
@click.option("--pretty", is_flag=True, default=True, help="Pretty-print JSON")
def export(output_file, format, pretty):
    """Export project data to a file."""
    click.echo("Exporting project data...")

    try:
        # Run async export
        data = asyncio.run(export_project())

        if format == "json":
            content = json.dumps(data, ensure_ascii=False, indent=2 if pretty else None)
            Path(output_file).write_text(content, encoding="utf-8")
        else:
            zip_bytes = export_to_zip(data)
            Path(output_file).write_bytes(zip_bytes)

        click.echo(f"Exported successfully to: {output_file}")
    except Exception as e:
        click.echo(f"Export failed: {e}", err=True)
        sys.exit(1)


@writer.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("--mode", "-m", type=click.Choice(["merge", "replace"]), default="merge", help="Import mode")
@click.option("--format", "-f", type=click.Choice(["json", "zip"]), default="json", help="Import format")
def import_data(input_file, mode, format):
    """Import project data from a file."""
    click.echo(f"Importing project data from: {input_file}")

    try:
        if format == "json":
            content = Path(input_file).read_text(encoding="utf-8")
            data = import_from_json(content)
        else:
            zip_bytes = Path(input_file).read_bytes()
            data = import_from_zip(zip_bytes)

        # Run async import
        summary = asyncio.run(import_project(data, mode=mode))

        click.echo("Import successful!")
        click.echo(f"Imported entities:")
        for entity_type, count in summary.get("imported", {}).items():
            click.echo(f"  - {entity_type}: {count}")
    except Exception as e:
        click.echo(f"Import failed: {e}", err=True)
        sys.exit(1)


@writer.command()
@click.option("--path", default="data/writer.db", help="Database file path")
def db_init(path):
    """Initialize the database schema."""
    click.echo(f"Initializing database: {path}")

    async def _init():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init())
    click.echo("Database initialized successfully!")


@writer.command()
def db_status():
    """Check database connection and status."""
    click.echo("Checking database status...")

    async def _check():
        try:
            async with engine.connect() as conn:
                from sqlalchemy import text
                await conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            return str(e)

    result = asyncio.run(_check())

    if result is True:
        click.echo(f"Database: Connected ({settings.database_url})")
    else:
        click.echo(f"Database: Error - {result}", err=True)
        sys.exit(1)


@writer.group()
def db():
    """Database migration commands."""
    pass


@db.command(name="migrate")
@click.argument("message")
@click.option("--apply", is_flag=True, default=True, help="Apply the migration after generation")
def db_migrate(message, apply):
    """Auto-generate a migration from model changes and optionally apply it.

    Example: writer db migrate "add user preferences table"
    """
    click.echo(f"Auto-generating migration: '{message}'...")

    if not ALEMBIC_INI.exists():
        click.echo(f"Error: alembic.ini not found at {ALEMBIC_INI}", err=True)
        sys.exit(1)

    alembic = _get_alembic_cmd()
    try:
        result = subprocess.run(
            [alembic, "-c", str(ALEMBIC_INI), "revision", "--autogenerate", "-m", message],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        click.echo(result.stdout)
        if result.stderr:
            click.echo(result.stderr)

        click.echo("[OK] Migration generated successfully")

        if apply:
            click.echo("Applying migration...")
            result = subprocess.run(
                [alembic, "-c", str(ALEMBIC_INI), "upgrade", "head"],
                cwd=BASE_DIR,
                capture_output=True,
                text=True,
                check=True,
            )
            click.echo(result.stdout)
            click.echo("[OK] Migration applied")
    except subprocess.CalledProcessError as e:
        click.echo(f"Migration generation failed:\n{e.stdout}\n{e.stderr}", err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.echo("Error: 'alembic' command not found. Install with: pip install alembic", err=True)
        sys.exit(1)


@db.command(name="upgrade")
@click.option("--revision", "-r", default="head", help="Target revision (default: head)")
def db_upgrade(revision):
    """Apply database migrations up to the target revision."""
    click.echo(f"Applying migrations to {revision}...")

    if not ALEMBIC_INI.exists():
        click.echo(f"Error: alembic.ini not found at {ALEMBIC_INI}", err=True)
        sys.exit(1)

    alembic = _get_alembic_cmd()
    try:
        result = subprocess.run(
            [alembic, "-c", str(ALEMBIC_INI), "upgrade", revision],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        click.echo(result.stdout)
        click.echo(f"[OK] Migrations applied successfully to {revision}")
    except subprocess.CalledProcessError as e:
        click.echo(f"Migration failed:\n{e.stdout}\n{e.stderr}", err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.echo("Error: 'alembic' command not found. Install with: pip install alembic", err=True)
        sys.exit(1)


@db.command(name="downgrade")
@click.option("--revision", "-r", default="-1", help="Target revision (default: -1)")
def db_downgrade(revision):
    """Rollback database migrations to the target revision."""
    click.echo(f"Rolling back migrations to {revision}...")

    if not ALEMBIC_INI.exists():
        click.echo(f"Error: alembic.ini not found at {ALEMBIC_INI}", err=True)
        sys.exit(1)

    alembic = _get_alembic_cmd()
    try:
        result = subprocess.run(
            [alembic, "-c", str(ALEMBIC_INI), "downgrade", revision],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        click.echo(result.stdout)
        click.echo(f"[OK] Migrations rolled back to {revision}")
    except subprocess.CalledProcessError as e:
        click.echo(f"Rollback failed:\n{e.stdout}\n{e.stderr}", err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.echo("Error: 'alembic' command not found. Install with: pip install alembic", err=True)
        sys.exit(1)


@db.command(name="current")
def db_current():
    """Show current migration version."""
    if not ALEMBIC_INI.exists():
        click.echo(f"Error: alembic.ini not found at {ALEMBIC_INI}", err=True)
        sys.exit(1)

    alembic = _get_alembic_cmd()
    try:
        result = subprocess.run(
            [alembic, "-c", str(ALEMBIC_INI), "current"],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        click.echo(result.stdout)
    except subprocess.CalledProcessError as e:
        click.echo(f"Failed to get current version:\n{e.stdout}\n{e.stderr}", err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.echo("Error: 'alembic' command not found. Install with: pip install alembic", err=True)
        sys.exit(1)


@db.command(name="history")
@click.option("--verbose", "-v", is_flag=True, help="Show verbose output")
def db_history(verbose):
    """Show migration history."""
    if not ALEMBIC_INI.exists():
        click.echo(f"Error: alembic.ini not found at {ALEMBIC_INI}", err=True)
        sys.exit(1)

    alembic = _get_alembic_cmd()
    try:
        cmd = [alembic, "-c", str(ALEMBIC_INI), "history"]
        if verbose:
            cmd.append("--verbose")
        result = subprocess.run(
            cmd,
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            check=True,
        )
        click.echo(result.stdout)
        if result.stderr:
            click.echo(result.stderr)
    except subprocess.CalledProcessError as e:
        click.echo(f"Failed to get history:\n{e.stdout}\n{e.stderr}", err=True)
        sys.exit(1)
    except FileNotFoundError:
        click.echo("Error: 'alembic' command not found. Install with: pip install alembic", err=True)
        sys.exit(1)


if __name__ == "__main__":
    writer()
