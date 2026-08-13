#date_validator.py
import datetime

DATE_FORMAT = "%Y-%m-%d"


def is_valid_date(value, fmt=DATE_FORMAT):
    """Validates that value is a string in the given date format and
    represents a real calendar date (e.g. rejects 2024-02-30)."""
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value:
        return False
    try:
        datetime.datetime.strptime(value, fmt)
        return True
    except ValueError:
        return False


def is_not_future_date(value, fmt=DATE_FORMAT):
    """Validates that a date string does not lie in the future. Used for
    date_of_birth, where a future date makes no sense."""
    if not is_valid_date(value, fmt):
        return False
    parsed = datetime.datetime.strptime(value.strip(), fmt).date()
    return parsed <= datetime.date.today()


def convert_string_to_date(value, fmt=DATE_FORMAT):
    """Converts a valid date string to a datetime.date object. Returns the
    original value unchanged if it isn't a valid date string."""
    if is_valid_date(value, fmt):
        return datetime.datetime.strptime(value.strip(), fmt).date()
    return value