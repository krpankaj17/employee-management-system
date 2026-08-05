def has_duplicate (value) :
  """This Function takes the input parameter and return whether the value contains the duplicate element or not."""
  my_set = set()
  for element in value :
    if element in my_set :
      return True
    my_set.add(element)
    
  return False
