#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import re, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]
errors=[]; warnings=[]; passed=[]

def ok(msg): passed.append(msg)
def fail(msg): errors.append(msg)
def warn(msg): warnings.append(msg)

index=(ROOT/'index.html').read_text(encoding='utf-8')
settings=(ROOT/'settings.html').read_text(encoding='utf-8')
app=(ROOT/'app.js').read_text(encoding='utf-8')
css=(ROOT/'styles.css').read_text(encoding='utf-8')

ids=re.findall(r'\bid=["\']([^"\']+)', index)
dup=[i for i,n in Counter(ids).items() if n>1]
if dup: fail(f'Duplicate HTML ids: {dup}')
else: ok('No duplicate IDs in index.html')

critical=['tripSelect','tripTitle','startDate','endDate','destination','tripNotes','editTripDetailsBtn','logoutBtn','notificationsBtn','avatarFunBtn','memoryList','onboardingDialog']
missing=[i for i in critical if i not in ids]
if missing: fail(f'Missing critical UI IDs: {missing}')
else: ok('Critical production controls exist')

for token in ['openTripDetailsEditor', "editTripDetailsBtn.addEventListener", "destination: els.destination.value.trim()", "client.from('itinerary_trips').update(patch)"]:
    if token not in app: fail(f'Trip editing pipeline missing: {token}')
else:
    if not any('Trip editing pipeline' in e for e in errors): ok('Trip destination editing pipeline is wired end-to-end')

if 'WeTrack V2.2.0 Production' in app: ok('V2.2 production build marker found')
else: fail('V2.2 build marker missing')
if './app.js?v=490' in index and './styles.css?v=490' in index: ok('Production cache version is consistent')
else: fail('Cache version mismatch in index.html')

# JavaScript syntax when Node is available
try:
    p=subprocess.run(['node','--check',str(ROOT/'app.js')], capture_output=True, text=True)
    if p.returncode: fail('app.js syntax check failed: '+p.stderr.strip())
    else: ok('app.js passes Node syntax validation')
except FileNotFoundError:
    warn('Node not installed; skipped app.js syntax validation')

required_files=['schema.sql','README.md','AUDIT_REPORT.md','DEPLOYMENT_CHECKLIST.md','ios/WeTrack/WeTrack/ContentView.swift','repo-root/.github/workflows/ios-ipa.yml']
missing_files=[p for p in required_files if not (ROOT/p).exists()]
if missing_files: fail(f'Missing release files: {missing_files}')
else: ok('Release package contains web, SQL, iOS, workflow, and deployment documentation')

print('WeTrack V2.0 Production Audit')
for x in passed: print('PASS:',x)
for x in warnings: print('WARN:',x)
for x in errors: print('FAIL:',x)
print(f'\nSummary: {len(passed)} passed, {len(warnings)} warnings, {len(errors)} failed')
sys.exit(1 if errors else 0)
