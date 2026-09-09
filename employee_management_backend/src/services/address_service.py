# src/services/address_service.py
import re
import utils
from sqlalchemy.orm import Session
from repository import employee_repository as emp_repo
from repository import address_repo
from schemas.address_schema import AddressIn, EmergencyContactIn

PINCODE_REGEX = re.compile(r"^[0-9A-Za-z \-]{3,10}$")
VALID_ADDRESS_TYPES = {"current", "permanent"}


def get_addresses(employee_public_id: str, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}
    addresses = address_repo.get_employee_addresses(emp.emp_id, db=db)
    return {"ok": True, "addresses": addresses}


def add_address(employee_public_id: str, payload: AddressIn, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}

    addr_type = payload.address_type.strip().lower()
    if addr_type not in VALID_ADDRESS_TYPES:
        return {"ok": False, "error": "validation", "message": f"Address type must be one of {sorted(VALID_ADDRESS_TYPES)}"}

    if not PINCODE_REGEX.match(payload.pincode.strip()):
        return {"ok": False, "error": "validation", "message": "Invalid pincode format (expected 3 to 10 alphanumeric characters or hyphens)"}

    result = address_repo.add_employee_address(
        emp_id=emp.emp_id,
        street_address=payload.street_address,
        city=payload.city,
        state=payload.state,
        country=payload.country,
        pincode=payload.pincode,
        address_type=addr_type,
        is_primary=payload.is_primary,
        db=db,
    )
    utils.log_action("ADDRESS_ADDED", f"emp={employee_public_id} type={addr_type}")
    return {"ok": True, "address": result}


def delete_address(employee_public_id: str, address_public_id: str, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}

    success = address_repo.delete_employee_address(emp.emp_id, address_public_id, db=db)
    if not success:
        return {"ok": False, "error": "not_found", "message": "Address not found or not linked to this employee"}

    utils.log_action("ADDRESS_DELETED", f"emp={employee_public_id} addr={address_public_id}")
    return {"ok": True, "details": "Address deleted successfully"}


def get_emergency_contacts(employee_public_id: str, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}
    contacts = address_repo.get_emergency_contacts(emp.emp_id, db=db)
    return {"ok": True, "contacts": [c.to_dict() for c in contacts]}


def add_emergency_contact(employee_public_id: str, payload: EmergencyContactIn, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}

    if len(payload.phone.strip()) < 7 or len(payload.phone.strip()) > 15:
        return {"ok": False, "error": "validation", "message": "Phone number must be between 7 and 15 digits"}

    if payload.email and not utils.is_valid_email(payload.email.strip()):
        return {"ok": False, "error": "validation", "message": "Invalid email address format"}

    contact = address_repo.add_emergency_contact(
        emp_id=emp.emp_id,
        contact_name=payload.contact_name,
        relationship=payload.relationship,
        phone=payload.phone,
        email=payload.email,
        is_primary=payload.is_primary,
        db=db,
    )
    utils.log_action("EMERGENCY_CONTACT_ADDED", f"emp={employee_public_id} name={payload.contact_name}")
    return {"ok": True, "contact": contact.to_dict()}


def delete_emergency_contact(employee_public_id: str, contact_id: int, db: Session) -> dict:
    emp = emp_repo.get_by_public_id(employee_public_id, db=db)
    if not emp:
        return {"ok": False, "error": "not_found", "message": f"Employee with public_id '{employee_public_id}' not found"}

    success = address_repo.delete_emergency_contact(emp.emp_id, contact_id, db=db)
    if not success:
        return {"ok": False, "error": "not_found", "message": f"Emergency contact with id {contact_id} not found"}

    utils.log_action("EMERGENCY_CONTACT_DELETED", f"emp={employee_public_id} id={contact_id}")
    return {"ok": True, "details": "Emergency contact deleted successfully"}
