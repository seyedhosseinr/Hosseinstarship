import os
noteDir = r'src\app\notebooks\[id]'
files = os.listdir(noteDir)
print("Files in [id]:", files)
for f in files:
    path = os.path.join(noteDir, f)
    print(f"  {f}: {os.path.getsize(path)} bytes")
