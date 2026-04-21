# DI Container - Simple dependency injection container
# Supports singleton and transient lifetime scopes

import logging
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class DIContainer:
    """Simple dependency injection container with singleton/transient support.

    Register factories by name and resolve instances on demand.
    Singletons are cached; transients create a new instance each time.
    """

    def __init__(self) -> None:
        self._registrations: Dict[str, Dict[str, Any]] = {}
        self._singletons: Dict[str, Any] = {}

    def register(
        self,
        name: str,
        factory: Callable[..., Any],
        singleton: bool = True,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        """Register a factory under a name.

        Args:
            name: Unique identifier for the registration
            factory: Callable that returns an instance
            singleton: If True, cache the first resolved instance
            *args: Positional arguments passed to factory on resolve
            **kwargs: Keyword arguments passed to factory on resolve
        """
        self._registrations[name] = {
            "factory": factory,
            "singleton": singleton,
            "args": args,
            "kwargs": kwargs,
        }
        logger.debug("Registered '%s' (singleton=%s)", name, singleton)

    def resolve(self, name: str) -> Any:
        """Resolve an instance by name.

        Args:
            name: The registration name

        Returns:
            The resolved instance

        Raises:
            KeyError: If name is not registered
        """
        if name not in self._registrations:
            raise KeyError(f"No registration found for '{name}'")

        reg = self._registrations[name]

        if reg["singleton"]:
            if name not in self._singletons:
                self._singletons[name] = reg["factory"](
                    *reg["args"], **reg["kwargs"]
                )
                logger.debug("Created singleton instance for '%s'", name)
            return self._singletons[name]

        # Transient: new instance every time
        logger.debug("Created transient instance for '%s'", name)
        return reg["factory"](*reg["args"], **reg["kwargs"])

    def unregister(self, name: str) -> bool:
        """Remove a registration and its cached singleton instance.

        Args:
            name: The registration name

        Returns:
            True if removed, False if not found
        """
        if name in self._registrations:
            del self._registrations[name]
            self._singletons.pop(name, None)
            logger.debug("Unregistered '%s'", name)
            return True
        return False

    def is_registered(self, name: str) -> bool:
        """Check if a name is registered.

        Args:
            name: The registration name

        Returns:
            True if registered, False otherwise
        """
        return name in self._registrations

    def list_registrations(self) -> Dict[str, bool]:
        """List all registered names and their singleton status.

        Returns:
            Dict mapping name to singleton flag
        """
        return {
            name: reg["singleton"] for name, reg in self._registrations.items()
        }

    def clear(self) -> None:
        """Clear all registrations and singleton instances."""
        self._registrations.clear()
        self._singletons.clear()
        logger.debug("Cleared all registrations")
