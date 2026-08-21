import sys
sys.path.insert(0, 'src')
from database import engine
from sqlalchemy import inspect

insp = inspect(engine)
t = 'salaries'
print('=' * 20, t, '=' * 20)
for c in insp.get_columns(t):
    print(c['name'], ':', c['type'], 'nullable=', c['nullable'], 'default=', c.get('default'))
print('PK:', insp.get_pk_constraint(t))
print('FKs:', insp.get_foreign_keys(t))
print('Unique:', insp.get_unique_constraints(t))
print('Indexes:', insp.get_indexes(t))
print('Check:', insp.get_check_constraints(t))
