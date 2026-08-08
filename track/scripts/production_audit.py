#!/usr/bin/env python3
from pathlib import Path
from collections import Counter
import re, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]; warnings=[]; passed=[]
def ok(x): passed.append(x)
def fail(x): errors.append(x)
def warn(x): warnings.append(x)
index=(ROOT/'index.html').read_text(encoding='utf-8')
app=(ROOT/'app.js').read_text(encoding='utf-8')
schema=(ROOT/'schema.sql').read_text(encoding='utf-8')
ids=re.findall(r'\bid=["\']([^"\']+)',index)
dups=[x for x,n in Counter(ids).items() if n>1]
(ok if not dups else fail)('No duplicate IDs in index.html' if not dups else f'Duplicate HTML IDs: {dups}')
for token,label in [
 ('ensure_itinerary_starter_packing','Transactional packing seed helper wired'),
 ('dedupeStarterPackingRows','Client packing duplicate protection wired'),
 ('itinerary_must_do_items','Correct Must Do table name present'),
 ('onboardingCompletedRemote = completed','Merged onboarding completion logic present'),
 ("./app.js?v=480",'App cache version v480 present'),
 ("./styles.css?v=480",'CSS cache version v480 present')]:
    (ok if token in (app+index+schema) else fail)(label)
if "'itinerary_must_do'" in app or "'itinerary_must_do'" in schema: fail('Legacy itinerary_must_do realtime typo remains')
else: ok('No legacy Must Do realtime table typo remains')
try:
    p=subprocess.run(['node','--check',str(ROOT/'app.js')],capture_output=True,text=True)
    if p.returncode: fail('app.js syntax check failed: '+p.stderr.strip())
    else: ok('app.js passes Node syntax validation')
except FileNotFoundError: warn('Node unavailable; skipped JS syntax check')
required=['schema.sql','v29_stabilization_repair.sql','README.md','AUDIT_REPORT.md','index.html','settings.html','app.js','styles.css']
missing=[x for x in required if not (ROOT/x).exists()]
if missing: fail(f'Missing release files: {missing}')
else: ok('All stabilization release files present')
print('WeTrack V2.9 Stabilization Audit')
for x in passed: print('PASS:',x)
for x in warnings: print('WARN:',x)
for x in errors: print('FAIL:',x)
print(f'\nSummary: {len(passed)} passed, {len(warnings)} warnings, {len(errors)} failed')
sys.exit(1 if errors else 0)
