from .input_validators import is_string
def remove_extra_spaces(value):
  """This function takes the input parameter as string and only removes the extra spaces and returns it """
  result= " ".join(value.split())
  return result
def remove_spaces(value):
  """This function takes the input string and remove all the spaces in the string."""
  answer  = value.replace(" ","")
  return answer
