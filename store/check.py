"""Vérifie la longueur des champs des fiches stores : python3 store/check.py"""
import re, sys
md = open(__file__.replace('check.py', 'fiches-stores.md'), encoding='utf-8').read()
ok = True
for m in re.finditer(r'\*\*([^*\n]+?) \((\d+)\)\*\*\n(.+?)(?=\n\*\*|\n###|\n---|\Z)', md, re.S):
    label, limit, text = m.group(1), int(m.group(2)), m.group(3).strip()
    if text.startswith(('Reprendre', 'Use the')):
        continue
    n = len(text)
    flag = 'OK ' if n <= limit else 'TROP LONG'
    ok &= n <= limit
    print(f'{flag} {label:<28} {n:>4} / {limit}')
sys.exit(0 if ok else 1)
