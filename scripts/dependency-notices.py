import json, re, shutil, subprocess
from pathlib import Path
root = Path(__file__).resolve().parents[1]
lock = json.loads((root / 'package-lock.json').read_text())
cargo = shutil.which('cargo') or str(Path.home() / '.cargo/bin/cargo')
rust = json.loads(subprocess.check_output([cargo, 'metadata', '--manifest-path', str(root / 'src-tauri/Cargo.toml'), '--format-version', '1', '--filter-platform', 'aarch64-apple-darwin', '--offline'], text=True))
rows, notices, missing = [], [], []
for location, pkg in lock['packages'].items():
    if not location: continue
    name = location.split('node_modules/')[-1]
    base = root / location
    rows.append(('npm',name,pkg['version'],pkg.get('license','SEE LICENSE'), 'development' if pkg.get('dev') else 'runtime'))
    files = [p for p in base.glob('*') if p.is_file() and re.match(r'^(licen[sc]e|copying|notice)(\.|$|-)', p.name, re.I)]
    if not files: missing.append('npm '+name)
    for p in files:
        notices.append(f"\n{'='*72}\nnpm {name} {pkg['version']} — {p.name}\n{'='*72}\n{p.read_text(errors='replace')}")
for pkg in rust['packages']:
    if pkg['name'] == 'form-studio': continue
    base = Path(pkg['manifest_path']).parent
    rows.append(('cargo',pkg['name'],pkg['version'],pkg.get('license') or 'SEE LICENSE','macOS resolved dependency'))
    files = [p for p in base.glob('*') if p.is_file() and re.match(r'^(licen[sc]e|copying|notice)(\.|$|-)', p.name, re.I)]
    if not files: missing.append('cargo '+pkg['name'])
    for p in files:
        notices.append(f"\n{'='*72}\ncargo {pkg['name']} {pkg['version']} — {p.name}\n{'='*72}\n{p.read_text(errors='replace')}")
(root/'THIRD_PARTY_NOTICES.txt').write_text('Form Studio 0.1 — third-party notices\nCollected from installed package license files. Includes development/build dependencies as a conservative superset.\n' + '\n'.join(notices))
header = '''# Dependency inventory\n\nGenerated from package-lock.json and Cargo metadata for aarch64-apple-darwin. Lockfiles pin the resolved graph. This inventory includes build/development dependencies; it is a conservative superset of the shipped code. Runtime core dependencies use MIT, Apache-2.0, ISC, or permissive dual licensing. The application does not include Seamly, SMPL, third-party model checkpoints, or any supplied reference imagery.\n\nFull available license texts are in `THIRD_PARTY_NOTICES.txt`, bundled with the Mac application. Some crates put notices in source headers or external license references rather than top-level files; review the missing-file list before public distribution. Windows and other targets require their own notice collection.\n\n| Ecosystem | Package | Version | Declared license | Scope |\n| --- | --- | --- | --- | --- |\n'''
(root/'docs/dependencies.md').write_text(header + '\n'.join('| '+' | '.join(row)+' |' for row in sorted(rows)) + '\n\n## Packages without a top-level notice file\n\n' + '\n'.join('- '+s for s in sorted(missing)) + '\n')
print(f'{len(rows)} package records, {len(notices)} notice files; {len(missing)} without top-level license files')
