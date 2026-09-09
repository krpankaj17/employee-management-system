# Employee Management System (EMS)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB.svg?style=flat&logo=Python&logoColor=white)](https://www.python.org)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.3-6DB33F.svg?style=flat&logo=SpringBoot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Java](https://img.shields.io/badge/Java-17-ED8B00.svg?style=flat&logo=OpenJDK&logoColor=white)](https://www.oracle.com/java/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1.svg?style=flat&logo=PostgreSQL&logoColor=white)](https://www.postgresql.org)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00.svg?style=flat&logo=SQLAlchemy&logoColor=white)](https://www.sqlalchemy.org)
[![Hibernate](https://img.shields.io/badge/Hibernate-JPA-59666C.svg?style=flat&logo=Hibernate&logoColor=white)](https://hibernate.org)
[![Alembic](https://img.shields.io/badge/Alembic-Migrations-black.svg?style=flat)](https://alembic.sqlalchemy.org)

An enterprise-grade, polyglot **Employee Management System** providing full-lifecycle workforce management, multi-tier Role-Based Access Control (RBAC), and relational data persistence.

The project offers **three application implementations** backed by comprehensive architecture and specification documentation:
1. **Python FastAPI Backend** (`employee_management_backend`) — High-performance asynchronous REST API powered by FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic migrations, and JWT authentication.
2. **Java Spring Boot Backend** (`employee_management_backend_java`) — Enterprise REST API built with Java 17, Spring Boot 3.4.3, Spring Data JPA / Hibernate, Spring Security 6, and OpenAPI 3 / Swagger UI.
3. **Interactive Python CLI App** (`employee_Management_CLI_APP`) — Standalone terminal-based management tool powered by `questionary` with local JSON persistence for offline/lightweight use.
4. **Architecture & Engineering Docs** (`docs/`) — Full SRS specification, Entity-Relationship (ER) diagram, and system architecture documentation.

---

## Table of Contents

- [System Architecture](#system-architecture)
- [Domain Model & Core Modules](#domain-model--core-modules)
- [Security & RBAC Model](#security--rbac-model)
- [Project Structure](#project-structure)
- [1. Python FastAPI Backend](#1-python-fastapi-backend)
  - [Tech Stack](#tech-stack-python)
  - [Prerequisites & Configuration](#prerequisites--configuration-python)
  - [Database Migrations & Seeding](#database-migrations--seeding)
  - [Running the Server](#running-the-server-python)
  - [Running Automated Tests](#running-automated-tests)
- [2. Java Spring Boot Backend](#2-java-spring-boot-backend)
  - [Tech Stack](#tech-stack-java)
  - [Prerequisites & Configuration](#prerequisites--configuration-java)
  - [Building & Running](#building--running-java)
  - [Interactive API Documentation](#interactive-api-documentation-java)
- [3. Interactive CLI Application](#3-interactive-cli-application)
  - [Features & Usage](#features--usage-cli)
  - [Setup & Running](#setup--running-cli)
- [API Reference](#api-reference)
- [Documentation Artifacts](#documentation-artifacts)
- [Contributing & License](#contributing--license)

---

## System Architecture

The ecosystem provides architectural parity between the **Python FastAPI** and **Java Spring Boot** backend implementations, both communicating with a common relational schema in PostgreSQL.

```
                                  +---------------------------------------+
                                  |            Client Clients             |
                                  |   (Web UI, Mobile, Postman, CLI)      |
                                  +-------------------+-------------------+
                                                      |
                                       HTTP / REST API (JSON)
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                                                   |
                    v                                                                   v
+---------------------------------------+           +---------------------------------------+
|        Python FastAPI Backend         |           |       Java Spring Boot Backend        |
|  - FastAPI (Routing & Async IO)       |           |  - Spring Boot 3.4.3 Web MVC          |
|  - SQLAlchemy 2.0 ORM                 |           |  - Spring Data JPA (Hibernate)        |
|  - Pydantic v2 Validation             |           |  - Jakarta Validation                 |
|  - JWT Auth + PyJWT                   |           |  - Spring Security 6 + JJWT           |
|  - Alembic Migrations                 |           |  - SpringDoc OpenAPI / Swagger UI     |
+-------------------+-------------------+           +-------------------+-------------------+
                    |                                                   |
                    +------------------------+--------------------------+
                                             |
                                             v
                           +-----------------------------------+
                           |        PostgreSQL Database        |
                           |  - RBAC (Users, Roles, Perms)     |
                           |  - Employees & Departments        |
                           |  - Attendance & Leaves            |
                           |  - Payroll, Salaries & Bank Info  |
                           |  - Projects, Reviews, Documents   |
                           |  - Announcements, Notifications   |
                           |  - Audit Trail Logs               |
                           +-----------------------------------+

+-------------------------------------------------------------------------------------------+
|                           Standalone Interactive CLI App                                  |
|  - Python 3 + questionary Terminal UI                                                     |
|  - Local JSON File Store (MOCK_DATA.json) + Activity Logging (activity.log)               |
+-------------------------------------------------------------------------------------------+
```

---

## Domain Model & Core Modules

The enterprise backend models manage complete employee lifecycle operations:

1. **Authentication & Identity**:
   - Email verification via 6-digit OTP with cooldown rate-limiting.
   - User signup, password hashing with **Bcrypt**, and secure JWT tokens (Access + Refresh).
   - Password reset workflow with secure token expiration.

2. **Employee Profile Lifecycle**:
   - Comprehensive employee records: personal details, DOB, gender, joining date, employment type (`full_time`, `part_time`, `contract`, `intern`), and status (`active`, `on_leave`, `terminated`, `resigned`).
   - Multiple addresses per employee (`current`, `permanent`) with primary flags.
   - Emergency contacts with relationship indicators.
   - Hierarchical reporting manager assignments.

3. **Departments & Designations**:
   - Department management with code, description, and assigned Department Head.
   - Designation catalog with job levels and department linkage.

4. **Attendance & Time Tracking**:
   - Daily employee check-in / check-out with automatic total work hours calculation.
   - Work mode classification (`in_office`, `work_from_home`, `on_field`).
   - Attendance status resolution (`present`, `absent`, `half_day`, `on_leave`).
   - Monthly attendance summaries, daily status aggregation, and analytics.

5. **Holiday Management**:
   - Organization holiday calendar tracking dates, holiday names, and mandatory/optional classifications.

6. **Leave Management & Workflows**:
   - Configurable leave types (Casual Leave, Sick Leave, Earned Leave, Maternity, etc.) with annual limits.
   - Yearly employee leave balance allocation and auto-deduction.
   - Leave request application, cancellation, and multi-tier approval/rejection history.

7. **Payroll, Compensation & Banking**:
   - Base salary structuring, currency support, and effective date tracking.
   - Itemized salary components: earnings (Basic Pay, HRA, Special Allowances) and deductions (PF, Professional Tax, TDS).
   - Employee bank details (Account Number, IFSC, Bank Name, Branch) with primary selection.
   - Monthly payroll run processing, status lifecycle (`draft`, `processed`, `paid`), and payslip generation.

8. **Projects & Team Allocations**:
   - Project records (start/end dates, client name, status, budget).
   - Team membership allocations with project-specific roles (`Project Lead`, `Developer`, `QA`, etc.).

9. **Performance Reviews**:
   - Structured review cycles with rating scores (1.0 - 5.0), reviewer feedback, goals evaluation, and status tracking.

10. **Document Management**:
    - Employee document metadata tracking (ID proofs, educational certificates, offer letters, tax documents).

11. **Announcements & Notifications**:
    - Company-wide and department-targeted announcements.
    - User notifications with recipient delivery tracking and read/unread status.

12. **Audit Logging & Activity Trails**:
    - Systematic capture of create, update, delete, and authentication events with actor ID, action type, IP address, and payload diffs.

---

## Security & RBAC Model

The system implements a granular **Role-Based Access Control (RBAC)** architecture:

### System Roles
- **`Admin`**: Full operational and administrative access across all system entities, user provisioning, and role assignment.
- **`HR_Manager`**: Management of employee directory, attendance overrides, leave approvals, payroll processing, and department/designation catalogs.
- **`Department_Head`**: Read/review access across departmental members, leave approvals for direct reports, and performance reviews.
- **`Project_Lead`**: Project team allocation and review participation.
- **`Employee`**: Self-service portal access (view own profile, check-in/out, apply for leaves, view payslips, inspect notifications).

### Permissions Matrix
Over **40+ granular permissions** enforce least-privilege access across endpoints (e.g., `employee:create`, `employee:read`, `employee:update`, `employee:delete`, `attendance:check_in`, `attendance:manage`, `leave:apply`, `leave:approve`, `payroll:run`, `role:manage`, `audit:read`).

---

## Project Structure

```
employee-management-system/
├── README.md                                   # Root project documentation
├── docs/                                       # Architecture and engineering specs
│   ├── Employee management  ER Diagram.pdf     # Full database schema ER diagram
│   ├── SRS employee managmeent system.pdf      # Detailed requirements specification
│   └── System Architecture.docx                # Technical architecture document
│
├── employee_management_backend/                # Python FastAPI Backend
│   ├── alembic.ini                             # Alembic migration configuration
│   ├── requirements.txt                        # Python dependencies
│   ├── .env.example                            # Sample environment variables
│   ├── migrations/                             # Alembic migration revisions
│   │   └── versions/                           # Database migration scripts
│   ├── src/
│   │   ├── main.py                             # FastAPI application entry point & lifespan
│   │   ├── database.py                         # SQLAlchemy engine & session setup
│   │   ├── core/                               # Security, JWT, RBAC & permissions
│   │   │   ├── config.py                       # Pydantic Settings configuration
│   │   │   ├── permissions.py                  # RBAC dependencies & guards
│   │   │   └── security.py                     # Password hashing & JWT generators
│   │   ├── models/                             # SQLAlchemy ORM models (15+ tables)
│   │   ├── schemas/                            # Pydantic v2 request/response schemas
│   │   ├── repository/                         # Data access layer (database queries)
│   │   ├── services/                           # Business logic layer
│   │   ├── routes/                             # 13 FastAPI router modules
│   │   └── utils/                              # Seed data, validators, logger
│   └── tests/                                  # Pytest automated test suite
│       ├── conftest.py                         # Test fixtures & database setup
│       ├── test_auth.py                        # Auth & OTP tests
│       ├── test_employees.py                   # Employee CRUD tests
│       ├── test_attendance.py                  # Attendance workflow tests
│       ├── test_leaves.py                      # Leave balance & request tests
│       ├── test_payroll.py                     # Payroll & payslip tests
│       ├── test_departments.py                 # Department & designation tests
│       ├── test_projects.py                    # Project team tests
│       ├── test_reviews.py                     # Performance review tests
│       ├── test_documents_and_announcements.py # Document & notification tests
│       └── test_rbac_security.py               # Security & permission boundary tests
│
├── employee_management_backend_java/           # Java Spring Boot Backend
│   └── EmployeeManagment/
│       └── EmployeeManagment/
│           ├── pom.xml                         # Maven dependencies & build plugins
│           ├── mvnw / mvnw.cmd                 # Maven wrapper scripts
│           └── src/
│               ├── main/
│               │   ├── java/com/datansh/EmployeeManagment/
│               │   │   ├── EmployeeManagmentApplication.java # Spring Boot entry point
│               │   │   ├── config/             # OpenAPI & application beans
│               │   │   ├── controller/         # 16 Spring REST Controllers
│               │   │   ├── dto/                # Data Transfer Objects
│               │   │   ├── entity/             # JPA / Hibernate Entities
│               │   │   ├── exception/          # Global exception handler
│               │   │   ├── repository/         # Spring Data JPA Repositories
│               │   │   ├── security/           # Spring Security 6 + JJWT filter
│               │   │   ├── service/            # Business service layer
│               │   │   └── util/               # Utility classes
│               │   └── resources/
│               │       └── application.properties # Spring application configuration
│               └── test/                       # JUnit / Spring Boot test suite
│
└── employee_Management_CLI_APP/                # Standalone Interactive Python CLI
    ├── main.py                                 # Interactive questionary terminal menu
    ├── MOCK_DATA.json                          # Local JSON employee store
    ├── activity.log                            # Local operation audit log
    ├── services/                               # Local CRUD data service
    └── utils/                                  # Input validators & sanitizers
```

---

## 1. Python FastAPI Backend

<a id="tech-stack-python"></a>

### Tech Stack
- **Framework**: FastAPI `0.115+`
- **ASGI Server**: Uvicorn `0.30+`
- **ORM**: SQLAlchemy `2.0+`
- **Database Driver**: Psycopg 3 (`psycopg[binary] >= 3.2.0`)
- **Database Migrations**: Alembic `1.13+`
- **Data Validation & Settings**: Pydantic v2 & Pydantic Settings
- **Authentication & Cryptography**: PyJWT `2.8+`, Bcrypt `4.0+`
- **Testing**: Pytest `8.0+`, HTTPX, Pytest-Asyncio

<a id="prerequisites--configuration-python"></a>

### Prerequisites & Configuration
Ensure you have **Python 3.12+** and a running instance of **PostgreSQL** (version 14 or later).

1. Navigate to the backend directory:
   ```bash
   cd employee_management_backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate

   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. Install required dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create your environment configuration file:
   ```bash
   # Copy example environment configuration
   cp .env.example src/.env
   ```

5. Edit `src/.env` with your database credentials and secret key:
   ```ini
   DATABASE_URL=postgresql+psycopg://postgres:your_password@localhost:5432/employee_management
   JWT_SECRET_KEY=replace_with_a_secure_random_256_bit_secret_key
   JWT_ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   REFRESH_TOKEN_EXPIRE_DAYS=7
   ```

<a id="database-migrations--seeding"></a>

### Database Migrations & Seeding

1. Run Alembic migrations to create tables and schema definitions:
   ```bash
   alembic upgrade head
   ```

2. Seed initial data (includes 30 rich employee profiles, departments, designations, roles, permissions, and salary structures):
   ```bash
   python src/utils/seed_data.py
   ```

<a id="running-the-server-python"></a>

### Running the Server
Start the development server with hot-reload enabled:
```bash
cd src
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- **Root Status**: `http://127.0.0.1:8000/`
- **Health Check**: `http://127.0.0.1:8000/health`
- **Interactive Swagger UI**: `http://127.0.0.1:8000/docs`
- **ReDoc Documentation**: `http://127.0.0.1:8000/redoc`

<a id="running-automated-tests"></a>

### Running Automated Tests
The repository includes a comprehensive test suite testing authentication, permissions, workflows, and database integrity:
```bash
cd employee_management_backend
pytest -v
```

---

## 2. Java Spring Boot Backend

<a id="tech-stack-java"></a>

### Tech Stack
- **Framework**: Spring Boot `3.4.3`
- **Java Version**: Java `17` (LTS)
- **Data Access**: Spring Data JPA, Hibernate ORM
- **Security**: Spring Security 6, JJWT (Java JWT `0.12.6`)
- **API Documentation**: SpringDoc OpenAPI UI `2.8.5` (Swagger 3)
- **Utilities**: Project Lombok, ModelMapper `3.1.1`
- **Connection Pooling**: HikariCP

<a id="prerequisites--configuration-java"></a>

### Prerequisites & Configuration
- **Java Development Kit (JDK)**: Version 17 or higher
- **Maven**: Version 3.8+ (or use the included `mvnw` wrapper)
- **PostgreSQL**: Running instance with database `employee_management`

Configure your connection in `employee_management_backend_java/EmployeeManagment/EmployeeManagment/src/main/resources/application.properties`:
```properties
server.port=8080

# PostgreSQL Connection
spring.datasource.url=jdbc:postgresql://localhost:5432/employee_management
spring.datasource.username=postgres
spring.datasource.password=root
spring.datasource.driver-class-name=org.postgresql.Driver

# JPA / Hibernate
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect

# JWT Configuration
app.jwt.secret=e83b4cf7d9021a8c3214589d9e07890123456789abcdef0123456789abcdef01
app.jwt.access-expiration-ms=3600000
app.jwt.refresh-expiration-ms=604800000
```

<a id="building--running-java"></a>

### Building & Running
Navigate to the Spring Boot project root:
```bash
cd employee_management_backend_java/EmployeeManagment/EmployeeManagment
```

Build and run using the Maven wrapper:
```bash
# Linux / macOS
./mvnw clean spring-boot:run

# Windows
mvnw.cmd clean spring-boot:run
```

Or build an executable JAR package:
```bash
./mvnw clean package -DskipTests
java -jar target/EmployeeManagment-0.0.1-SNAPSHOT.jar
```

<a id="interactive-api-documentation-java"></a>

### Interactive API Documentation
- **Swagger UI**: `http://localhost:8080/swagger-ui.html`
- **OpenAPI JSON Schema**: `http://localhost:8080/api-docs`
- **Health Check**: `http://localhost:8080/health`

---

## 3. Interactive CLI Application

<a id="features--usage-cli"></a>

### Features & Usage
The `employee_Management_CLI_APP` offers a self-contained, interactive terminal menu:
- **Interactive UI**: Selection menus and validated text inputs via `questionary`.
- **Full CRUD**: Create, read (paginated 10/page), update, and delete employee records.
- **Search & Filter**: Query records by name/city substring or age/salary ranges.
- **Sorting**: Multi-field sorting by Name, Age, City, or Salary (Ascending/Descending).
- **Independent Persistence**: Uses a local `MOCK_DATA.json` file for offline operations.
- **Action Audit**: Logs all terminal operations with timestamps to `activity.log`.

<a id="setup--running-cli"></a>

### Setup & Running

```bash
cd employee_Management_CLI_APP
pip install questionary
python main.py
```

---

## API Reference

Both the **Python FastAPI** and **Java Spring Boot** backends expose unified RESTful routes. Include the authorization header on protected requests:
```http
Authorization: Bearer <your_jwt_access_token>
```

### 1. Authentication & RBAC (`/auth`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `POST` | `/auth/send-otp` | Request 6-digit email verification OTP | Public |
| `POST` | `/auth/signup` | Register new user with OTP & password | Public |
| `POST` | `/auth/login` | Authenticate user; returns Access & Refresh tokens | Public |
| `POST` | `/auth/refresh` | Obtain new access token using refresh token | Public |
| `GET` | `/auth/me` | Fetch authenticated user profile and permissions | Authenticated |
| `POST` | `/auth/forgot-password` | Request password reset token | Public |
| `POST` | `/auth/reset-password` | Reset password using reset token | Public |
| `GET` | `/auth/roles` | List all roles and associated permissions | `role:manage` |
| `GET` | `/auth/permissions` | List all 41 system permissions | `role:manage` |
| `GET` | `/auth/users` | List registered users with assigned roles | `role:manage` |
| `POST` | `/auth/users/{public_id}/roles`| Assign roles to user & provision employee record | `role:manage` |

### 2. Employees (`/employees`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `GET` | `/employees` | Search and filter employee directory (paginated) | `employee:read` |
| `GET` | `/employees/me` | Get complete profile of authenticated employee | Authenticated |
| `GET` | `/employees/{public_id}` | Get employee profile by public UUID | `employee:read` |
| `POST` | `/employees` | Create employee record | `employee:create` |
| `PUT` | `/employees/{public_id}` | Update employee profile details | `employee:update` |
| `DELETE`| `/employees/{public_id}` | Deactivate or remove employee record | `employee:delete` |
| `POST` | `/employees/{public_id}/addresses` | Add address to employee profile | `employee:update` |
| `POST` | `/employees/{public_id}/emergency-contacts` | Add emergency contact | `employee:update` |

### 3. Departments & Designations (`/departments`, `/designations`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `GET` | `/departments` | List all active departments | Authenticated |
| `POST` | `/departments` | Create new department | `department:create` |
| `GET` | `/departments/{public_id}` | Get department details and head info | Authenticated |
| `PUT` | `/departments/{public_id}` | Update department details | `department:update` |
| `GET` | `/designations` | List all designations | Authenticated |
| `POST` | `/designations` | Create new designation entry | `designation:create` |

### 4. Attendance & Holidays (`/attendance`, `/holidays`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `POST` | `/attendance/check-in` | Record daily check-in (in_office / wfh / field) | Authenticated |
| `POST` | `/attendance/check-out` | Record daily check-out; computes work hours | Authenticated |
| `GET` | `/attendance/status` | Get today's check-in status for current user | Authenticated |
| `GET` | `/attendance/my-summary` | Get monthly attendance summary for current user| Authenticated |
| `GET` | `/attendance/logs` | Query company attendance logs (filters & dates) | `attendance:manage` |
| `GET` | `/holidays` | List annual organization holidays | Authenticated |
| `POST` | `/holidays` | Add new holiday to company calendar | `holiday:create` |

### 5. Leave Management (`/leaves`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `GET` | `/leaves/types` | List available leave types and yearly limits | Authenticated |
| `GET` | `/leaves/balances` | Query leave balances for current user or employee | Authenticated |
| `POST` | `/leaves/requests` | Submit new leave application | `leave:apply` |
| `GET` | `/leaves/my-requests` | List leave requests submitted by current user | Authenticated |
| `GET` | `/leaves/requests` | List all employee leave applications | `leave:approve` |
| `POST` | `/leaves/requests/{id}/action` | Approve or reject a leave request | `leave:approve` |

### 6. Payroll & Banking (`/payroll`, `/salaries`, `/bank-details`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `GET` | `/payroll/salaries/{emp_id}` | Get employee salary structure & components | `payroll:read` |
| `POST` | `/payroll/salaries` | Assign or update employee salary structure | `payroll:manage` |
| `GET` | `/payroll/bank-details/{emp_id}`| Get bank account details for employee | `payroll:read` |
| `POST` | `/payroll/bank-details` | Register bank account details | `payroll:manage` |
| `POST` | `/payroll/runs` | Initiate monthly payroll processing run | `payroll:run` |
| `GET` | `/payroll/payslips` | Download or view generated employee payslip | Authenticated |

### 7. Projects & Performance Reviews (`/projects`, `/reviews`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `GET` | `/projects` | List active organization projects | Authenticated |
| `POST` | `/projects` | Create new project | `project:create` |
| `POST` | `/projects/{id}/members` | Assign employee to project team | `project:update` |
| `GET` | `/reviews` | List performance reviews | `review:read` |
| `POST` | `/reviews` | Create and publish performance review | `review:create` |

### 8. Documents, Announcements & Audit (`/documents`, `/announcements`, `/audit-logs`)
| Method | Endpoint | Description | Access Level |
|---|---|---|---|
| `POST` | `/documents/upload` | Upload employee verification/identity document | `document:create` |
| `GET` | `/documents/{emp_id}` | List documents uploaded for employee | `document:read` |
| `GET` | `/announcements` | List published organization announcements | Authenticated |
| `POST` | `/announcements` | Create organization or department announcement | `announcement:create`|
| `GET` | `/audit-logs` | Query system operation audit trails | `audit:read` |

---

## Documentation Artifacts

Detailed engineering specifications and architectural diagrams are available in the [`docs/`](./docs) directory:

- [**System Architecture Document**](./docs/System%20Architecture.docx): In-depth system design, tiered architecture, components, and design decisions.
- [**Software Requirements Specification (SRS)**](./docs/SRS%20employee%20managmeent%20system.pdf): Functional & non-functional requirements, use cases, and validation rules.
- [**Entity-Relationship (ER) Diagram**](./docs/Employee%20management%20%20ER%20Diagram.pdf): Visual schema depicting tables, foreign key constraints, and relational mappings.

---

## License

This project is distributed under the MIT License. Feel free to modify and use it for commercial and educational purposes.
