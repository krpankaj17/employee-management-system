# src/repository/auth_repo.py
import datetime
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session, joinedload
from models.user import User, Role, Permission, RolePermission, UserRole


import uuid


def get_user_by_email(email: str, db: Session) -> User | None:
    """Finds user by email (case-insensitive) with roles and employee loaded."""
    if not email:
        return None
    stmt = (
        select(User)
        .options(
            joinedload(User.employee),
            joinedload(User.roles).joinedload(Role.permissions),
        )
        .where(func.lower(User.email) == email.strip().lower())
    )
    return db.scalar(stmt)


def get_user_by_public_id(public_id: str, db: Session) -> User | None:
    """Finds user by public UUID."""
    if not public_id:
        return None
    try:
        uuid_obj = uuid.UUID(str(public_id).strip())
    except (ValueError, AttributeError):
        return None

    stmt = (
        select(User)
        .options(
            joinedload(User.employee),
            joinedload(User.roles).joinedload(Role.permissions),
        )
        .where(User.public_id == uuid_obj)
    )
    return db.scalar(stmt)


def get_user_by_id(user_id: int, db: Session) -> User | None:
    """Finds user by internal ID."""
    stmt = (
        select(User)
        .options(
            joinedload(User.employee),
            joinedload(User.roles).joinedload(Role.permissions),
        )
        .where(User.user_id == user_id)
    )
    return db.scalar(stmt)


def get_all_users(
    db: Session, skip: int = 0, limit: int | None = None
) -> tuple[list[User], int]:
    """Retrieves all users with eager-loaded employee and roles/permissions and total count."""
    count_stmt = select(func.count(User.user_id))
    total = db.scalar(count_stmt) or 0

    stmt = (
        select(User)
        .options(
            joinedload(User.employee),
            joinedload(User.roles).joinedload(Role.permissions),
        )
        .order_by(User.user_id)
        .offset(skip)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    items = list(db.scalars(stmt).unique().all())
    return items, total


def get_pending_users(
    db: Session, skip: int = 0, limit: int | None = None
) -> tuple[list[User], int]:
    """Retrieves users who do not have any roles assigned (pending approval) and total count."""
    count_stmt = select(func.count(User.user_id)).where(~User.user_roles.any())
    total = db.scalar(count_stmt) or 0

    stmt = (
        select(User)
        .options(
            joinedload(User.employee),
            joinedload(User.roles).joinedload(Role.permissions),
        )
        .where(~User.user_roles.any())
        .order_by(User.user_id)
        .offset(skip)
    )
    if limit is not None:
        stmt = stmt.limit(limit)
    items = list(db.scalars(stmt).unique().all())
    return items, total


def create_user(
    db: Session,
    email: str,
    display_name: str,
    password_hash: str,
    secondary_email: str | None = None,
    default_role: str | None = None,
) -> User:
    """Creates a user. If default_role is supplied, assigns that role; otherwise creates user with no roles."""
    clean_email = email.strip().lower()
    user = User(
        email=clean_email,
        display_name=display_name.strip(),
        password_hash=password_hash,
        secondary_email=secondary_email.strip().lower() if secondary_email else None,
        is_active=True,
    )
    db.add(user)
    db.flush()

    if default_role:
        role = db.scalar(select(Role).where(func.lower(Role.role_name) == default_role.lower()))
        if role:
            user_role = UserRole(user_id=user.user_id, role_id=role.role_id)
            db.add(user_role)

    db.commit()
    db.refresh(user)
    return user


def update_last_login(user_id: int, db: Session) -> None:
    """Stamps last_login timestamp."""
    user = db.scalar(select(User).where(User.user_id == user_id))
    if user:
        user.last_login = datetime.datetime.now(datetime.timezone.utc)
        db.commit()


def set_password_reset_token(
    user_id: int, token: str, expires_at: datetime.datetime, db: Session
) -> None:
    """Stores password reset token."""
    user = db.scalar(select(User).where(User.user_id == user_id))
    if user:
        user.password_reset_token = token
        user.password_reset_expires_at = expires_at
        user.password_reset_used_at = None
        db.commit()


def get_user_by_reset_token(token: str, db: Session) -> User | None:
    """Finds user with valid unexpired and unused reset token."""
    now = datetime.datetime.now(datetime.timezone.utc)
    stmt = (
        select(User)
        .where(
            User.password_reset_token == token,
            User.password_reset_expires_at > now,
            User.password_reset_used_at.is_(None),
        )
    )
    return db.scalar(stmt)


def update_password(user_id: int, password_hash: str, db: Session) -> None:
    """Updates password hash, increments token_version (invalidating active sessions), and marks reset token as used."""
    user = db.scalar(select(User).where(User.user_id == user_id))
    if user:
        user.password_hash = password_hash
        user.token_version = (user.token_version or 1) + 1
        user.password_reset_used_at = datetime.datetime.now(datetime.timezone.utc)
        user.password_reset_token = None
        db.commit()



def get_user_roles(user_id: int, db: Session) -> list[str]:
    """Returns all role names assigned to a user."""
    stmt = (
        select(Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .where(UserRole.user_id == user_id)
    )
    return list(db.scalars(stmt).all())


def get_user_permissions(user_id: int, db: Session) -> list[str]:
    """Returns distinct permission names granted across all user roles."""
    stmt = (
        select(Permission.permission_name)
        .distinct()
        .join(RolePermission, RolePermission.permission_id == Permission.permission_id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .where(UserRole.user_id == user_id)
    )
    return list(db.scalars(stmt).all())


def get_all_roles(db: Session) -> list[Role]:
    """Lists all roles with their permissions eager-loaded."""
    stmt = select(Role).options(joinedload(Role.permissions)).order_by(Role.role_id)
    return list(db.scalars(stmt).unique().all())


def get_role_by_name(role_name: str, db: Session) -> Role | None:
    """Gets role by name."""
    stmt = (
        select(Role)
        .options(joinedload(Role.permissions))
        .where(func.lower(Role.role_name) == role_name.strip().lower())
    )
    return db.scalar(stmt)


def get_all_permissions(db: Session) -> list[Permission]:
    """Lists all permissions."""
    stmt = select(Permission).order_by(Permission.permission_id)
    return list(db.scalars(stmt).all())


def assign_roles_to_user(user_id: int, role_ids: list[int], db: Session) -> None:
    """Overwrites user roles with the given role_ids list."""
    db.execute(delete(UserRole).where(UserRole.user_id == user_id))
    for r_id in role_ids:
        db.add(UserRole(user_id=user_id, role_id=r_id))
    db.commit()


def get_role_by_identifier(identifier: str, db: Session) -> Role | None:
    """Gets role by public UUID or case-insensitive role name."""
    if not identifier:
        return None
    clean_id = identifier.strip()
    try:
        uuid_obj = uuid.UUID(clean_id)
        stmt = (
            select(Role)
            .options(joinedload(Role.permissions))
            .where(
                (Role.public_id == uuid_obj) | (func.lower(Role.role_name) == clean_id.lower())
            )
        )
    except (ValueError, AttributeError):
        stmt = (
            select(Role)
            .options(joinedload(Role.permissions))
            .where(func.lower(Role.role_name) == clean_id.lower())
        )
    return db.scalar(stmt)


def get_permission_by_name(permission_name: str, db: Session) -> Permission | None:
    """Gets permission by name."""
    stmt = select(Permission).where(func.lower(Permission.permission_name) == permission_name.strip().lower())
    return db.scalar(stmt)


def create_role(
    role_name: str,
    description: str | None,
    permission_ids: list[int],
    db: Session,
) -> Role:
    """Creates a new role and attaches permissions."""
    role = Role(role_name=role_name.strip(), description=description.strip() if description else None)
    db.add(role)
    db.flush()

    for pid in permission_ids:
        db.add(RolePermission(role_id=role.role_id, permission_id=pid))
    db.commit()
    db.refresh(role)
    return role


def update_role(
    role: Role,
    role_name: str | None,
    description: str | None,
    permission_ids: list[int] | None,
    db: Session,
) -> Role:
    """Updates role metadata and optionally replaces permissions."""
    if role_name is not None:
        role.role_name = role_name.strip()
    if description is not None:
        role.description = description.strip() if description else None

    if permission_ids is not None:
        db.execute(delete(RolePermission).where(RolePermission.role_id == role.role_id))
        for pid in permission_ids:
            db.add(RolePermission(role_id=role.role_id, permission_id=pid))

    db.commit()
    db.refresh(role)
    return role


def add_permissions_to_role(
    role: Role,
    permission_ids: list[int],
    db: Session,
) -> Role:
    """Adds permissions to role without duplicating existing ones."""
    existing_pids = {p.permission_id for p in role.permissions}
    for pid in permission_ids:
        if pid not in existing_pids:
            db.add(RolePermission(role_id=role.role_id, permission_id=pid))
    db.commit()
    db.refresh(role)
    return role


def revoke_permission_from_role(
    role_id: int,
    permission_id: int,
    db: Session,
) -> None:
    """Revokes a single permission from a role."""
    db.execute(
        delete(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
    )
    db.commit()


def delete_role(role: Role, db: Session) -> None:
    """Deletes a role and cascading associations."""
    db.execute(delete(RolePermission).where(RolePermission.role_id == role.role_id))
    db.execute(delete(UserRole).where(UserRole.role_id == role.role_id))
    db.delete(role)
    db.commit()


def revoke_role_from_user(user_id: int, role_id: int, db: Session) -> None:
    """Revokes a specific role assignment from a user."""
    db.execute(
        delete(UserRole).where(
            UserRole.user_id == user_id,
            UserRole.role_id == role_id,
        )
    )
    db.commit()

