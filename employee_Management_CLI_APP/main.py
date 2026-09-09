import math

import questionary

import utils
import services

PAGE_SIZE = 10


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
        validate=lambda v: True if utils.is_positive_integer(v) and services.get_record_by_id(v)
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


def show_paginated(data, title, empty_message="No records found.", page_size=PAGE_SIZE):
    """Prints `data` one page at a time, with a Next/Previous/Exit prompt
    between pages. Falls back to a single plain listing if everything fits
    on one page."""
    if not data:
        print(empty_message)
        return

    total = len(data)
    total_pages = math.ceil(total / page_size)
    page = 1

    while True:
        start = (page - 1) * page_size
        end = min(start + page_size, total)

        print(f"\n{title} — page {page}/{total_pages} (showing {start + 1}-{end} of {total})")
        services.print_records(data[start:end], show_total=False)

        if total_pages <= 1:
            break

        choices = []
        if page > 1:
            choices.append("Previous page")
        if page < total_pages:
            choices.append("Next page")
        choices.append("Exit")

        action = questionary.select("Navigate:", choices=choices).ask()
        if action is None or action == "Exit":
            break
        elif action == "Next page":
            page += 1
        elif action == "Previous page":
            page -= 1


def handle_view():
    data = services.get_all_records()
    utils.log_action("VIEW_ALL", f"{len(data)} record(s) shown")
    show_paginated(data, "All records")


def confirm_summary(action_label, name, age, city, salary):
    """Shows the collected values as a one-row table and asks the user to
    confirm before anything is actually saved. Returns True/False."""
    preview = {"id": "-", "name": name, "age": age, "city": city, "salary": float(salary)}
    print(f"\n{action_label} - please review:")
    services.print_record(preview)
    return bool(questionary.confirm("Save this record?", default=True).ask())


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

    if not confirm_summary("New employee", name, age, city, salary):
        print("Creation cancelled.")
        utils.log_action("CREATE_CANCELLED", f"name={name} age={age} city={city} salary={salary}")
        return

    services.create_new_record(name, age, city, salary)


def handle_update():
    e_id = ask_id("Enter the id of the employee to update:")
    if e_id is None:
        return

    record = services.get_record_by_id(e_id)
    if record is None:
        print("Record not found.")
        return

    print("\nCurrently updating:")
    services.print_record(record)
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

    if not confirm_summary(f"Updated employee {e_id}", name, age, city, salary):
        print("Update cancelled.")
        utils.log_action("UPDATE_CANCELLED", f"id={e_id} name={name} age={age} city={city} salary={salary}")
        return

    services.update_records(e_id, name, age, city, salary)


def handle_delete():
    e_id = ask_id("Enter the id of the employee to delete:")
    if e_id is None:
        return

    record = services.get_record_by_id(e_id)
    if record is None:
        print("Record not found.")
        return

    print("\nAbout to delete:")
    services.print_record(record)

    confirmed = questionary.confirm(f"Are you sure you want to delete employee {e_id}?", default=False).ask()
    if confirmed:
        services.delete_record(e_id)
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

    results = services.search_records(
        name=name, city=city, min_age=min_age, max_age=max_age,
        min_salary=min_salary, max_salary=max_salary,
    )
    show_paginated(results, "Search results", empty_message="No records match those filters.")


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

    sorted_data = services.sort_records(key=services.SORT_KEYS[field], reverse=(order == "Descending"))
    show_paginated(sorted_data, f"Sorted by {field} ({order})")


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