#!/usr/bin/env python3
"""Compare the step expressions in e2e/STEPS.md with those implemented in e2e/steps/*.ts. Exit 1 on any difference."""
import glob, os, re, sys

E2E = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = open(os.path.join(E2E, 'STEPS.md'), encoding='utf-8').read()
wanted = {l.strip() for b in re.findall(r'```\n(.*?)```', text, re.S) for l in b.splitlines() if l.strip()}
impl = set()
for f in glob.glob(os.path.join(E2E, 'steps', '*.ts')):
    for m in re.finditer(r"""\b(?:Given|When|Then|Step)\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1""", open(f, encoding='utf-8').read()):
        impl.add(re.sub(r"\\(['\"])", r"\1", m.group(2)))  # a TS literal writes a quote as \' or \"
missing, extra = sorted(wanted - impl), sorted(impl - wanted)
for e in missing: print('missing: ' + e)
for e in extra: print('extra:   ' + e)
print(f'{len(wanted)} expressions in STEPS.md, {len(impl)} implemented, {len(missing)} missing, {len(extra)} extra')
sys.exit(1 if missing or extra else 0)
