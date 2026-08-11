import math

from .input_validators import is_integer, is_decimal
from .string_function import convert_string_to_integer, convert_string_to_decimal

# Generic sanity cap. Nothing about an employee record (age, salary, id) should
# ever realistically need a number bigger than this, and it keeps every
# numeric field well clear of float overflow (~1.8e308) and Python's built-in
# int-from-string digit limit (4300 digits by default).
MAX_NUMERIC_VALUE = 1_000_000_000_000  # one trillion


def is_positive_integer(value):
    """It takes the input parameter and validates whether it is a positive
    integer or not. Also rejects values too large to be a sane input (avoids
    overflow further down the pipeline)."""
    if not is_integer(value):
        return False
    value = convert_string_to_integer(value)
    if not isinstance(value, int):
        # conversion failed (e.g. thousands of digits) and the original
        # string was handed back unchanged
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
    value = convert_string_to_decimal(value.strip())
    if not isinstance(value, float):
        return False
    if not math.isfinite(value):
        return False
    if value <= 0 or value > MAX_NUMERIC_VALUE:
        return False
    return True


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
    between the minimum and maximum (inclusive).

    Parameters:
        value   - the value to compare
        minimum - the minimum bound
        maximum - the maximum bound
    """
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