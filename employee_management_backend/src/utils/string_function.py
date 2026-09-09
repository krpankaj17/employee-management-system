#string_function.py
from .input_validators import is_integer, is_decimal


def has_duplicate(value):
    """This function takes the input parameter and returns whether the value
    contains a duplicate element or not."""
    my_set = set()
    for element in value:
        if element in my_set:
            return True
        my_set.add(element)
    return False


def convert_string_to_integer(value):
    """
    This function takes the string value and validates that it can be converted
    to an Integer, and converts it into an Integer. Non-string values
    (already int/float) are returned unchanged.
    """
    if isinstance(value, str) and is_integer(value):
        value = int(value.strip())
    return value


def convert_string_to_decimal(value):
    """
    This function takes the string value and validates that it can be converted
    to a float, and converts it into a float. Non-string values
    (already int/float) are returned unchanged.
    """
    if isinstance(value, str) and is_decimal(value):
        value = float(value.strip())
    return value