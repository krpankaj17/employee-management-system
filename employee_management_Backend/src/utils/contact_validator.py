#contact_validator.py
import re

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_PATTERN = re.compile(r"^\d{10}$")


def is_valid_email(value):
    """Basic structural check: something@something.something, no spaces."""
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value:
        return False
    return bool(EMAIL_PATTERN.match(value))


def is_valid_phone(value):
    """Accepts exactly 10 digits, nothing else. Strips spaces and hyphens
    before checking so '9933 123 290' or '9933-123-290' pass, but rejects
    anything shorter/longer, and rejects a leading + / country code."""
    if not isinstance(value, str):
        return False
    value = value.strip().replace(" ", "").replace("-", "")
    if not value:
        return False
    return bool(PHONE_PATTERN.match(value))