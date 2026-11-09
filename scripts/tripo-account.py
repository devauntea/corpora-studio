#!/usr/bin/env python3
"""Read-only Tripo account verification. Credentials never enter argv or output."""
import json
import math
from pathlib import Path
import urllib.request
import urllib.error

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def verify():
    path = Path.home() / '.config/form-studio/tripo-api-key'
    if not path.is_file():
        raise ValueError('Saved Tripo key was not found. Run scripts/setup-tripo.py.')
    key = path.read_text().strip()
    if key.startswith('tcli_'):
        raise ValueError('Saved value is a Client ID, not an API key. Run scripts/setup-tripo.py with the API key.')
    if not key or len(key) > 4096 or any(c.isspace() for c in key):
        raise ValueError('Saved Tripo key is invalid. Run scripts/setup-tripo.py again.')
    request = urllib.request.Request('https://openapi.tripo3d.ai/v3/account/balance', headers={'Authorization': 'Bearer ' + key, 'Accept': 'application/json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=25) as response:
            raw = response.read(65537)
            if len(raw) > 65536: raise ValueError('Tripo response exceeded the account response limit.')
            result = json.loads(raw)
    except urllib.error.HTTPError as error:
        raise ValueError(f'Tripo account check returned HTTP {error.code}. No generation was requested.') from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise ValueError('Could not read the Tripo account response. Check the connection and retry.') from None
    data = result.get('data', {})
    if result.get('code') != 0 or any(not isinstance(data.get(k), (float, int)) or isinstance(data.get(k), bool) or not math.isfinite(data[k]) for k in ['balance', 'frozen']):
        raise ValueError('Tripo did not return a successful account balance response.')
    return {'connected': True, 'balance': data['balance'], 'frozen': data['frozen']}

if __name__ == '__main__':
    try: print(json.dumps(verify()))
    except ValueError as error: raise SystemExit(str(error))
