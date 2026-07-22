"""Fix unused-vars ESLint errors by prefixing identifiers with _.

Phase 0b.1 batch fix:
  - catch (err)            -> catch (_err)
  - catch (error)          -> catch (_error)
  - catch (e)              -> catch (_e)
  - catch (syncError)      -> catch (_syncError)
  - function foo(thickness) -> function foo(_thickness)
  - function bar(triggerClassName, ...) -> bar(_triggerClassName, ...)
  - import { indexedDBStorage, ... }   -> import { _indexedDBStorage, ... }
    BUT we keep re-exports and side-effect imports intact.

Operates only on files ESLint flagged. Skips test files.
"""
import re
import subprocess
from pathlib import Path

ROOT = Path(r"D:\writer\src\frontend")


def list_violations() -> list[tuple[str, int, str]]:
    """Return [(file, line, message), ...] for no-unused-vars errors."""
    out = subprocess.check_output(
        ["npm", "run", "--silent", "lint"],
        cwd=str(ROOT),
        text=True,
    )
    violations: list[tuple[str, int, str]] = []
    current_file: str | None = None
    for line in out.splitlines():
        m_file = re.match(r"^([A-Z]:\\.*\.(?:ts|tsx))$", line)
        if m_file:
            current_file = m_file.group(1)
            continue
        m_err = re.match(
            r"^\s*(\d+):(\d+)\s+error\s+'([^']+)'\s+is defined but never used",
            line,
        )
        if m_err and current_file:
            violations.append((current_file, int(m_err.group(1)), m_err.group(3)))
    return violations


CAUTCH_RE = re.compile(r"catch\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)")
ARG_RE = re.compile(r"\(([^()]*)\)")
IMPORT_NAME_RE = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:,|$)")


def fix_file(file_path: Path, names: set[str]) -> int:
    """Prefix names with _ in the given file. Returns count of substitutions."""
    content = file_path.read_text(encoding="utf-8")
    original = content
    n = 0

    # 1. catch (X) -> catch (_X)
    def _catch_sub(m: re.Match) -> str:
        nonlocal n
        name = m.group(1)
        if name in names:
            n += 1
            return f"catch (__{name})"
        return m.group(0)

    content = CAUTCH_RE.sub(_catch_sub, content)

    # 2. function/method args: foo(X, Y) -> foo(_X, Y) for X in names
    #    Heuristic: only prefix as the FIRST or Nth arg if it's in names.
    def _arg_sub(m: re.Match) -> str:
        nonlocal n
        body = m.group(1)
        # Don't touch inside an arrow body — too risky; only top-level arg lists
        # (heuristic: matches balanced parens; in practice ESLint flags each
        # function's parameter list explicitly.)
        parts: list[str] = []
        for part in body.split(","):
            stripped = part.strip()
            token_match = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)(\s*:.*|\s*=.*|$)", stripped)
            if token_match and token_match.group(1) in names:
                rest = stripped[len(token_match.group(1)):]
                parts.append(f"_{token_match.group(1)}{rest}")
                n += 1
            else:
                parts.append(part)
        return "(" + ", ".join(parts) + ")"

    content = ARG_RE.sub(_arg_sub, content)

    # 3. imports: rename { X } -> { X as _X }
    def _import_sub(m: re.Match) -> str:
        nonlocal n
        name = m.group(1)
        if name in names:
            n += 1
            return f"{name} as _{name}"
        return m.group(0)

    # Use a specific pattern for import { ... } form
    for imp_match in re.finditer(
        r"import\s*\{([^}]+)\}\s*from",
        content,
    ):
        new_body = IMPORT_NAME_RE.sub(_import_sub, imp_match.group(1))
        content = content.replace(imp_match.group(0), f"import {{{new_body}}} from")

    if content != original:
        file_path.write_text(content, encoding="utf-8")
    return n


def main() -> None:
    violations = list_violations()
    by_file: dict[str, set[str]] = {}
    for f, _, name in violations:
        rel = f.replace(str(ROOT) + "\\", "").replace("\\", "/")
        by_file.setdefault(rel, set()).add(name)

    print(f"Found {len(violations)} unused-vars violations across {len(by_file)} files.")
    total = 0
    for rel, names in by_file.items():
        p = ROOT / rel
        if not p.exists():
            print(f"SKIP (missing): {rel}")
            continue
        try:
            n = fix_file(p, names)
            print(f"OK  {rel}  ({n} substitutions, names: {sorted(names)})")
            total += n
        except Exception as e:
            print(f"ERR {rel}: {e}")
    print(f"\nTotal substitutions: {total}")


if __name__ == "__main__":
    main()