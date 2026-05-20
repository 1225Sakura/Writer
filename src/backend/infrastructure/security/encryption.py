"""
Fernet-based encryption for sensitive data (API keys).

Key storage priority:
  1. Environment variable WRITER_ENCRYPTION_KEY
  2. File ~/.writer/encryption.key

If neither exists, a new key is generated and persisted to the file path.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger("writer-api.security")

# ---------------------------------------------------------------------------
# Key management
# ---------------------------------------------------------------------------

_KEY_PATH = Path.home() / ".writer" / "encryption.key"

_fernet_instance: object | None = None  # lazy singleton


def _load_or_generate_key() -> bytes:
    """Return a Fernet-compatible key from env or file, generating one if needed."""
    env_key = os.environ.get("WRITER_ENCRYPTION_KEY")
    if env_key:
        # Accept both raw urlsafe-base64 key and plain-text that needs encoding
        try:
            from cryptography.fernet import Fernet
            Fernet(env_key.encode() if isinstance(env_key, str) else env_key)
            return env_key.encode() if isinstance(env_key, str) else env_key
        except Exception:
            logger.warning("WRITER_ENCRYPTION_KEY env var is not a valid Fernet key; ignoring it")

    if _KEY_PATH.exists():
        key = _KEY_PATH.read_bytes().strip()
        try:
            from cryptography.fernet import Fernet
            Fernet(key)
            return key
        except Exception:
            logger.warning("Encryption key at %s is invalid; regenerating", _KEY_PATH)

    # Generate a new key
    from cryptography.fernet import Fernet
    key = Fernet.generate_key()
    _KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _KEY_PATH.write_bytes(key)
    logger.info("Generated new Fernet encryption key at %s", _KEY_PATH)
    return key


def get_fernet():
    """Return the shared Fernet instance (lazy-initialized)."""
    global _fernet_instance
    if _fernet_instance is None:
        try:
            from cryptography.fernet import Fernet
            _fernet_instance = Fernet(_load_or_generate_key())
        except ImportError:
            logger.error("cryptography package not installed; encryption unavailable")
            return None
    return _fernet_instance


def is_encryption_available() -> bool:
    """Check whether Fernet encryption can be used."""
    try:
        from cryptography.fernet import Fernet  # noqa: F401
        return get_fernet() is not None
    except ImportError:
        return False


# ---------------------------------------------------------------------------
# Encrypt / Decrypt helpers
# ---------------------------------------------------------------------------

def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string and return the Fernet token as UTF-8."""
    f = get_fernet()
    if f is None:
        raise RuntimeError("Encryption is not available (cryptography not installed)")
    token = f.encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a Fernet token and return the original plaintext."""
    f = get_fernet()
    if f is None:
        raise RuntimeError("Encryption is not available (cryptography not installed)")
    # Gracefully handle values that are NOT encrypted (plain legacy keys)
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except Exception:
        # If decryption fails, the value may be a legacy plaintext key.
        # Log once and return it as-is so callers transparently get the key.
        logger.debug("decrypt_value: input is not a valid Fernet token; returning as-is")
        return ciphertext


# ---------------------------------------------------------------------------
# Startup migration: encrypt all existing plaintext API keys
# ---------------------------------------------------------------------------

async def migrate_plaintext_keys(session_factory) -> int:
    """
    Read every AIProviderConfig row; if the api_key is not a valid Fernet
    token, encrypt it in place.  Returns the number of rows migrated.

    Parameters
    ----------
    session_factory : async_sessionmaker
        Factory that produces AsyncSession instances.
    """
    from sqlalchemy import select
    from backend.core.domain.entities import AIProviderConfig

    f = get_fernet()
    if f is None:
        logger.warning("Encryption unavailable; skipping plaintext key migration")
        return 0

    migrated = 0
    async with session_factory() as session:
        result = await session.execute(select(AIProviderConfig))
        configs = result.scalars().all()

        for config in configs:
            raw = config.api_key
            if raw is None:
                continue
            # Check if already encrypted by trying to decrypt
            try:
                f.decrypt(raw.encode("utf-8"))
                # Decryption succeeded => already encrypted
                continue
            except Exception:
                pass  # Not a valid Fernet token => plaintext

            # Encrypt the plaintext key
            config.api_key = encrypt_value(raw)
            migrated += 1
            logger.info("Encrypted API key for provider config id=%d name=%s", config.id, config.name)

        if migrated:
            await session.commit()
            logger.info("Migrated %d plaintext API key(s) to encrypted storage", migrated)

    return migrated
