from .input_validators import is_integer,is_decimal
def is_positive_integer(value):
  """IT takes the Input parameter and validates that the input parameter is positive integer or not"""
  if is_integer(value):
    if value > 0:
      return True
    else:
      return False
    
def is_positive_decimal(value):
  """It takes the Input parameter and validates that the input is positive decimal or not."""
  if is_decimal(value):
    return True
  else:
    return False
  
 
  
def is_value_between(value,minimum,maximum):
  """This takes the user input and checks whether the input value in the parameter lies between the minimum and maximum in the parameter  
  Parameters :  value - tells the value which we have to compare with minimum and maximum 
  minimum - tell the minimum value 
  maximum - tells the maximum value """
  if is_integer(value) or is_decimal(value):
    if value<maximum and value >minimum:
            return True
    else:
      return False
     
      
    
    
 