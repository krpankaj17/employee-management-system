#input_validators.py

VALID_EMPLOYEE_STATUSES = {"active", "inactive", "on_leave", "terminated"}


def is_empty(value):
    """
    This function takes the input and validates if the input value is empty or not.
    It returns a Boolean value True or False.
    """
    if not isinstance(value, str):
        return False
    if not value:
        return True
    elif not value.strip():
        return True
    else:
        return False


def is_integer(value):
    """
    This function takes the value and validates if the input value is an Integer or not.
    It returns a Boolean value.
    """ 
    if isinstance(value, int):
        return True
    if not isinstance(value, str):
        return False
    value = value.strip()
    if value.startswith(("-", "+")):
        value = value[1:]
    return value.isdigit()


def is_decimal(value):
    """
    It takes the value as parameter and validates that the entered value is a
    decimal point/float value. It returns a Boolean value.
    """
    if isinstance(value, float):
        return True
    if not isinstance(value, str):
        return False
    try:
        float(value)
        return True
    except ValueError:
        return False


def is_string(value):
    """
    This function takes input in the parameter and validates that the value is
    a String or not. It returns a Boolean value.
    """
    return isinstance(value, str)


def is_none(value):
    """
    This takes the user input and validates that the input parameter is None or
    not and returns a Boolean value for that.
    """
    if not isinstance(value, str):
        return value is None
    if value.lower().strip() in ("none", "null", ""):
        return True
    return False


def is_valid_employee_status(value):
    """Validates that value is one of the recognized employee lifecycle
    states: active, inactive, on_leave, terminated."""
    if not isinstance(value, str):
        return False
    return value.strip().lower() in VALID_EMPLOYEE_STATUSES