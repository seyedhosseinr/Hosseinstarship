import os

def read_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.readlines()

# Read main notebooks files
print("=== NotebooksScreen.tsx ===")
lines = read_lines(r'src\app\notebooks\NotebooksScreen.tsx')
for i in range(min(50, len(lines))):
    print(f"{i+1}: {lines[i]}", end='')

print("\n\n=== notebooks/[id]/page.tsx ===")
lines = read_lines(r'src\app\notebooks\[id]\page.tsx')
for i in range(min(100, len(lines))):
    print(f"{i+1}: {lines[i]}", end='')
