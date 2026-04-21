"""AI Provider abstraction layer for novel writing assistant.

Supports multiple AI backends via a unified interface:
- MiniMax (default)
- OpenAI-compatible APIs (DeepSeek, local models, etc.)
"""

from .provider import AIProvider
from .minimax import MiniMaxProvider
from .openai_compatible import OpenAICompatibleProvider
from .router import ProviderRouter

__all__ = [
    "AIProvider",
    "MiniMaxProvider",
    "OpenAICompatibleProvider",
    "ProviderRouter",
]
