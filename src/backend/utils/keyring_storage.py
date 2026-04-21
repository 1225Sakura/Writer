"""
Keyring storage utilities for secure API key management.

Provides functions to store and retrieve sensitive credentials from the
system keyring (macOS Keychain, Windows Credential Locker, Linux Secret Service).
Falls back to environment variables if keyring is unavailable.
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# App identifier used as the "service" name in the system keyring
KEYRING_SERVICE_NAME = "auto-novel-writer"


def _get_keyring():
    """Lazy import keyring to allow graceful fallback."""
    import keyring as kr
    return kr


def get_api_key_from_keyring(key_name: str = "api_key") -> Optional[str]:
    """
    Retrieve a credential from the system keyring.

    Args:
        key_name: The account/username identifier in the keyring.

    Returns:
        The stored password, or None if not found / keyring unavailable.
    """
    try:
        kr = _get_keyring()
        value = kr.get_password(KEYRING_SERVICE_NAME, key_name)
        if value:
            logger.debug("Retrieved %s from system keyring", key_name)
        return value
    except Exception as exc:  # noqa: BLE001
        logger.debug("Keyring read failed for %s: %s", key_name, exc)
        return None


def save_api_key_to_keyring(key_name: str, value: str) -> bool:
    """
    Store a credential in the system keyring.

    Args:
        key_name: The account/username identifier in the keyring.
        value: The secret value to store.

    Returns:
        True if stored successfully, False otherwise.
    """
    try:
        kr = _get_keyring()
        kr.set_password(KEYRING_SERVICE_NAME, key_name, value)
        logger.info("Saved %s to system keyring", key_name)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("Keyring write failed for %s: %s", key_name, exc)
        return False


def delete_api_key_from_keyring(key_name: str) -> bool:
    """
    Delete a credential from the system keyring.

    Args:
        key_name: The account/username identifier in the keyring.

    Returns:
        True if deleted successfully, False otherwise.
    """
    try:
        kr = _get_keyring()
        kr.delete_password(KEYRING_SERVICE_NAME, key_name)
        logger.info("Deleted %s from system keyring", key_name)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.debug("Keyring delete failed for %s: %s", key_name, exc)
        return False


def get_api_key_with_fallback(key_name: str, env_value: Optional[str] = None) -> Optional[str]:
    """
    Get an API key: prefer keyring, fallback to env_value.

    Args:
        key_name: The keyring account name.
        env_value: Fallback value (typically from .env / environment).

    Returns:
        The key from keyring if available, otherwise env_value.
    """
    keyring_value = get_api_key_from_keyring(key_name)
    if keyring_value:
        return keyring_value
    return env_value
