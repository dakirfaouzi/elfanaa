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
"""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

log = logging.getLogger(__name__)

# Resolve once at import — `Path(__file__).parent` is /home/app/api/app/db/
# inside the runtime image. The SQL file ships in the same package.
_SQL_PATH = Path(__file__).parent / "admin_schema.sql"


async def run_admin_migrations(conn: AsyncConnection) -> None:
    """Idempotent — applies missing admin tables / indexes / FKs.

    Uses the caller's connection so this runs in the same lifespan
    transaction window as `Base.metadata.create_all`. We `exec_driver_sql`
    (rather than `conn.execute(text(...))`) so the entire file — including
    DO $$ blocks and BIGSERIAL — passes through as a single batch the way
    `psql -f` would.
    """
    if not _SQL_PATH.exists():
        log.warning(
            "admin_schema.sql not found — admin tables will be missing",
            extra={"expected_at": str(_SQL_PATH)},
        )
        return

    sql = _SQL_PATH.read_text(encoding="utf-8")
    log.info("applying admin schema migrations", extra={"sql_bytes": len(sql)})

    # asyncpg's driver doesn't support multi-statement strings the way
    # `psql` does, so we feed each top-level statement separately. The
    # split is conservative — DO $$ blocks and quoted strings keep their
    # semicolons because we strip line comments first and then split on
    # bare semicolons at end of line.
    statements = _split_sql_statements(sql)
    raw = await conn.get_raw_connection()
    driver_conn = raw.driver_connection  # asyncpg.Connection
    for stmt in statements:
        await driver_conn.execute(stmt)
    log.info("admin schema migrations done", extra={"statements": len(statements)})


def _split_sql_statements(sql: str) -> list[str]:
    """Split a `.sql` file into individual statements asyncpg can execute.

    Postgres `DO $$ … $$;` blocks contain semicolons — naïve splitting on
    `;` would shatter them. We track `$$` toggles and only split on a
    semicolon when we're outside a dollar-quoted block AND outside a
    standard quoted string.
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
            if stmt:
                out.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(c)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        out.append(tail)
    return out
