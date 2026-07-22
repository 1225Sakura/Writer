"""Strip hex fallbacks from CSS var() expressions in selected tsx files.

Phase 0b.1: design-token SSOT enforcement — replace `var(--token, #xxxxxx)`
with `var(--token)`. Hex colors must live ONLY in design-tokens.css.
"""
import re
from pathlib import Path

FILES = [
    "src/components/chat/ChatFooter.tsx",
    "src/components/chat/ChatSidebar.tsx",
    "src/components/chat/VersionDiffView.tsx",
    "src/components/chat/VersionHistoryPanel.tsx",
    "src/components/writing/ai/CommandPalette.tsx",
    "src/components/writing/extensions/StyleCheckExtension.tsx",
    "src/components/writing/InlineAIPopup.tsx",
    "src/components/writing/SelectionAIMenu.tsx",
    "src/components/writing/StyleCheckGutter.tsx",
]

# Pattern 1: var(--token, #xxxxxx) → var(--token)
RE_VAR_FALLBACK = re.compile(
    r'var\(\s*(--[a-zA-Z0-9_-]+)\s*,\s*#[0-9a-fA-F]{3,8}\s*\)'
)

# Pattern 2: in template literals / raw strings: 'X #xxxxxx' -> 'X' (drop color)
# We only strip hex literals that appear inside quoted strings or color contexts.
# Conservative: only remove the hex token, leave the surrounding quote/delimiter intact.
RE_HEX_LITERAL = re.compile(r'#[0-9a-fA-F]{6}(?=[0-9a-fA-F]{2})?\b')


def strip_hex_fallbacks(content: str) -> tuple[str, int]:
    """Strip `, #xxxxxx` fallback from var(--token, #xxxxxx)."""
    new_content, n = RE_VAR_FALLBACK.subn(r'var(\1)', content)
    return new_content, n


def strip_standalone_hex(content: str) -> tuple[str, list[str]]:
    """Remove hex color tokens from StyleCheckGutter style blocks.

    Only matches hex tokens that are not part of a CSS var fallback.
    Returns list of removed hexes for the caller to log.
    """
    removed = []
    def _sub(m):
        h = m.group(0)
        # Skip if inside a var() fallback (shouldn't happen after strip_hex_fallbacks)
        removed.append(h)
        return h  # Keep for now; we will handle StyleCheckGutter specifically
    return content, removed


def main():
    root = Path(r"D:\writer\src\frontend")
    total = 0
    for rel in FILES:
        p = root / rel
        if not p.exists():
            print(f"SKIP (missing): {rel}")
            continue
        content = p.read_text(encoding="utf-8")
        new_content, n = strip_hex_fallbacks(content)
        if n > 0:
            p.write_text(new_content, encoding="utf-8")
            print(f"OK  {rel}  ({n} fallback(s) stripped)")
            total += n
        else:
            print(f"--  {rel}  (no var(--x, #..) fallbacks)")
    print(f"\nTotal fallbacks stripped: {total}")


if __name__ == "__main__":
    main()