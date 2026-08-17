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
from .attendance_services import (
    check_in_employee,
    check_out_employee,
    create_manual_record as create_manual_attendance,
    update_record as update_attendance_record,
    delete_record as delete_attendance_record,
    get_record_by_id as get_attendance_by_id,
    get_all_records as get_all_attendance,
    get_employee_attendance,
    get_monthly_summary as get_employee_monthly_attendance_summary,
    get_yearly_summary as get_employee_yearly_attendance_summary,
    get_today_attendance_overview,
)