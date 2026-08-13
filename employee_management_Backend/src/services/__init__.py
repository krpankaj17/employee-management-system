#__init__.py
from .employee_services import (
    get_all_records,
    get_record_by_id,
    get_record_by_email,
    get_direct_reports,
    get_record_choices,
    create_new_record,
    update_records,
    delete_record,
    search_records,
    sort_records,
    SORT_KEYS,
)
from .department_services import (
    get_all_records as get_all_departments,
    get_record_by_id as get_department_by_id,
    get_department_choices,
    create_new_record as create_new_department,
    update_records as update_department,
    delete_record as delete_department,
    get_department_employees,
)