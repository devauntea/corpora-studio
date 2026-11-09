"""Read-only, redacted known-secret-pattern scan. No matched values are printed.
Not a high-entropy credential detector or a substitute for an owner publication review.
"""
import argparse, json, re, subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--history', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args])
patterns = {
    'github-token': re.compile(rb'gh[pousr]_[A-Za-z0-9]{30,}'),
    'github-fine-grained': re.compile(rb'github_pat_[A-Za-z0-9_]{50,}'),
    'aws-access-key': re.compile(rb'\bAKIA[A-Z0-9]{16}\b'),
    'sk-prefixed-key': re.compile(rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}'),
    'private-key': re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----'),
}
report = {'scope': 'Non-ignored working files and optionally reachable Git blobs; text only, maximum 3 MB per item. Known patterns only; no entropy analysis.', 'scanned': 0, 'skipped_binary_or_large': 0, 'findings': [], 'files_over_100mb': [], 'history': args.history}
def inspect(data, label):
    if len(data) > 3_000_000 or b'\0' in data[:8192]:
        report['skipped_binary_or_large'] += 1
        return
    report['scanned'] += 1
    for kind, pattern in patterns.items():
        if pattern.search(data): report['findings'].append({'location': label, 'kind': kind})
files = sorted(set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').decode().split('\0')) - {''})
for name in files:
    p = root / name
    if not p.is_file() or p.is_symlink(): continue
    if p.stat().st_size > 100_000_000: report['files_over_100mb'].append(name)
    if p.stat().st_size > 3_000_000:
        report['skipped_binary_or_large'] += 1
        continue
    inspect(p.read_bytes(), name)
if args.history:
    objects = [line.split(b' ',1)[0] for line in git('rev-list', '--objects', '--all').splitlines()]
    meta = subprocess.check_output(['git','-C',str(root),'cat-file','--batch-check=%(objectname) %(objecttype) %(objectsize)'],input=b'\n'.join(objects)+b'\n')
    for line in meta.splitlines():
        oid, kind, size = line.split()
        if kind != b'blob': continue
        if int(size) > 3_000_000:
            report['skipped_binary_or_large'] += 1
            continue
        inspect(git('cat-file','blob',oid.decode()), 'git-blob:'+oid.decode())
print(json.dumps(report,indent=2))
raise SystemExit(1 if report['findings'] else 0)
