from sqlalchemy import Engine, inspect, text
from crypto_utils import encrypt_secret, ENC_PREFIX

COLUMN_MIGRATIONS = [
    (
        "0001_saved_leads_reminders",
        [
            ("saved_leads", "reminder_at", "ALTER TABLE saved_leads ADD COLUMN reminder_at DATETIME"),
            ("saved_leads", "reminder_note", "ALTER TABLE saved_leads ADD COLUMN reminder_note VARCHAR"),
            ("saved_leads", "reminder_completed", "ALTER TABLE saved_leads ADD COLUMN reminder_completed BOOLEAN DEFAULT FALSE"),
        ],
    ),
    (
        "0002_users_gemini_api_key",
        [
            ("users", "gemini_api_key", "ALTER TABLE users ADD COLUMN gemini_api_key VARCHAR"),
        ],
    ),
    (
        "0004_users_company_name",
        [
            ("users", "company_name", "ALTER TABLE users ADD COLUMN company_name VARCHAR"),
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
                "applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
                ")"
            )
        )
        applied_rows = conn.execute(text("SELECT version FROM schema_migrations")).fetchall()
        applied = {row[0] for row in applied_rows}

        inspector = inspect(conn)
        existing_tables = set(inspector.get_table_names())

        for version, steps in COLUMN_MIGRATIONS:
            if version in applied:
                continue
            for table_name, col_name, sql_stmt in steps:
                if table_name in existing_tables:
                    existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                    if col_name not in existing_cols:
                        conn.execute(text(sql_stmt))
            conn.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:v)"),
                {"v": version},
            )

        # Mevcut düz metin Gemini API anahtarlarını Fernet ile şifrele
        if "0003_encrypt_existing_gemini_keys" not in applied:
            if "users" in existing_tables:
                rows = conn.execute(
                    text("SELECT id, gemini_api_key FROM users WHERE gemini_api_key IS NOT NULL")
                ).fetchall()
                for user_id, raw_key in rows:
                    if raw_key and not str(raw_key).startswith(ENC_PREFIX):
                        enc = encrypt_secret(str(raw_key))
                        conn.execute(
                            text("UPDATE users SET gemini_api_key = :k WHERE id = :uid"),
                            {"k": enc, "uid": user_id},
                        )
            conn.execute(
                text("INSERT INTO schema_migrations (version) VALUES (:v)"),
                {"v": "0003_encrypt_existing_gemini_keys"},
            )

        conn.commit()
