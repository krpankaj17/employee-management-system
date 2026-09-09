#numeric_validator.py
import math

from .input_validators import is_integer, is_decimal
from .string_function import convert_string_to_integer, convert_string_to_decimal

MAX_NUMERIC_VALUE = 1_000_000_000_000  # one trillion


def is_positive_integer(value):
    """It takes the input parameter and validates whether it is a positive
    integer or not. Also rejects values too large to be a sane input (avoids
    overflow further down the pipeline)."""
    if not is_integer(value):
        return False
    value = convert_string_to_integer(value)
    if not isinstance(value, int):
        return False
    if value <= 0 or value > MAX_NUMERIC_VALUE:
        return False
    return True


def is_positive_decimal(value):
    """It takes the input parameter and validates whether it is a positive
    decimal or not. Also rejects inf/nan and values too large to be a sane
    input, since float('999...') silently becomes inf instead of raising."""
    if not is_decimal(value):
        return False
    value = convert_string_to_decimal(value)
    if not isinstance(value, float):
        return False
    if not math.isfinite(value):
        return False
    if value <= 0 or value > MAX_NUMERIC_VALUE:
        return False
    return True


def is_valid_pincode(value, min_len=4, max_len=10):
    """Validates a pincode is a non-negative integer with a plausible digit
    count. min_len/max_len are generous defaults since pincode formats vary
    by country (e.g. India: 6 digits, US ZIP: 5)."""
    if not is_integer(value):
        return False
    text = str(value).strip()
    if text.startswith(("-", "+")):
        return False
    return min_len <= len(text) <= max_len


def _safe_convert(value):
    """Converts a numeric string to int/float, returning None if it can't be
    converted or overflows/becomes non-finite."""
    if is_integer(value):
        number = convert_string_to_integer(value)
        return number if isinstance(number, int) else None
    if is_decimal(value):
        number = convert_string_to_decimal(value)
        if not isinstance(number, float) or not math.isfinite(number):
            return None
        return number
    return None


def is_value_between(value, minimum, maximum):
    """This takes the user input and checks whether the input value lies
    between the minimum and maximum (inclusive)."""
    minimum = _safe_convert(minimum)
    if minimum is None:
        return False

    maximum = _safe_convert(maximum)
    if maximum is None:
        return False

    if maximum < minimum:
        return False

    value = _safe_convert(value)
    if value is None:
        return False

    return minimum <= value <= maximum