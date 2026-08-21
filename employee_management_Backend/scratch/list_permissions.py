import sys
sys.path.insert(0, 'src')
from database import SessionLocal
from models.user import Permission

with SessionLocal() as db:
    perms = db.query(Permission).order_by(Permission.permission_name).all()
    for p in perms:
        print(f"Perm: {p.permission_name} - {p.description}")
