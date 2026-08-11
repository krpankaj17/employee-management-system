import json

from .input_validators import is_none, is_integer
from .numeric_validator import is_positive_integer, is_positive_decimal, is_value_between
from .string_function import convert_string_to_integer, convert_string_to_decimal
from .logger import log_action

DATA_FILE = "MOCK_DATA.json"


def _load_data():
    """Internal helper: loads the JSON data file. Returns an empty list if the
    file does not exist yet."""
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as myfile:
            return json.load(myfile)
    except FileNotFoundError:
        return []


def _save_data(data):
    """Internal helper: writes the given data back to the JSON data file."""
    with open(DATA_FILE, "w", encoding="utf-8") as myfile:
        json.dump(data, myfile, indent=4)


COLUMNS = ["ID", "Name", "Age", "City", "Salary"]


def _row_values(employee):
    return [
        str(employee["id"]),
        str(employee["name"]),
        str(employee["age"]),
        str(employee["city"]),
        f'{employee["salary"]:.2f}',
    ]


def _print_table(rows):
    """Prints the given rows (list of lists of strings) as a table, aligned
    under COLUMNS, with column widths sized to the widest cell."""
    widths = [len(col) for col in COLUMNS]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))

    def format_row(cells):
        return " | ".join(cell.ljust(widths[i]) for i, cell in enumerate(cells))

    header = format_row(COLUMNS)
    print(header)
    print("-+-".join("-" * w for w in widths))
    for row in rows:
        print(format_row(row))


def print_records(data, empty_message="No records found.", show_total=True):
    """Prints any list of employee dicts as a table. Shared by 'view all',
    search results, sorted results, and paginated pages.

    show_total=False lets a caller (like pagination) print its own
    page/total footer instead of this function's "N record(s) total" line.
    """
    if not data:
        print(empty_message)
        return
    rows = [_row_values(employee) for employee in data]
    _print_table(rows)
    if show_total:
        print(f"\n{len(data)} record(s) total")


def get_all_records():
    """Returns the full, raw list of employee records (unfiltered,
    unsorted). Used by the CLI layer when it needs the actual list rather
    than just a printed table - e.g. for pagination."""
    return _load_data()


def print_all_records():
    """This function prints all the records in the file in a tabular format."""
    try:
        data = _load_data()
        print_records(data)
        log_action("VIEW_ALL", f"{len(data)} record(s) shown")
    except Exception as e:
        print(e)
        log_action("VIEW_ALL_FAILED", str(e))


def get_record_by_id(e_id):
    """Returns the employee dict matching the given id, or None if not found."""
    e_id = convert_string_to_integer(e_id) if isinstance(e_id, str) else e_id
    for employee in _load_data():
        if employee["id"] == e_id:
            return employee
    return None


def print_record(employee):
    """Prints a single employee record as a one-row table."""
    if not employee:
        print("Record not found.")
        return
    _print_table([_row_values(employee)])

def create_new_record(e_name, e_age, e_city, e_salary):
    """This function creates a new record. Before creating the record it
    validates that the input data is valid or not.

    Returns a dict: {"ok": True, "record": employee} on success,
    or {"ok": False, "error": "validation" | "server", "message": str} on failure.
    """
    try:
        if is_none(e_name):
            log_action("CREATE_FAILED", "name empty or null")
            return {"ok": False, "error": "validation", "message": "The name is empty or null"}
        if is_integer(e_name):
            log_action("CREATE_FAILED", "name was numeric")
            return {"ok": False, "error": "validation", "message": "Name must be Text, Integer not allowed"}
        if not is_positive_integer(e_age):
            log_action("CREATE_FAILED", f"invalid age '{e_age}'")
            return {"ok": False, "error": "validation", "message": "Invalid age input, only enter a positive age between 18 and 70"}
        if not is_value_between(e_age, "18", "70"):
            log_action("CREATE_FAILED", f"age '{e_age}' out of range 18-70")
            return {"ok": False, "error": "validation", "message": "Age must be between 18 and 70"}
        if is_none(e_city):
            log_action("CREATE_FAILED", "city empty or null")
            return {"ok": False, "error": "validation", "message": "City name is empty"}
        if is_integer(e_city):
            log_action("CREATE_FAILED", "city was numeric")
            return {"ok": False, "error": "validation", "message": "City must be Text, Integer not allowed"}
        if not is_positive_decimal(e_salary):
            log_action("CREATE_FAILED", f"invalid salary '{e_salary}'")
            return {"ok": False, "error": "validation", "message": "Invalid salary input, please enter a valid salary"}

        e_age = convert_string_to_integer(e_age) if isinstance(e_age, str) else e_age
        e_salary = convert_string_to_decimal(e_salary) if isinstance(e_salary, str) else e_salary

        data = _load_data()
        e_id = max((employee["id"] for employee in data), default=0) + 1
        new_employee = {
            "id": e_id,
            "name": e_name,
            "age": e_age,
            "city": e_city,
            "salary": e_salary,
        }
        data.append(new_employee)
        _save_data(data)

        log_action("CREATE", f"id={e_id} name={e_name} age={e_age} city={e_city} salary={e_salary}")
        return {"ok": True, "record": new_employee}
    except Exception as e:
        log_action("CREATE_FAILED", f"unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def update_records(e_id, e_name, e_age, e_city, e_salary):
    """Returns a dict: {"ok": True, "record": employee} on success,
    or {"ok": False, "error": "not_found" | "validation", "message": str} on failure."""
    try:
        e_id = convert_string_to_integer(e_id) if isinstance(e_id, str) else e_id
        data = _load_data()

        employee_record = next((e for e in data if e["id"] == e_id), None)
        if not employee_record:
            msg = f"Employee record does not exist with id {e_id}"
            log_action("UPDATE_FAILED", f"id={e_id} does not exist")
            return {"ok": False, "error": "not_found", "message": msg}

        if is_none(e_name):
            log_action("UPDATE_FAILED", f"id={e_id} name empty or null")
            return {"ok": False, "error": "validation", "message": "The name is empty or null"}
        if not is_positive_integer(e_age):
            log_action("UPDATE_FAILED", f"id={e_id} invalid age '{e_age}'")
            return {"ok": False, "error": "validation", "message": "Invalid age input"}
        if not is_value_between(e_age, "18", "70"):  # match create's range
            log_action("UPDATE_FAILED", f"id={e_id} age '{e_age}' out of range 18-70")
            return {"ok": False, "error": "validation", "message": "Age must be between 18 and 70"}
        if is_none(e_city):
            log_action("UPDATE_FAILED", f"id={e_id} city empty or null")
            return {"ok": False, "error": "validation", "message": "City name is empty"}
        if is_integer(e_city):
            log_action("UPDATE_FAILED", f"id={e_id} city was numeric")
            return {"ok": False, "error": "validation", "message": "City must be Text, Integer not allowed"}
        if not is_positive_decimal(e_salary):
            log_action("UPDATE_FAILED", f"id={e_id} invalid salary '{e_salary}'")
            return {"ok": False, "error": "validation", "message": "Invalid salary input"}

        before = dict(employee_record)
        employee_record["name"] = e_name
        employee_record["age"] = convert_string_to_integer(e_age)
        employee_record["city"] = e_city
        employee_record["salary"] = convert_string_to_decimal(e_salary)
        _save_data(data)

        log_action("UPDATE", f"id={e_id} before={before} after={employee_record}")
        return {"ok": True, "record": employee_record}
    except Exception as e:
        log_action("UPDATE_FAILED", f"id={e_id} unexpected error: {e}")
        return {"ok": False, "error": "server", "message": str(e)}


def get_record_choices():
    """Returns a list of (label, id) tuples for every employee, used to build
    a questionary select list."""
    data = _load_data()
    return [(f'{e["id"]} - {e["name"]} ({e["city"]})', e["id"]) for e in data]


def delete_record(e_id):
    """This function deletes the record with the given id, if it exists."""
    try:
        e_id = convert_string_to_integer(e_id) if isinstance(e_id, str) else e_id
        data = _load_data()

        employee_record = None
        for employee in data:
            if e_id == employee["id"]:
                employee_record = employee
                break

        if not employee_record:
            print("The id entered does not exist")
            log_action("DELETE_FAILED", f"id={e_id} does not exist")
            return None

        data.remove(employee_record)
        _save_data(data)
        print(f"Record with id {e_id} is deleted")
        log_action("DELETE", f"id={e_id} record={employee_record}")
        return {"details" : f"Employee with id {e_id} deleted"}
        
    except Exception as e:
        print(e)
        log_action("DELETE_FAILED", f"id={e_id} unexpected error: {e}")
        return None


def search_records(name=None, city=None, min_age=None, max_age=None, min_salary=None, max_salary=None):
    """Filters records by any combination of the given criteria.

    - name / city: case-insensitive substring match
    - min_age / max_age / min_salary / max_salary: inclusive numeric bounds

    Any argument left as None is ignored (not filtered on).
    """
    data = _load_data()
    results = []
    for employee in data:
        if name and name.strip().lower() not in employee["name"].lower():
            continue
        if city and city.strip().lower() not in employee["city"].lower():
            continue
        if min_age is not None and employee["age"] < min_age:
            continue
        if max_age is not None and employee["age"] > max_age:
            continue
        if min_salary is not None and employee["salary"] < min_salary:
            continue
        if max_salary is not None and employee["salary"] > max_salary:
            continue
        results.append(employee)

    log_action(
        "SEARCH",
        f"name={name!r} city={city!r} min_age={min_age} max_age={max_age} "
        f"min_salary={min_salary} max_salary={max_salary} -> {len(results)} match(es)",
    )
    return results


SORT_KEYS = {
    "Name": "name",
    "Age": "age",
    "City": "city",
    "Salary": "salary",
}


def sort_records(key="name", reverse=False, data=None):
    """Returns a new list of records sorted by the given field ('name', 'age',
    'city', or 'salary'). If `data` isn't provided, sorts the full data file."""
    if data is None:
        data = _load_data()

    def sort_key(employee):
        value = employee.get(key)
        return value.lower() if isinstance(value, str) else value

    sorted_data = sorted(data, key=sort_key, reverse=reverse)
    log_action("SORT", f"key={key} reverse={reverse} -> {len(sorted_data)} record(s)")
    return sorted_data