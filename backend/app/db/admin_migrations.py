"""
Fanaa Admin — analytics schema startup migration.

Runs alongside `run_migrations()` so the same Postgres database that already
holds orders/order_items/order_events also exposes the admin dashboard's
tables (visitor, session, event, order_mirror, traffic_quality, …).

Why we don't depend on Prisma CLI:
   • The backend container is a slim Python image — no Node, no npx.
   • Production deploys must not require the operator to SSH in and run
     extra commands. Boot must be idempotent and self-healing.

How it works:
   1. We bundle `admin_schema.sql` in the same package (lives in the
      same `backend/app/db/` directory, so the Docker `COPY . /home/app/api`
      step picks it up automatically).
   2. The lifespan hook in `app/main.py` calls `run_migrations()` (already
      wired). `run_migrations()` invokes `run_admin_migrations()` after
      the SQLAlchemy `create_all()`.
   3. The SQL itself is fully idempotent — `CREATE … IF NOT EXISTS` for
      tables/indexes, `DO $$ … EXCEPTION WHEN duplicate_object` for FKs.
      Safe to re-run on every boot.
   4. A `_admin_schema_version` row records that v1 was applied. Future
      schema bumps gate their work behind a version check in the same SQL
      file.

Known landmine — asyncpg + comment-only statements
──────────────────────────────────────────────────
asyncpg's `Connection.execute()` uses the extended query protocol. When
the only content of the "statement" string is SQL comments (e.g. the
trailing template block at the bottom of `admin_schema.sql`), Postgres
replies with no CommandComplete tag and asyncpg's response decoder
trips with:

    AttributeError: 'NoneType' object has no attribute 'decode'

This used to crash FastAPI's lifespan migration. The splitter below
now strips comments BEFORE deciding whether a chunk is empty, so any
comment-only block is dropped on the floor instead of being shipped to
asyncpg. This makes the migration robust to:
    • the trailing template block at EOF (no terminating `;`)
    • comment-only sections between real statements
    • SQL files where someone adds documentation between blocks
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncConnection

log = logging.getLogger(__name__)

# Resolve once at import — `Path(__file__).parent` is /home/app/api/app/db/
# inside the runtime image. The SQL file ships in the same package.
_SQL_PATH = Path(__file__).parent / "admin_schema.sql"


async def run_admin_migrations(conn: AsyncConnection) -> None:
    """Idempotent — applies missing admin tables / indexes / FKs.

    Uses the caller's connection so this runs in the same lifespan
    transaction window as `Base.metadata.create_all`. Goes directly
    through asyncpg's driver connection so DO $$ blocks and BIGSERIAL
    pass through unchanged.
    """
    if not _SQL_PATH.exists():
        log.warning(
            "admin_schema.sql not found — admin tables will be missing",
            extra={"expected_at": str(_SQL_PATH)},
        )
        return

    sql = _SQL_PATH.read_text(encoding="utf-8")
    statements = _split_sql_statements(sql)
    log.info(
        "applying admin schema migrations",
        extra={"sql_bytes": len(sql), "executable_statements": len(statements)},
    )

    raw = await conn.get_raw_connection()
    driver_conn = raw.driver_connection  # asyncpg.Connection

    for idx, stmt in enumerate(statements, start=1):
        try:
            await driver_conn.execute(stmt)
        except Exception as exc:
            # Surface the OFFENDING statement (truncated) in container
            # logs so future asyncpg edge cases are diagnosable without
            # SSH access. We re-raise so the lifespan still fails loud
            # — silent half-migrations would leave the admin DB in an
            # inconsistent state.
            preview = _preview(stmt)
            log.error(
                "admin migration statement failed",
                extra={
                    "statement_index": idx,
                    "of_total": len(statements),
                    "error_type": type(exc).__name__,
                    "error": str(exc)[:240],
                    "preview": preview,
                },
            )
            raise

    log.info(
        "admin schema migrations done",
        extra={"statements": len(statements)},
    )


# ─── SQL parsing helpers ──────────────────────────────────────────────────


def _preview(stmt: str, limit: int = 120) -> str:
    """Single-line preview of a SQL statement for log lines."""
    flat = " ".join(stmt.split())
    return flat[:limit] + ("…" if len(flat) > limit else "")


# Pre-compiled comment matchers. `re.DOTALL` lets `/* … */` span lines.
_LINE_COMMENT_RE = re.compile(r"--[^\n]*")
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", flags=re.DOTALL)


def _strip_comments(stmt: str) -> str:
    """Remove SQL line + block comments. Leaves quoted strings alone.

    We don't try to be clever about comments INSIDE quoted strings —
    the splitter already prevents `;` inside quotes from terminating a
    statement, and this helper is only used to decide whether a chunk
    contains executable SQL. Misclassifying a quoted `--` is harmless.
    """
    no_block = _BLOCK_COMMENT_RE.sub("", stmt)
    no_line = _LINE_COMMENT_RE.sub("", no_block)
    return no_line


def _has_executable_sql(stmt: str) -> bool:
    """True iff `stmt` has at least one non-comment, non-whitespace token.

    This is the asyncpg landmine guard. Statements that strip down to
    nothing but whitespace MUST NOT be sent to `Connection.execute()`,
    or asyncpg raises:

        AttributeError: 'NoneType' object has no attribute 'decode'

    because Postgres returns no CommandComplete tag for comment-only
    queries on the extended protocol path.
    """
    return bool(_strip_comments(stmt).strip())


def _split_sql_statements(sql: str) -> list[str]:
    """Split a `.sql` file into individual statements asyncpg can execute.

    Rules:
      • Postgres `DO $$ … $$;` blocks contain semicolons — naïve splitting
        on `;` would shatter them. We track `$$` toggles and only split
        on a semicolon when we're outside a dollar-quoted block AND
        outside a standard quoted string.
      • Single-line `-- comment` and block `/* … */` comments are kept
        in the buffer so the original SQL line numbering is preserved
        when an executor reports an error, but a statement that contains
        NOTHING but comments after stripping is dropped (see
        `_has_executable_sql` for the asyncpg rationale).
    """
    out: list[str] = []
    buf: list[str] = []
    in_dollar = False
    in_single = False
    in_block_comment = False
    in_line_comment = False
    i = 0
    while i < len(sql):
        c = sql[i]
        nxt = sql[i + 1] if i + 1 < len(sql) else ""

        if in_line_comment:
            buf.append(c)
            if c == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            buf.append(c)
            if c == "*" and nxt == "/":
                buf.append(nxt)
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if not in_dollar and not in_single:
            if c == "-" and nxt == "-":
                in_line_comment = True
                buf.append(c)
                i += 1
                continue
            if c == "/" and nxt == "*":
                in_block_comment = True
                buf.append(c)
                i += 1
                continue

        if not in_dollar and c == "'":
            in_single = not in_single
            buf.append(c)
            i += 1
            continue

        if not in_single and c == "$" and nxt == "$":
            in_dollar = not in_dollar
            buf.append("$$")
            i += 2
            continue

        if c == ";" and not in_dollar and not in_single:
            stmt = "".join(buf).strip()
            if stmt and _has_executable_sql(stmt):
                out.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(c)
        i += 1

    # Tail capture for files that don't end with `;` — same filter
    # applied so the trailing comment template at EOF doesn't trip
    # asyncpg.
    tail = "".join(buf).strip()
    if tail and _has_executable_sql(tail):
        out.append(tail)
    return out


# ─── Self-test entry point ────────────────────────────────────────────────
#
# Lets a developer (or CI) run:
#
#     python -m app.db.admin_migrations
#
# to validate the splitter against the bundled `admin_schema.sql` without
# spinning up Postgres. Exits non-zero on any structural problem so the
# error is loud.

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if not _SQL_PATH.exists():
        log.error("admin_schema.sql missing at %s", _SQL_PATH)
        sys.exit(1)

    raw_sql = _SQL_PATH.read_text(encoding="utf-8")
    parsed = _split_sql_statements(raw_sql)
    log.info("parsed %d executable statements from %d bytes", len(parsed), len(raw_sql))

    # Sanity-check every emitted statement is non-empty after stripping —
    # this is the exact invariant that prevents the asyncpg crash.
    bad = [
        (n, s) for n, s in enumerate(parsed, start=1) if not _has_executable_sql(s)
    ]
    if bad:
        log.error("found %d comment-only statements (would crash asyncpg):", len(bad))
        for n, s in bad:
            log.error("  #%d: %s", n, _preview(s))
        sys.exit(2)

    # Print a one-line preview for every statement so the developer can
    # eyeball what will be executed.
    for n, s in enumerate(parsed, start=1):
        print(f"  {n:>3}. {_preview(s)}")

    print(f"\nOK — {len(parsed)} statements, none comment-only.")
