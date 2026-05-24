"""Async SQLAlchemy engine, session, and table creation."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models import AppSetting, Base, Folder, FolderTag, Project, ProjectTag, Tag, TagCategory  # noqa: F401

engine = create_async_engine(
    settings.database_url,
    echo=False,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


def _migrate_sqlite_add_folder_sort_order(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("folders"):
        return
    cols = {c["name"] for c in insp.get_columns("folders")}
    if "sort_order" not in cols:
        sync_conn.execute(
            text("ALTER TABLE folders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
        )


def _migrate_sqlite_add_project_folder_id(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("projects"):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    if "folder_id" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN folder_id INTEGER"))


def _migrate_sqlite_add_project_github_card_columns(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("projects"):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    if "topics" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN topics TEXT"))
    if "forks" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN forks INTEGER NOT NULL DEFAULT 0"))
    if "github_pushed_at" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN github_pushed_at TEXT"))
    if "github_release_tag" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN github_release_tag TEXT"))


def _migrate_sqlite_add_project_deleted_at(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("projects"):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    if "deleted_at" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN deleted_at TEXT"))


def _migrate_sqlite_tags_category_and_drop_tag_type(sync_conn) -> None:
    """旧库：tags.tag_type → category_id；新列可为空表示未分类。"""
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("tags"):
        return
    cols = {c["name"] for c in insp.get_columns("tags")}
    if "category_id" not in cols:
        sync_conn.execute(
            text(
                "ALTER TABLE tags ADD COLUMN category_id INTEGER "
                "REFERENCES tag_categories(id) ON DELETE SET NULL"
            )
        )
    if "tag_type" in cols:
        sync_conn.execute(text("DROP INDEX IF EXISTS ix_tags_tag_type"))
        sync_conn.execute(text("ALTER TABLE tags DROP COLUMN tag_type"))


def _migrate_sqlite_projects_github_url_allow_duplicates(sync_conn) -> None:
    """去掉 github_url 唯一约束，允许同一仓库多次入库（旧库可能为 UNIQUE 索引或 sqlite_autoindex_*）。"""
    from sqlalchemy import inspect, text

    if sync_conn.dialect.name != "sqlite":
        return

    insp = inspect(sync_conn)
    if not insp.has_table("projects"):
        return

    for ix in insp.get_indexes("projects"):
        if not ix.get("unique"):
            continue
        cols = tuple(ix.get("column_names") or ())
        if cols == ("github_url",):
            sync_conn.execute(text(f'DROP INDEX IF EXISTS "{ix["name"]}"'))

    rows = sync_conn.execute(text("PRAGMA index_list('projects')")).fetchall()
    for row in rows:
        # seq, name, unique, origin, partial
        idx_name, unique_flag = row[1], row[2]
        if not unique_flag:
            continue
        info = sync_conn.execute(text(f'PRAGMA index_info("{idx_name}")')).fetchall()
        col_names = [r[2] for r in info] if info else []
        if col_names == ["github_url"]:
            sync_conn.execute(text(f'DROP INDEX IF EXISTS "{idx_name}"'))

    sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_projects_github_url ON projects (github_url)"))


def _migrate_sqlite_add_project_notes(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("projects"):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    if "notes" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN notes TEXT"))


def _migrate_sqlite_folder_description_and_tags(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if insp.has_table("folders"):
        cols = {c["name"] for c in insp.get_columns("folders")}
        if "description" not in cols:
            sync_conn.execute(text("ALTER TABLE folders ADD COLUMN description TEXT"))
    if not insp.has_table("folder_tags"):
        sync_conn.execute(
            text(
                "CREATE TABLE folder_tags ("
                "folder_id INTEGER NOT NULL, "
                "tag_id INTEGER NOT NULL, "
                "PRIMARY KEY (folder_id, tag_id), "
                "FOREIGN KEY(folder_id) REFERENCES folders (id) ON DELETE CASCADE, "
                "FOREIGN KEY(tag_id) REFERENCES tags (id) ON DELETE CASCADE, "
                "CONSTRAINT uq_folder_tag UNIQUE (folder_id, tag_id)"
                ")"
            )
        )


def _migrate_sqlite_add_project_translation_columns(sync_conn) -> None:
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if not insp.has_table("projects"):
        return
    cols = {c["name"] for c in insp.get_columns("projects")}
    if "description_translated" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN description_translated TEXT"))
    if "readme_translated" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN readme_translated TEXT"))
    if "translation_target_lang" not in cols:
        sync_conn.execute(text("ALTER TABLE projects ADD COLUMN translation_target_lang TEXT"))


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_migrate_sqlite_folder_description_and_tags)
        await conn.run_sync(_migrate_sqlite_add_folder_sort_order)
        await conn.run_sync(_migrate_sqlite_add_project_folder_id)
        await conn.run_sync(_migrate_sqlite_add_project_github_card_columns)
        await conn.run_sync(_migrate_sqlite_add_project_deleted_at)
        await conn.run_sync(_migrate_sqlite_tags_category_and_drop_tag_type)
        await conn.run_sync(_migrate_sqlite_projects_github_url_allow_duplicates)
        await conn.run_sync(_migrate_sqlite_add_project_notes)
        await conn.run_sync(_migrate_sqlite_add_project_translation_columns)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session
