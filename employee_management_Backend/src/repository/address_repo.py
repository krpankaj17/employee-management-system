# src/repository/address_repo.py
import re
from sqlalchemy import select, update, delete
from sqlalchemy.orm import Session, joinedload
from models.address import Address, EmployeeAddress
from models.employee import EmergencyContact


def get_employee_addresses(emp_id: int, db: Session) -> list[dict]:
    """Fetches all addresses linked to an employee."""
    stmt = (
        select(EmployeeAddress)
        .options(joinedload(EmployeeAddress.address))
        .where(EmployeeAddress.employee_id == emp_id)
        .order_by(EmployeeAddress.is_primary.desc())
    )
    links = db.scalars(stmt).all()
    return [link.to_dict() for link in links]


def add_employee_address(
    emp_id: int,
    street_address: str,
    city: str,
    state: str,
    pincode: str,
    db: Session,
    country: str = "India",
    address_type: str = "current",
    is_primary: bool = False,
) -> dict:
    """Creates an Address and links it to Employee, handling primary flag and unique address_type constraint."""
    # If this address is primary, unset is_primary on existing links for this employee
    if is_primary:
        db.execute(
            update(EmployeeAddress)
            .where(EmployeeAddress.employee_id == emp_id)
            .values(is_primary=False)
        )

    # If an address of this type already exists, remove the previous link
    existing_link = db.scalar(
        select(EmployeeAddress).where(
            EmployeeAddress.employee_id == emp_id,
            EmployeeAddress.address_type == address_type.strip().lower(),
        )
    )
    if existing_link:
        old_addr_id = existing_link.address_id
        db.delete(existing_link)
        db.flush()
        # Clean up orphaned address row if not referenced elsewhere
        other_ref = db.scalar(select(EmployeeAddress).where(EmployeeAddress.address_id == old_addr_id))
        if not other_ref:
            addr_to_del = db.scalar(select(Address).where(Address.address_id == old_addr_id))
            if addr_to_del:
                db.delete(addr_to_del)

    # Create new Address
    addr = Address(
        street_address=street_address.strip(),
        city=city.strip(),
        state=state.strip(),
        country=country.strip(),
        pincode=pincode.strip(),
    )
    db.add(addr)
    db.flush()

    # Link Employee to Address
    emp_addr = EmployeeAddress(
        employee_id=emp_id,
        address_id=addr.address_id,
        address_type=address_type.strip().lower(),
        is_primary=is_primary,
    )
    db.add(emp_addr)
    db.commit()

    return emp_addr.to_dict()


def delete_employee_address(emp_id: int, address_public_id: str, db: Session) -> bool:
    """Removes an address from an employee."""
    addr = db.scalar(select(Address).where(Address.public_id == address_public_id))
    if not addr:
        return False

    link = db.scalar(
        select(EmployeeAddress).where(
            EmployeeAddress.employee_id == emp_id,
            EmployeeAddress.address_id == addr.address_id,
        )
    )
    if not link:
        return False

    db.delete(link)
    db.delete(addr)
    db.commit()
    return True


def get_emergency_contacts(emp_id: int, db: Session) -> list[EmergencyContact]:
    """Fetches all emergency contacts for an employee."""
    stmt = (
        select(EmergencyContact)
        .where(EmergencyContact.emp_id == emp_id)
        .order_by(EmergencyContact.is_primary.desc(), EmergencyContact.contact_id)
    )
    return list(db.scalars(stmt).all())


def add_emergency_contact(
    emp_id: int,
    contact_name: str,
    relationship: str,
    phone: str,
    db: Session,
    email: str | None = None,
    is_primary: bool = False,
) -> EmergencyContact:
    """Adds an emergency contact for an employee, handling single primary contact partial unique index."""
    if is_primary:
        db.execute(
            update(EmergencyContact)
            .where(EmergencyContact.emp_id == emp_id)
            .values(is_primary=False)
        )

    contact = EmergencyContact(
        emp_id=emp_id,
        contact_name=contact_name.strip(),
        relationship=relationship.strip(),
        phone=phone.strip(),
        email=email.strip().lower() if email else None,
        is_primary=is_primary,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def delete_emergency_contact(emp_id: int, contact_id: int, db: Session) -> bool:
    """Deletes an emergency contact."""
    contact = db.scalar(
        select(EmergencyContact).where(
            EmergencyContact.emp_id == emp_id,
            EmergencyContact.contact_id == contact_id,
        )
    )
    if not contact:
        return False

    db.delete(contact)
    db.commit()
    return True
