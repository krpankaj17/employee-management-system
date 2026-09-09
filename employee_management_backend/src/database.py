# database.py
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Locate and load the .env file from src directory or project root
ENV_PATHS = [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
]

for env_file in ENV_PATHS:
    if env_file.exists():
        load_dotenv(dotenv_path=env_file)
        break
else:
    load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL is not set. Please ensure it is defined in your .env file."
    )

# Create SQLAlchemy engine
# pool_pre_ping=True checks connections before using them to prevent stale connection drops
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Session factory for handling database operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative ORM models
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a database session to endpoints
    and ensures it is properly closed when the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection():
    """
    Tests the database connection and returns connection status and details.
    """
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT current_database(), current_user, version();"))
            row = result.fetchone()
            if row:
                return {
                    "status": "connected",
                    "database": str(row[0]),
                    "user": str(row[1]),
                    "version": str(row[2]),
                }
            return {
                "status": "error",
                "error": "No data returned from database connection test",
            }
    except Exception as exc:
        return {
            "status": "error",
            "error": str(exc),
        }
