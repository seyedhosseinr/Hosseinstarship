import sqlite3
db = sqlite3.connect('local.db')
tasks = db.execute('SELECT id, title, taskType, status, estimatedMinutes FROM study_tasks LIMIT 3').fetchall()
for t in tasks:
    print(t[1][:40], t[2], t[3])
types = db.execute('SELECT taskType, COUNT(*) FROM study_tasks GROUP BY taskType').fetchall()
print("\nTASK TYPES:")
for t in types:
    print(t[0], ":", t[1])
db.close()
