# Auto Novel Writer - CLI Tool
# Command-line interface for Writer app operations

import sys
import os
import json
import asyncio
import subprocess
import click
from pathlib import Path
from typing import Optional

# Setup paths to match start.py
BASE_DIR = Path(__file__).parent.parent.parent  # D:/writer
sys.path.insert(0, str(BASE_DIR / 'src'))
os.chdir(BASE_DIR / 'src' / 'backend')

from dotenv import load_dotenv
load_dotenv()

from backend.config import settings
from backend.infrastructure.database import engine, async_session_maker, Base
from backend.core.domain.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    Outline, Chapter, IFLine,
    ChatSession, ChatMessage, ExtractedEntity,
    DraftVersion, PlotThread, AIInspectionResult, WritingSettings,
)

# Lazy imports for services that trigger heavy backend.* import chains
# (kept at function level to avoid import failures when running db commands)
def _get_export_import():
    from services.export_import import (
        export_project,
        export_to_json,
        export_to_zip,
        import_project,
        import_from_json,
        import_from_zip,
    )
    return (
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
    from src.backend.interface.web.main import app

    click.echo(f"Starting Writer dev server at http://{host}:{port}")
    uvicorn.run(
        "src.backend.interface.web.main:app",
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
        export_project_fn, _, export_to_zip_fn, _, _, _ = _get_export_import()
        # Run async export
        data = asyncio.run(export_project_fn())

        if format == "json":
            content = json.dumps(data, ensure_ascii=False, indent=2 if pretty else None)
            Path(output_file).write_text(content, encoding="utf-8")
        else:
            zip_bytes = export_to_zip_fn(data)
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
        _, _, _, import_project_fn, import_from_json_fn, import_from_zip_fn = _get_export_import()
        if format == "json":
            content = Path(input_file).read_text(encoding="utf-8")
            data = import_from_json_fn(content)
        else:
            zip_bytes = Path(input_file).read_bytes()
            data = import_from_zip_fn(zip_bytes)

        # Run async import
        summary = asyncio.run(import_project_fn(data, mode=mode))

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


@db.command(name="seed")
@click.option("--force", is_flag=True, help="Force seed even if data exists")
def db_seed(force):
    """Seed the database with sample test data.

    Creates sample characters, chapters, and other entities for testing.

    Example: writer db seed
             writer db seed --force  # Re-seed even with existing data
    """
    click.echo("Seeding database with sample data...")

    async def _seed():
        from datetime import datetime
        async with async_session_maker() as session:
            # Check if data already exists
            if not force:
                from sqlalchemy import select, func
                result = await session.execute(select(func.count(Character.id)))
                count = result.scalar()
                if count > 0:
                    click.echo(f"Database already has {count} characters. Use --force to re-seed.")
                    return

            # Create sample characters
            characters = [
                Character(
                    name="李青云",
                    gender="男",
                    personality="正直坚毅，心怀天下",
                    desires="修炼成仙，解开身世之谜",
                    flaws="过于固执，不懂变通",
                    description="原本是偏远山村的普通少年，偶得上古传承踏上修仙路",
                    tier="主角",
                    cultivation_realm="筑基期",
                ),
                Character(
                    name="叶轻舞",
                    gender="女",
                    personality="聪慧机敏，外冷内热",
                    desires="找到失散的亲人",
                    flaws="容易心软，优柔寡断",
                    description="仙门大师姐，实为某大家族遗孤",
                    tier="女主",
                    cultivation_realm="金丹期",
                ),
                Character(
                    name="魔君厉无痕",
                    gender="男",
                    personality="阴狠毒辣，野心勃勃",
                    desires="一统三界",
                    flaws="多疑猜忌，众叛亲离",
                    description="千年前的魔门至尊转世",
                    tier="反派",
                    cultivation_realm="化神期",
                ),
            ]

            for char in characters:
                session.add(char)
            await session.flush()

            # Create character relationships
            relationships = [
                CharacterRelationship(
                    character_id=characters[0].id,
                    target_id=characters[1].id,
                    type="恋人",
                    description="修仙路上的知己伴侣",
                ),
                CharacterRelationship(
                    character_id=characters[0].id,
                    target_id=characters[2].id,
                    type="宿敌",
                    description="正邪不两立",
                ),
            ]
            for rel in relationships:
                session.add(rel)

            # Create storylines
            storylines = [
                CharacterStoryline(
                    character_id=characters[0].id,
                    title="青云诀",
                    arc="从凡人修炼到飞升成仙的历程",
                    progress=30,
                ),
            ]
            for sl in storylines:
                session.add(sl)

            # Create world settings
            world_settings = [
                WorldSetting(
                    name="修仙界",
                    description="以修炼灵力为核心的修真世界",
                    details_json=json.dumps({"境界": ["炼气", "筑基", "金丹", "元婴", "化神"]}),
                ),
                WorldSetting(
                    name="凡界",
                    description="普通凡人居住的世界",
                    details_json=json.dumps({"特点": "灵力稀薄，不适合修炼"}),
                ),
            ]
            for ws in world_settings:
                session.add(ws)

            # Create locations
            locations = [
                Location(
                    name="青云峰",
                    description="主角修炼之地，云雾缭绕",
                    importance="核心",
                ),
                Location(
                    name="魔域",
                    description="魔修聚集之地，阴森恐怖",
                    importance="危险",
                ),
            ]
            for loc in locations:
                session.add(loc)

            # Create factions
            factions = [
                Faction(
                    name="青云宗",
                    description="正道修仙大派",
                    type="正道",
                ),
                Faction(
                    name="万魔门",
                    description="魔道势力之首",
                    type="魔道",
                ),
            ]
            for fac in factions:
                session.add(fac)

            # Create rules
            rules = [
                Rule(
                    name="弱肉强食",
                    description="修仙界基本法则，实力为尊",
                    type="法则",
                ),
            ]
            for rule in rules:
                session.add(rule)

            # Create outline with chapters
            outline = Outline(
                title="修仙崛起之路",
                description="主角从凡人到飞升的热血历程",
            )
            session.add(outline)
            await session.flush()

            chapters = [
                Chapter(
                    outline_id=outline.id,
                    title="第一章：山村少年",
                    summary="偏远山村的普通少年李青云偶遇仙人指路",
                    status="completed",
                    word_count=3500,
                    chapter_order=1,
                ),
                Chapter(
                    outline_id=outline.id,
                    title="第二章：踏上仙途",
                    summary="离开山村，进入青云宗修炼",
                    status="completed",
                    word_count=4200,
                    chapter_order=2,
                ),
                Chapter(
                    outline_id=outline.id,
                    title="第三章：初入宗门",
                    summary="青云宗入门测试，崭露头角",
                    status="in_progress",
                    word_count=2800,
                    chapter_order=3,
                ),
                Chapter(
                    outline_id=outline.id,
                    title="第四章：修仙之始",
                    summary="开始修炼基础功法",
                    status="pending",
                    word_count=0,
                    chapter_order=4,
                ),
            ]
            for chap in chapters:
                session.add(chap)

            # Create IF lines
            if_lines = [
                IFLine(
                    title="叶轻舞线",
                    linked_character_id=characters[1].id,
                    description="大师姐叶轻舞的过往与复仇",
                    sync_mode="auto",
                ),
            ]
            for ifl in if_lines:
                session.add(ifl)

            # Create items
            items = [
                Item(
                    name="青云剑",
                    description="主角的本命法宝，可成长型仙剑",
                    owner="李青云",
                    location="随身",
                ),
                Item(
                    name="九转还魂草",
                    description="能生死人肉白骨的灵药",
                    owner="无主",
                    location="天材地宝",
                ),
            ]
            for item in items:
                session.add(item)

            # Create writing settings
            writing_settings = WritingSettings(
                human_ai_ratio=0.6,
                writing_style="default",
                target_word_count=3000,
            )
            session.add(writing_settings)

            await session.commit()
            click.echo("[OK] Database seeded successfully!")
            click.echo(f"  - Characters: {len(characters)}")
            click.echo(f"  - Chapters: {len(chapters)}")
            click.echo(f"  - Locations: {len(locations)}")
            click.echo(f"  - Factions: {len(factions)}")
            click.echo(f"  - Items: {len(items)}")
            click.echo(f"  - IF Lines: {len(if_lines)}")

    asyncio.run(_seed())


@db.command(name="reset")
@click.option("--confirm", is_flag=True, help="Skip confirmation prompt")
def db_reset(confirm):
    """Reset the database by dropping all tables and re-creating schema.

    WARNING: This will DELETE ALL DATA. Use with caution!

    Example: writer db reset --confirm
    """
    if not confirm:
        click.echo("WARNING: This will delete ALL data in the database!")
        click.echo("Run with --confirm to proceed.")
        sys.exit(1)

    click.echo("Resetting database...")

    async def _reset():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        click.echo("[OK] All tables dropped.")

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        click.echo("[OK] Schema re-created.")

    asyncio.run(_reset())
    click.echo("[OK] Database reset complete!")
    click.echo("Hint: Run 'writer db seed' to populate sample data.")


@writer.command()
@click.option("--host", "-h", default="0.0.0.0", help="Host to bind to")
@click.option("--port", "-p", default=8000, help="Port to bind to", type=int)
@click.option("--reload", "-r", is_flag=True, help="Enable auto-reload for development")
@click.option("--workers", "-w", default=1, help="Number of worker processes", type=int)
@click.option("--env", "-e", "env_mode", type=click.Choice(["development", "production"]), default="development", help="Environment mode")
def serve(host, port, reload, workers, env_mode):
    """Start the API server.

    Examples:
      writer serve                    # Start on default 0.0.0.0:8000
      writer serve -h 127.0.0.1 -p 9000
      writer serve --env production   # Production mode
      writer serve --reload          # Auto-reload on code changes
    """
    import uvicorn

    # Set environment variables based on --env flag
    os.environ["ENVIRONMENT"] = env_mode
    log_level = "info" if env_mode == "production" else "debug"

    click.echo(f"Starting Writer API server in {env_mode} mode...")
    click.echo(f"  Host: {host}")
    click.echo(f"  Port: {port}")
    click.echo(f"  Reload: {reload}")
    if env_mode == "production":
        click.echo(f"  Workers: {workers}")
        click.echo(f"  Log level: {log_level}")

    uvicorn.run(
        "src.backend.interface.web.main:app",
        host=host,
        port=port,
        reload=reload,
        workers=workers if not reload else 1,  # reload mode doesn't support multiple workers
        log_level=log_level,
    )


@writer.command(name="config")
@click.option("--json", "output_json", is_flag=True, help="Output as JSON")
@click.option("--env", "-e", type=click.Choice(["production", "development"]), help="Filter by environment")
def config_cmd(output_json, env):
    """Show current configuration.

    Displays all settings including database, API keys (masked), and app config.

    Examples:
      writer config                  # Show all config
      writer config --json          # Output as JSON
      writer config --env production  # Show production settings
    """
    config_data = {
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
        },
        "database": {
            "url": settings.database_url,
            "type": "sqlite+aiosqlite",
        },
        "api": {
            "minimax_url": settings.minimax_api_url,
            "minimax_key_set": bool(settings.minimax_api_key),
            "api_key_set": bool(settings.api_key),
        },
        "auth": {
            "skip_localhost": settings.auth_skip_localhost,
        },
        "cors": {
            "origins": settings.cors_origins,
        },
        "cache": {
            "dir": str(settings.cache_dir),
            "default_ttl": settings.cache_default_ttl,
            "styles_ttl": settings.cache_styles_ttl,
        },
    }

    # Mask sensitive values in display
    def mask_config(cfg):
        if isinstance(cfg, dict):
            return {k: mask_config(v) for k, v in cfg.items()}
        elif isinstance(cfg, list):
            return [mask_config(item) for item in cfg]
        elif isinstance(cfg, str) and len(cfg) > 8 and not cfg.startswith("/"):
            # Mask long strings that might be keys
            if "key" in str(cfg).lower() or "password" in str(cfg).lower():
                return "********"
        return cfg

    if output_json:
        click.echo(json.dumps(config_data, indent=2, ensure_ascii=False))
    else:
        click.echo("Writer Configuration")
        click.echo("=" * 50)

        app_cfg = config_data["app"]
        click.echo(f"\n[Application]")
        click.echo(f"  Name:    {app_cfg['name']}")
        click.echo(f"  Version: {app_cfg['version']}")

        db_cfg = config_data["database"]
        click.echo(f"\n[Database]")
        click.echo(f"  URL:     {db_cfg['url']}")
        click.echo(f"  Type:    {db_cfg['type']}")

        api_cfg = config_data["api"]
        click.echo(f"\n[API]")
        click.echo(f"  MiniMax URL:   {api_cfg['minimax_url']}")
        click.echo(f"  MiniMax Key:   {'[SET]' if api_cfg['minimax_key_set'] else '[NOT SET]'}")
        click.echo(f"  API Key:       {'[SET]' if api_cfg['api_key_set'] else '[NOT SET]'}")

        auth_cfg = config_data["auth"]
        click.echo(f"\n[Auth]")
        click.echo(f"  Skip Localhost: {auth_cfg['skip_localhost']}")

        cors_cfg = config_data["cors"]
        click.echo(f"\n[CORS]")
        click.echo(f"  Origins: {', '.join(cors_cfg['origins'])}")

        cache_cfg = config_data["cache"]
        click.echo(f"\n[Cache]")
        click.echo(f"  Dir:        {cache_cfg['dir']}")
        click.echo(f"  Default TTL: {cache_cfg['default_ttl']}s")
        click.echo(f"  Styles TTL:  {cache_cfg['styles_ttl']}s")


if __name__ == "__main__":
    writer()
