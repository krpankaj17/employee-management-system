# src/repository/auth_repo.py
import datetime
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session, joinedload
from models.user import User, Role, Permission, RolePermission, UserRole


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
    stmt = (
        select(User)
        .options(
            joinedload(User.employee),
            joinedload(User.roles).joinedload(Role.permissions),
        )
        .where(User.public_id == public_id)
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


def create_user(
    db: Session,
    email: str,
    display_name: str,
    password_hash: str,
    secondary_email: str | None = None,
    default_role: str = "Employee",
) -> User:
    """Creates a user and automatically assigns the default role."""
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

    # Assign default role (e.g. 'Employee')
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
    """Updates password hash and marks reset token as used."""
    user = db.scalar(select(User).where(User.user_id == user_id))
    if user:
        user.password_hash = password_hash
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
