"""Pytest fixtures for API tests with isolated SQLite."""

from __future__ import annotations

import struct
import zlib
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import (
    _migrate_sqlite_content_factory_cover_styles,
    _migrate_sqlite_content_factory_drafts,
    _migrate_sqlite_cover_styles_global_scope,
    _migrate_sqlite_cover_styles_reference_image_path,
    _migrate_sqlite_cover_styles_design_analysis,
    _migrate_sqlite_discovery_cache_tables,
    _migrate_sqlite_project_libraries,
    _migrate_sqlite_repair_orphan_tag_categories,
    get_db,
)
from app.main import app
from app.models import Base  # noqa: F401 — register models
from sqlalchemy import event


def make_test_cover_png(width: int = 1242, height: int = 1660) -> bytes:
    """构造带 IHDR 的最小合法 PNG，满足 validate_cover_png 尺寸校验。"""

    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return (
            struct.pack(">I", len(data))
            + chunk_type
            + data
            + struct.pack(">I", crc)
        )

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw_rows = b"".join(b"\x00" + b"\xff\x00\x00" * width for _ in range(height))
    compressed = zlib.compress(raw_rows, 9)
    return signature + png_chunk(b"IHDR", ihdr_data) + png_chunk(b"IDAT", compressed) + png_chunk(b"IEND", b"")


@pytest_asyncio.fixture
async def client(tmp_path) -> AsyncGenerator[AsyncClient, None]:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test.db'}"
    engine = create_async_engine(db_url)

    @event.listens_for(engine.sync_engine, "connect")
    def _test_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_sqlite_project_libraries)
        await conn.run_sync(_migrate_sqlite_discovery_cache_tables)
        await conn.run_sync(_migrate_sqlite_content_factory_drafts)
        await conn.run_sync(_migrate_sqlite_content_factory_cover_styles)
        await conn.run_sync(_migrate_sqlite_cover_styles_global_scope)
        await conn.run_sync(_migrate_sqlite_cover_styles_reference_image_path)
        await conn.run_sync(_migrate_sqlite_cover_styles_design_analysis)
        await conn.run_sync(_migrate_sqlite_repair_orphan_tag_categories)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test/api") as ac:
        yield ac

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(tmp_path) -> AsyncGenerator[AsyncSession, None]:
    db_url = f"sqlite+aiosqlite:///{tmp_path / 'test_style.db'}"
    engine = create_async_engine(db_url)

    @event.listens_for(engine.sync_engine, "connect")
    def _test_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_sqlite_project_libraries)
        await conn.run_sync(_migrate_sqlite_content_factory_drafts)
        await conn.run_sync(_migrate_sqlite_content_factory_cover_styles)
        await conn.run_sync(_migrate_sqlite_cover_styles_global_scope)
        await conn.run_sync(_migrate_sqlite_cover_styles_reference_image_path)
        await conn.run_sync(_migrate_sqlite_cover_styles_design_analysis)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()
