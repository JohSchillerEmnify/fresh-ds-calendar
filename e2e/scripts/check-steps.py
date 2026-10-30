#!/usr/bin/env python3
"""Verify every step in spec/features/**/*.feature (outlines expanded) matches exactly one
expression in e2e/STEPS.md, and report unused expressions. Exit 1 on problems."""
import glob, os, re, sys

E2E = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(os.path.dirname(E2E), 'spec')
PARAMS = {
    'string': r'(?:"[^"]*"|\'[^\']*\')', 'int': r'-?\d+', 'date': r'\d{4}-\d{2}-\d{2}', 'month': r'\d{4}-\d{2}',
    'time': r'\d{2}:\d{2}', 'view': r'(?:year|month|week|day)',
    'datelist': r'\d{4}-\d{2}-\d{2}(?:(?:, | and )\d{4}-\d{2}-\d{2})*',
    'scheme': r'(?:light|dark)', 'float': r'-?\d+(?:\.\d+)?',
    'weekday': r'"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"',
}
STEP = re.compile(r'\s*(Given|When|Then|And|But)\s+(.*?)\s*$')

def lit(text):
    """Escape literal text; Cucumber optional text like 'flower(s)' becomes optional."""
    out, i = '', 0
    for m in re.finditer(r'\(([^)]*)\)', text):
        out += re.escape(text[i:m.start()]) + '(?:' + re.escape(m.group(1)) + ')?'
        i = m.end()
    return out + re.escape(text[i:])

def to_regex(expr):
    out, i = '', 0
    for m in re.finditer(r'\{(\w+)\}', expr):
        out += lit(expr[i:m.start()]) + PARAMS[m.group(1)]
        i = m.end()
    return re.compile('^' + out + lit(expr[i:]) + '$')

def cells(line):
    return [c.strip() for c in line.strip().strip('|').split('|')]

def steps_of(path):
    """Yield (line_no, step_text, scenario_name) with outline placeholders substituted."""
    lines = open(path, encoding='utf-8').read().splitlines()
    i, scen, pending, outline = 0, None, [], False
    def flush():
        if not outline:
            for n, s in pending:
                yield n, s, scen
    while i < len(lines):
        l = lines[i]
        s = l.strip()
        if re.match(r'(Scenario|Scenario Outline|Background|Feature):', s):
            yield from flush()
            scen, pending = s.split(':', 1)[1].strip(), []
            outline = s.startswith('Scenario Outline')
        elif s.startswith('Examples:'):
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith('|'):
                j += 1
            header = cells(lines[j]); j += 1
            while j < len(lines) and lines[j].strip().startswith('|'):
                row = dict(zip(header, cells(lines[j])))
                for n, st in pending:
                    yield n, re.sub(r'<([^>]+)>', lambda m: row.get(m.group(1), m.group(0)), st), scen
                j += 1
            i = j
            continue
        else:
            m = STEP.match(l)
            if m:
                pending.append((i + 1, m.group(2)))
        i += 1
    yield from flush()

text = open(os.path.join(E2E, 'STEPS.md'), encoding='utf-8').read()
exprs = [l.strip() for b in re.findall(r'```\n(.*?)```', text, re.S) for l in b.splitlines() if l.strip()]
regs = [(e, to_regex(e)) for e in exprs]
bad, used, count = 0, set(), 0
for f in sorted(glob.glob(os.path.join(SPEC, 'features', '**', '*.feature'), recursive=True)):
    for n, step, scen in steps_of(f):
        count += 1
        hits = [e for e, r in regs if r.match(step)]
        if len(hits) != 1:
            bad += 1
            print(f'{os.path.relpath(f, SPEC)}:{n}: {len(hits)} matches: {step!r} {hits}')
        used.update(hits)
unused = [e for e in exprs if e not in used]
print(f'{count} expanded steps, {len(exprs)} expressions, {len(unused)} unused, {bad} problems')
for e in unused:
    print('  unused: ' + e)

# every @unit scenario names the unit test that proves it: "# unit: <file>:<test name>", the file existing and containing the name
ROOT = os.path.dirname(SPEC)
unit_bad = unit_count = 0
for f in sorted(glob.glob(os.path.join(SPEC, 'features', '**', '*.feature'), recursive=True)):
    tags, refs = [], []
    for n, l in enumerate(open(f, encoding='utf-8').read().splitlines(), 1):
        s = l.strip()
        if s.startswith('@'):
            tags += s.split()
        elif s.startswith('# unit:'):
            refs.append(s[len('# unit:'):].strip())
        elif re.match(r'(Scenario|Scenario Outline):', s):
            if '@unit' in tags:
                unit_count += 1
                ok = bool(refs)
                for ref in refs:
                    path, _, name = ref.partition(':')
                    full = os.path.join(ROOT, path)
                    ok = ok and bool(name) and os.path.isfile(full) and name in open(full, encoding='utf-8').read()
                if not ok:
                    unit_bad += 1
                    print(f'{os.path.relpath(f, SPEC)}:{n}: @unit scenario without a "# unit: <file>:<test name>" naming an existing test: {refs}')
            tags, refs = [], []
        elif s and not s.startswith('#'):
            tags, refs = [], []
print(f'{unit_count} @unit scenarios, {unit_bad} problems')
sys.exit(1 if bad or unused or unit_bad else 0)
