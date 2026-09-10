# src/core/config.py
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+psycopg://postgres:root@localhost:5432/employee_management"
    JWT_SECRET_KEY: str = "e83b4cf7d9021a8c3214589d9e07890123456789abcdef0123456789abcdef01"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30     # 30 days
    APP_NAME: str = "Employee Management System API"
    APP_VERSION: str = "2.0.0"

    # SMTP Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_FROM_NAME: str = "Datansh Employee Management"
    OTP_EXPIRATION_SECONDS: int = 150  # 2.5 minutes
    # HTTP Email Provider (Bypasses cloud provider SMTP firewall blocks)
    RESEND_API_KEY: str | None = None
    # Google Apps Script Email Relay (Sends from Gmail over HTTPS port 443 to any recipient)
    GMAIL_WEBHOOK_URL: str | None = "https://script.google.com/macros/s/AKfycbzHyVF5NqDw-x5k5nZMTaQ5Tn74GLtyPMW_01NjIMA2pHLGG8RjNBG4HiljQqHPRYgv/exec"
    GMAIL_WEBHOOK_SECRET: str = "EMS_SECURE_TOKEN_2026"
    VALKEY_URL: str = "redis://localhost:6379/1"



settings = Settings()
