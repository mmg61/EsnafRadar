from sqlalchemy import Engine, text

MIGRATIONS = [
    (
        "0001_saved_leads_reminders",
        [
            ("saved_leads", "reminder_at", "ALTER TABLE saved_leads ADD COLUMN reminder_at DATETIME"),
            ("saved_leads", "reminder_note", "ALTER TABLE saved_leads ADD COLUMN reminder_note VARCHAR"),
            ("saved_leads", "reminder_completed", "ALTER TABLE saved_leads ADD COLUMN reminder_completed BOOLEAN DEFAULT 0"),
        ],
    ),
    (
        "0002_users_gemini_api_key",
        [
            ("users", "gemini_api_key", "ALTER TABLE users ADD COLUMN gemini_api_key VARCHAR"),
        ],
    ),
]


def run_migrations(engine: Engine) -> None:
    """Sürüm takipli veritabanı şema geçişlerini (schema_migrations) çalıştırır."""
    with engine.connect() as conn:
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS schema_migrations ("
                "version VARCHAR PRIMARY KEY, "
                "applied_at DATETIME DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )
        applied_rows = conn.execute(text("SELECT version FROM schema_migrations")).fetchall()
        applied = {row[0] for row in applied_rows}

        for version, steps in MIGRATIONS:
            if version in applied:
                continue
            for table_name, col_name, sql_stmt in steps:
                info_rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                existing_cols = {r[1] for r in info_rows}
                if col_name not in existing_cols:
                    conn.execute(text(sql_stmt))
            conn.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:v)"),
                {"v": version},
            )
        conn.commit()
