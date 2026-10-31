#!/usr/bin/env python3
"""Creates a new single-use gift code (page Recharger → Code cadeau).

    python3 tools/code.py            # one code worth 5 000 KE
    python3 tools/code.py 3 2500     # three codes worth 2 500 KE each

Prints the codes to give out. Only their SHA-256 goes into index.html (const CODES in pages/account.js), so the
published site never shows a usable code. Each code can be used once, by one account (Firestore codes/{hash}).
Commit and push index.html afterwards, or the new codes will not work on the site.
"""
import datetime, hashlib, pathlib, re, secrets, sys

ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/O, 1/I: easy to type
root = pathlib.Path(__file__).resolve().parent.parent
index = root / 'index.html'

n = int(sys.argv[1]) if len(sys.argv) > 1 else 1
amount = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
s = index.read_text(encoding='utf8')
assert s.count('  // CODES-END') == 1, 'marker CODES-END not found in index.html'
today = datetime.date.today().isoformat()
lines, codes = [], []
for _ in range(n):
    a = ''.join(secrets.choice(ALPHA) for _ in range(5))
    b = ''.join(secrets.choice(ALPHA) for _ in range(5))
    code = f'SPIN-{a}-{b}'
    norm = re.sub(r'[^A-Z0-9]', '', code)
    lines.append(f"  '{hashlib.sha256(norm.encode()).hexdigest()}': {amount}, // {today}\n")
    codes.append(code)
s = s.replace('  // CODES-END', ''.join(lines) + '  // CODES-END')
index.write_text(s, encoding='utf8')
for c in codes:
    print(f'{c}  ({amount} KE)')
