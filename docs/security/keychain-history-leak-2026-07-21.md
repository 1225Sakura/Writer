---
title: API Key Historical Leak — Decision Record
date: 2026-07-21
status: accepted (option a)
related: docs/plans/ralplan-comprehensive-audit-2026-07-21-v0.4.md
---

# API Key Historical Leak — Decision Record

## Context

During v0.4 patch P0-Doc-A (US-002) implementation, the security acceptance criterion
`git log --all -p -S 'writer-local-key-change-me' -- src/ | wc -l == 0` was found to be
**violated by 81 historical commits** (April-July 2026).

The default API key `writer-local-key-change-me` was committed to
`src/backend/app/config.py:44` in feature/auth-impl branch development. Although
the key is for local desktop use only (not internet-facing), the value being
predictable constitutes a P-MINIMAL-SECRET concern.

## Options Considered

| Option | Description | Risk |
|--------|-------------|------|
| (a) Accept historical leak + future commits no key | Document leak; rely on P0-Sec1a to prevent future occurrences | LOW — main branch is local-only (1 contributor) |
| (b) git filter-repo purge + force-push | Rewrite all 81 commits; collaborators must rebase | HIGH — destructive; disproportionate for local-only |
| (c) BFG Repo-Cleaner | Faster than filter-repo; same rewrite | HIGH — same as (b) but faster |
| (d) Leave as-is with documentation | No action beyond docs | SAME AS (a) |

## Decision

**Option (a)** — Accept historical leak + future commits no key.

**Rationale**:
- Main branch is local-only (1 contributor) — git filter-repo (b) requires
  force-push + collaborator rebase, disproportionate for solo dev
- P0-Sec1a (US-008) already replaced `src/backend/app/config.py:44` default to
  empty string + AES-GCM + OS keychain — future commits will NOT contain
  the literal default key
- The 81-commit leak is bounded to local development; no internet exposure
- P1-CI2 may revisit if more collaborators join

## Follow-up Actions

1. ✅ `src/backend/app/config.py:44` default replaced with empty string
   (P0-Sec1a US-008, commit `5b59c93`)
2. ✅ AES-GCM + python-keyring (OS keychain) implemented (P0-Sec1a)
3. ✅ WS ticket system for short-lived auth (P0-Sec1b PR-4, US-012)
4. ⏳ CI grep guard for future commits:
   `git log HEAD..HEAD~0 -p | grep -E 'writer-local-key-change-me' | wc -l == 0`
   (Defer to P1-CI2 — needs CI workflow infrastructure)
5. ⏳ P1-CI2: reassess if more collaborators join

## References

- v0.4 spec §2.4 finding F-E-13 (P-A02a)
- v0.4 spec §5.1 P0-Doc-A acceptance criteria
- PRD story US-024
- Backed up bundle: `.omc/bundles/pre-hygiene-2026-07-21.bundle` (41MB)
- Pre-hygiene tag: `pre-p0-hygiene-2026-07-21`