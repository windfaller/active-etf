"""Copy only MCP dependencies from the existing SWA; never print secret values."""
import json, os, subprocess, tempfile
SUBSCRIPTION = 'e4c458d1-80eb-419b-9680-0dc8682a9df4'
GROUP = 'active-etf'
APP = 'active-etf-member-mcp'
def az(*args):
    return subprocess.check_output(['az', *args, '--subscription', SUBSCRIPTION, '--output', 'json'], text=True)
app = json.loads(az('functionapp','show','--resource-group',GROUP,'--name',APP))
origin = 'https://active-etf-mcp.inthewins.com'
if origin.removeprefix('https://') not in app.get('properties', app)['hostNames']:
    raise RuntimeError('Canonical MCP hostname is not bound to the Function')
source = json.loads(az('staticwebapp','appsettings','list','--resource-group',GROUP,'--name','tw-active-etf'))['properties']
keys = ['MONGODB_URI','MONGODB_DB_NAME','REDIS_GOGOWINNERS_HOST','REDIS_GOGOWINNERS_PORT','REDIS_GOGOWINNERS_KEY','REDIS_DAILY_CACHE_TTL_SECONDS']
settings = {key:source[key] for key in keys if key in source}
if not settings.get('MONGODB_URI'): raise RuntimeError('Missing source MongoDB setting')
settings.update(MCP_STANDALONE='true', MCP_PUBLIC_ORIGIN=origin)
fd,path=tempfile.mkstemp(prefix='member-mcp-settings-',suffix='.json')
try:
    os.fchmod(fd,0o600)
    with os.fdopen(fd,'w') as f: json.dump(settings,f)
    subprocess.run(['az','functionapp','config','appsettings','set','--name',APP,'--resource-group',GROUP,'--subscription',SUBSCRIPTION,'--settings','@'+path,'--output','none'],check=True)
finally:
    os.unlink(path)
print('Configured MCP origin and dependency settings; no secret values emitted.')
print(origin+'/api/mcp')
