#!/usr/bin/env python3
"""Run interactively in Terminal. Never pass an API key as an argument.
Stores a private local credential outside the repository. Makes no API requests.
"""
import getpass
import os
from pathlib import Path
import tempfile

if __name__ == '__main__':
    key = getpass.getpass('Tripo API key (hidden): ').strip()
    if key.startswith('tcli_'):
        raise SystemExit('That is a Client ID, not an API key. Create/copy the API Key in Tripo Console → API Keys. Nothing was saved.')
    if not key or len(key) > 4096 or any(c.isspace() for c in key):
        raise SystemExit('No key saved: enter a nonempty key without whitespace.')
    directory = Path.home() / '.config' / 'form-studio'
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / 'tripo-api-key'
    fd, temporary = tempfile.mkstemp(prefix='.tripo-', dir=directory)
    try:
        with os.fdopen(fd, 'w') as output:
            os.fchmod(output.fileno(), 0o600)
            output.write(key + '\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)
    print('Tripo key saved privately on this Mac. No API calls or credits used.')
