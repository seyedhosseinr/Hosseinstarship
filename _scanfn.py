import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
f = open(r'src/app/notebooks/[id]/page.tsx','r',encoding='utf-8').readlines()
for i,line in enumerate(f):
    s = line.strip()
    if (s.startswith('function ') or s.startswith('export default function') or 
        (s.startswith('//') and len(s) > 20) or
        s.startswith('/* ')):
        if len(s) < 120:
            print(f'{i+1}: {s}')
