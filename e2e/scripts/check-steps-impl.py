#!/usr/bin/env python3
"""Compare the step expressions in e2e/STEPS.md with those implemented in e2e/steps/*.ts. Exit 1 on any difference."""
import glob, os, re, sys

E2E = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = open(os.path.join(E2E, 'STEPS.md'), encoding='utf-8').read()
wanted = {l.strip() for b in re.findall(r'```\n(.*?)```', text, re.S) for l in b.splitlines() if l.strip()}
impl, regexes = set(), []
for f in glob.glob(os.path.join(E2E, 'steps', '*.ts')):
    src = open(f, encoding='utf-8').read()
    for m in re.finditer(r"""\b(?:Given|When|Then|Step)\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1""", src):
        impl.add(re.sub(r"\\(['\"])", r"\1", m.group(2)))  # a TS literal writes a quote as \' or \"
    for m in re.finditer(r"\b(?:Given|When|Then|Step)\(\s*/((?:[^/\\\n]|\\.)+)/", src):
        regexes.append(re.compile(m.group(1)))  # a step defined by a regular expression, not a Cucumber expression
# A STEPS.md expression is covered by a regex step when the regex matches it with sample parameter values.
SAMPLE = {'string': '"x"', 'int': '1', 'float': '1.5', 'date': '2026-10-12', 'month': '2026-10', 'time': '09:00',
          'view': 'week', 'datelist': '2026-10-12', 'scheme': 'light', 'weekday': '"Monday"'}
by_regex = {e for e in wanted - impl if any(r.match(re.sub(r'\{(\w+)\}', lambda p: SAMPLE.get(p.group(1), 'x'), e)) for r in regexes)}
missing, extra = sorted(wanted - impl - by_regex), sorted(impl - wanted)
for e in missing: print('missing: ' + e)
for e in extra: print('extra:   ' + e)
print(f'{len(wanted)} expressions in STEPS.md, {len(impl) + len(by_regex)} implemented, {len(missing)} missing, {len(extra)} extra')
sys.exit(1 if missing or extra else 0)
