def is_empty (value):
  """This function takes the input and validates if the input value is empty or not.It returns Boolean value True or False. """
  if not value :
    return True
  elif not value.strip():
    return True 
  else:
    return False
  
def is_integer(value):
  """
  This function takes the value and validates if the input value is a Integer or not it return Boolean value.
  """
  return value.isdigit()

def is_decimal(value):
  """
  It takes the value as parameter and validates that the entered value is a decimal point/float value it return Boolean value. """
  try:
      float(value)
      return True
  except ValueError:
        return False
      
def is_string(value):
  """This funtion takes input in the parameter and validates that the value is String or not it returns Boolean value."""
  return type(value)==str
def is_none(value):
  """This takes the user input and validates that the input parameter is None or not and return Boolean value for that."""
  return value == None
