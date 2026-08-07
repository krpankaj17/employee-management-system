import questionary

import utils


def ask_name(default=""):
    return questionary.text(
        "Employee name:",
        default=default,
        validate=lambda v: True if not utils.is_none(v) and not utils.is_integer(v)
        else "Name cannot be empty or a number",
    ).ask()


def ask_age(default=""):
    return questionary.text(
        "Employee age (18-70):",
        default=default,
        validate=lambda v: True if utils.is_positive_integer(v) and utils.is_value_between(v, "18", "70")
        else "Enter a whole number between 18 and 70",
    ).ask()


def ask_city(default=""):
    return questionary.text(
        "Employee city:",
        default=default,
        validate=lambda v: True if not utils.is_none(v) and not utils.is_integer(v)
        else "City cannot be empty or a number",
    ).ask()


def ask_salary(default=""):
    return questionary.text(
        "Employee salary:",
        default=default,
        validate=lambda v: True if utils.is_positive_decimal(v)
        else f"Enter a valid positive number (up to {utils.MAX_NUMERIC_VALUE:,})",
    ).ask()


def ask_id(prompt_text="Enter the employee id:"):
    """Prompts for an id and validates that a record with that id exists
    before accepting it."""
    return questionary.text(
        prompt_text,
        validate=lambda v: True if utils.is_positive_integer(v) and utils.get_record_by_id(v)
        else "No record exists with that id",
    ).ask()


def ask_optional_text(prompt_text):
    """Prompts for free text that may be left blank (blank means 'don't
    filter on this field')."""
    value = questionary.text(prompt_text).ask()
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def ask_optional_number(prompt_text, is_decimal=False):
    """Prompts for a number that may be left blank. Re-prompts on invalid
    (non-blank, non-numeric) input."""
    checker = utils.is_positive_decimal if is_decimal else utils.is_positive_integer
    convert = float if is_decimal else int
    while True:
        value = questionary.text(prompt_text).ask()
        if value is None:
            return None
        value = value.strip()
        if not value:
            return None
        if checker(value):
            return convert(value)
        print("Invalid number, leave blank to skip this filter.")


def handle_view():
    utils.print_all_records()


def handle_create():
    name = ask_name()
    if name is None:
        return
    age = ask_age()
    if age is None:
        return
    city = ask_city()
    if city is None:
        return
    salary = ask_salary()
    if salary is None:
        return
    utils.create_new_record(name, age, city, salary)


def handle_update():
    e_id = ask_id("Enter the id of the employee to update:")
    if e_id is None:
        return

    record = utils.get_record_by_id(e_id)
    if record is None:
        print("Record not found.")
        return

    print("\nCurrently updating:")
    utils.print_record(record)
    print("(press Enter to keep the current value for any field)\n")

    name = ask_name(default=str(record["name"]))
    if name is None:
        return
    age = ask_age(default=str(record["age"]))
    if age is None:
        return
    city = ask_city(default=str(record["city"]))
    if city is None:
        return
    salary = ask_salary(default=str(record["salary"]))
    if salary is None:
        return
    utils.update_records(e_id, name, age, city, salary)


def handle_delete():
    e_id = ask_id("Enter the id of the employee to delete:")
    if e_id is None:
        return

    record = utils.get_record_by_id(e_id)
    if record is None:
        print("Record not found.")
        return

    print("\nAbout to delete:")
    utils.print_record(record)

    confirmed = questionary.confirm(f"Are you sure you want to delete employee {e_id}?", default=False).ask()
    if confirmed:
        utils.delete_record(e_id)
    else:
        print("Delete cancelled.")


def handle_search():
    print("Leave any field blank to skip filtering on it.\n")
    name = ask_optional_text("Name contains:")
    city = ask_optional_text("City contains:")
    min_age = ask_optional_number("Minimum age:")
    max_age = ask_optional_number("Maximum age:")
    min_salary = ask_optional_number("Minimum salary:", is_decimal=True)
    max_salary = ask_optional_number("Maximum salary:", is_decimal=True)

    results = utils.search_records(
        name=name, city=city, min_age=min_age, max_age=max_age,
        min_salary=min_salary, max_salary=max_salary,
    )
    print()
    utils.print_records(results, empty_message="No records match those filters.")


def handle_sort():
    field = questionary.select(
        "Sort by:",
        choices=list(utils.SORT_KEYS.keys()),
    ).ask()
    if field is None:
        return

    order = questionary.select(
        "Order:",
        choices=["Ascending", "Descending"],
    ).ask()
    if order is None:
        return

    sorted_data = utils.sort_records(key=utils.SORT_KEYS[field], reverse=(order == "Descending"))
    print()
    utils.print_records(sorted_data)


MENU_ACTIONS = {
    "View all records": handle_view,
    "Search / filter records": handle_search,
    "Sort records": handle_sort,
    "Create new record": handle_create,
    "Update existing record": handle_update,
    "Delete existing record": handle_delete,
}


def main():
    while True:
        choice = questionary.select(
            "CLI Employee Management — use the arrow keys and Enter to select:",
            choices=list(MENU_ACTIONS.keys()) + ["Exit"],
        ).ask()

        if choice is None or choice == "Exit":
            print("Goodbye!")
            break

        MENU_ACTIONS[choice]()
        print()  # spacing before the menu redraws


if __name__ == "__main__":
    main()