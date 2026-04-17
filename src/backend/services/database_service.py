"""Database CRUD service using aiosqlite."""

import aiosqlite
from typing import Any

DATABASE_PATH = "D:/writer/data/writer.db"


# ============ Characters ============

async def get_character(db: aiosqlite.Connection, character_id: int) -> dict | None:
    """Get character by ID."""
    cursor = await db.execute(
        "SELECT * FROM characters WHERE id = ?", (character_id,)
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_all_characters(db: aiosqlite.Connection) -> list[dict]:
    """Get all characters."""
    cursor = await db.execute("SELECT * FROM characters ORDER BY id")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def create_character(db: aiosqlite.Connection, data: dict) -> int:
    """Create a new character."""
    cursor = await db.execute(
        """INSERT INTO characters (name, description, role, if_line_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))""",
        (data.get("name"), data.get("description"), data.get("role"), data.get("if_line_id"))
    )
    await db.commit()
    return cursor.lastrowid


async def update_character(db: aiosqlite.Connection, character_id: int, data: dict) -> bool:
    """Update character fields."""
    fields = []
    values = []
    for key in ["name", "description", "role", "if_line_id"]:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        return False
    fields.append("updated_at = datetime('now')")
    values.append(character_id)
    cursor = await db.execute(
        f"UPDATE characters SET {', '.join(fields)} WHERE id = ?", values
    )
    await db.commit()
    return cursor.rowcount > 0


async def delete_character(db: aiosqlite.Connection, character_id: int) -> bool:
    """Delete a character."""
    cursor = await db.execute("DELETE FROM characters WHERE id = ?", (character_id,))
    await db.commit()
    return cursor.rowcount > 0


# ============ Chapters ============

async def get_chapter(db: aiosqlite.Connection, chapter_id: int) -> dict | None:
    """Get chapter by ID."""
    cursor = await db.execute(
        "SELECT * FROM chapters WHERE id = ?", (chapter_id,)
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_all_chapters(db: aiosqlite.Connection) -> list[dict]:
    """Get all chapters."""
    cursor = await db.execute("SELECT * FROM chapters ORDER BY order_index")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def create_chapter(db: aiosqlite.Connection, data: dict) -> int:
    """Create a new chapter."""
    cursor = await db.execute(
        """INSERT INTO chapters (title, content, story_outline_id, order_index, word_count, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))""",
        (data.get("title"), data.get("content"), data.get("story_outline_id"),
         data.get("order_index", 0), data.get("word_count", 0))
    )
    await db.commit()
    return cursor.lastrowid


async def update_chapter(db: aiosqlite.Connection, chapter_id: int, data: dict) -> bool:
    """Update chapter fields."""
    fields = []
    values = []
    for key in ["title", "content", "story_outline_id", "order_index", "word_count"]:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        return False
    fields.append("updated_at = datetime('now')")
    values.append(chapter_id)
    cursor = await db.execute(
        f"UPDATE chapters SET {', '.join(fields)} WHERE id = ?", values
    )
    await db.commit()
    return cursor.rowcount > 0


async def delete_chapter(db: aiosqlite.Connection, chapter_id: int) -> bool:
    """Delete a chapter."""
    cursor = await db.execute("DELETE FROM chapters WHERE id = ?", (chapter_id,))
    await db.commit()
    return cursor.rowcount > 0


# ============ Chat Sessions ============

async def get_chat_session(db: aiosqlite.Connection, session_id: int) -> dict | None:
    """Get chat session by ID."""
    cursor = await db.execute(
        "SELECT * FROM chat_sessions WHERE id = ?", (session_id,)
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_all_chat_sessions(db: aiosqlite.Connection) -> list[dict]:
    """Get all chat sessions."""
    cursor = await db.execute("SELECT * FROM chat_sessions ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def create_chat_session(db: aiosqlite.Connection, data: dict) -> int:
    """Create a new chat session."""
    cursor = await db.execute(
        """INSERT INTO chat_sessions (title, created_at, updated_at)
           VALUES (?, datetime('now'), datetime('now'))""",
        (data.get("title", "新会话"),)
    )
    await db.commit()
    return cursor.lastrowid


async def update_chat_session(db: aiosqlite.Connection, session_id: int, data: dict) -> bool:
    """Update chat session fields."""
    fields = []
    values = []
    for key in ["title"]:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])
    if not fields:
        return False
    fields.append("updated_at = datetime('now')")
    values.append(session_id)
    cursor = await db.execute(
        f"UPDATE chat_sessions SET {', '.join(fields)} WHERE id = ?", values
    )
    await db.commit()
    return cursor.rowcount > 0


async def delete_chat_session(db: aiosqlite.Connection, session_id: int) -> bool:
    """Delete a chat session."""
    cursor = await db.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    await db.commit()
    return cursor.rowcount > 0


# ============ Messages ============

async def get_message(db: aiosqlite.Connection, message_id: int) -> dict | None:
    """Get message by ID."""
    cursor = await db.execute(
        "SELECT * FROM messages WHERE id = ?", (message_id,)
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_all_messages(db: aiosqlite.Connection, session_id: int | None = None) -> list[dict]:
    """Get all messages, optionally filtered by session."""
    if session_id:
        cursor = await db.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at",
            (session_id,)
        )
    else:
        cursor = await db.execute("SELECT * FROM messages ORDER BY created_at")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def create_message(db: aiosqlite.Connection, data: dict) -> int:
    """Create a new message."""
    cursor = await db.execute(
        """INSERT INTO messages (session_id, role, content, created_at)
           VALUES (?, ?, ?, datetime('now'))""",
        (data.get("session_id"), data.get("role"), data.get("content"))
    )
    await db.commit()
    return cursor.lastrowid


async def update_message(db: aiosqlite.Connection, message_id: int, data: dict) -> bool:
    """Update message fields."""
    if "content" not in data:
        return False
    cursor = await db.execute(
        "UPDATE messages SET content = ? WHERE id = ?",
        (data["content"], message_id)
    )
    await db.commit()
    return cursor.rowcount > 0


async def delete_message(db: aiosqlite.Connection, message_id: int) -> bool:
    """Delete a message."""
    cursor = await db.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    await db.commit()
    return cursor.rowcount > 0


# ============ Database Context Manager ============

async def get_db() -> aiosqlite.Connection:
    """Get database connection."""
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    return db
