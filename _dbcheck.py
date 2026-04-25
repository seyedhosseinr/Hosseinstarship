import sqlite3
db = sqlite3.connect('local.db')
tables = db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
for t in tables:
    c = db.execute(f"SELECT COUNT(*) FROM [{t[0]}]").fetchone()[0]
    print(f"{t[0]}: {c}")
db.close()
