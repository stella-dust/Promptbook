# Uses the existing Wrangler OAuth session; never prints credentials.
import json, pathlib, re, urllib.request, urllib.error, sys
token=re.search(r'oauth_token\s*=\s*"([^"]+)"', (pathlib.Path.home()/'Library/Preferences/.wrangler/config/default.toml').read_text()).group(1)
path=sys.argv[1]
method=sys.argv[2] if len(sys.argv)>2 else 'GET'
data=sys.stdin.buffer.read() if method!='GET' else None
req=urllib.request.Request('https://api.cloudflare.com/client/v4/'+path, data=data, method=method, headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
try:
 with urllib.request.urlopen(req,timeout=30) as r: result=json.load(r)
except urllib.error.HTTPError as e: result=json.load(e)
print(json.dumps(result))
