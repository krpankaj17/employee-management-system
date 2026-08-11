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
    to an Integer, and converts it into an Integer. Returns the original value
    unchanged if it isn't a valid/convertible integer (e.g. too many digits).
    """
    if is_integer(value):
        try:
            value = int(value.strip())
        except (OverflowError, ValueError):
            return value
    return value


def convert_string_to_decimal(value):
    """
    This function takes the string value and validates that it can be converted
    to a float, and converts it into a float. Returns the original value
    unchanged if it isn't a valid/convertible decimal.
    """
    if is_decimal(value):
        try:
            value = float(value.strip())
        except (OverflowError, ValueError):
            return value
    return value
def remove_extra_spaces(value):
    """This function takes a string and removes only the extra/duplicate
    spaces, returning the cleaned string."""
    return " ".join(value.split())


def remove_spaces(value):
    """This function takes the input string and removes all spaces from it."""
    return value.replace(" ", "")
