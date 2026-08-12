# Employee Management

A simple employee record management system available in two independent flavors:

- **`employee_Management_CLI_APP`** — an interactive command-line app (built with `questionary`) for managing employee records directly from the terminal.
- **`employee_management_Backend`** — a REST API (built with **FastAPI**) exposing the same employee management operations over HTTP.

Both apps share the same underlying data model and validation rules, but are fully independent — each has its own `services`, `utils`, and data file. You can run either one on its own.

---

## Features

- Create, read, update, and delete employee records
- Search/filter employees by name, city, age range, and salary range
- Sort employees by name, age, city, or salary (ascending/descending)
- Paginated record listings (CLI)
- Input validation (name, age range, city, positive salary)
- Activity logging of every action (create, update, delete, search, sort, view) to `activity.log`

---

## Project Structure

```
EMPLOYEE-MANAGEMENT-SYS.../
├── docs/
├── employee_management_Backend/
│   └── src/
│       ├── routes/          # FastAPI route definitions
│       ├── services/        # Business logic / data access
│       ├── utils/           # Validators, logger, helpers
│       ├── activity.log
│       └── MOCK_DATA.json   # Employee data store
└── employee_Management_CLI_APP/
    ├── services/             # Business logic / data access
    ├── utils/                # Validators, logger, helpers
    ├── activity.log
    ├── main.py               # CLI entry point
    └── MOCK_DATA.json        # Employee data store
```

Each app stores its employee records in a local `MOCK_DATA.json` file (simple JSON-based persistence — no external database required).

---

## Employee Record Fields

| Field  | Type   | Validation Rules                     |
|--------|--------|---------------------------------------|
| id     | int    | Auto-generated                        |
| name   | string | Required, non-numeric, min length 3   |
| age    | int    | Required, whole number, 18–70         |
| city   | string | Required, non-numeric                 |
| salary | float  | Required, positive number             |

---

## 1. CLI App (`employee_Management_CLI_APP`)

An interactive terminal menu for managing employees.

### Setup

```bash
cd employee_Management_CLI_APP
pip install questionary
```

### Run

```bash
python main.py
```

### Menu Options

- **View all records** — lists all employees, paginated 10 per page
- **Search / filter records** — filter by name/city (substring match) and/or age/salary range
- **Sort records** — sort by Name, Age, City, or Salary, ascending or descending
- **Create new record** — prompts for name, age, city, salary, then asks for confirmation before saving
- **Update existing record** — select an employee by id, edit any field (press Enter to keep current value)
- **Delete existing record** — select an employee by id, confirm before deleting
- **Exit** — quit the app

Every create, update, delete, search, sort, and view action is recorded in `activity.log` with a timestamp.

---

## 2. Backend API (`employee_management_Backend`)

A REST API built with **FastAPI**, providing the same functionality over HTTP.

### Setup

```bash
cd employee_management_Backend/src
pip install fastapi uvicorn pydantic
```

### Run

```bash
uvicorn routes.employee_data_routes:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
Interactive API docs (Swagger UI) are auto-generated at `http://127.0.0.1:8000/docs`.

### Endpoints

| Method | Endpoint                | Description                                      |
|--------|--------------------------|---------------------------------------------------|
| GET    | `/employees`             | Get all employee records                          |
| GET    | `/employee/{employee_id}`| Get a single employee by id                        |
| POST   | `/employee`               | Create a new employee record                       |
| PUT    | `/employee/{employee_id}`| Update an existing employee record                  |
| DELETE | `/employee/{employee_id}`| Delete an employee record                           |
| GET    | `/employees/search`      | Search employees by `name`, `city`, `min_age`, `max_age` |

#### Request Body — `POST /employee` & `PUT /employee/{employee_id}`

```json
{
  "name": "John Doe",
  "age": 30,
  "city": "New York",
  "salary": 55000.0
}
```

#### Response Body — `EmployeeOut`

```json
{
  "id": 1,
  "name": "John Doe",
  "age": 30,
  "city": "New York",
  "salary": 55000.0
}
```

#### Example: Search employees

```
GET /employees/search?name=john&city=new&min_age=25&max_age=40
```

All fields on this endpoint are optional — omit any filter you don't need.

### Error Responses

| Status Code | Meaning                                             |
|-------------|------------------------------------------------------|
| 400         | Validation error (invalid name/age/city/salary)      |
| 404         | Employee not found                                   |

---

## Tech Stack

- **Language:** Python 3.12
- **CLI:** [questionary](https://github.com/tmbo/questionary)
- **Backend API:** [FastAPI](https://fastapi.tiangolo.com/) + [Pydantic](https://docs.pydantic.dev/) + [Uvicorn](https://www.uvicorn.org/)
- **Storage:** JSON file (`MOCK_DATA.json`)

---

## Logging

Both apps log every action (view, create, update, delete, search, sort, and their failure states) to `activity.log` in the format:

```
[YYYY-MM-DD HH:MM:SS] ACTION - details
```

---

## License

Add your license information here.
