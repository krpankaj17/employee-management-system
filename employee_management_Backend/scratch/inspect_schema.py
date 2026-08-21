import sys
sys.path.insert(0, 'src')
from database import engine
from sqlalchemy import inspect

insp = inspect(engine)
tables = ['salaries', 'salary_components', 'bank_details', 'payroll_runs']

for t in tables:
    print('=' * 20, t, '=' * 20)
    for c in insp.get_columns(t):
        print(f"  Col: {c['name']} | Type: {c['type']} | Nullable: {c['nullable']} | Default: {c.get('default')}")
    print('  PK:', insp.get_pk_constraint(t))
    print('  FKs:', insp.get_foreign_keys(t))
    print('  Unique Constraints:', insp.get_unique_constraints(t))
    print('  Indexes:', insp.get_indexes(t))
    print('  Check Constraints:', insp.get_check_constraints(t))
