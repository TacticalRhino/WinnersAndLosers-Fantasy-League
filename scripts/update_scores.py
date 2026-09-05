import json,os,requests
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1];SEASON=2026;ROSTERS=json.loads((ROOT/'data'/'rosters.json').read_text())
CFB_ALIASES={'Sam Houston State':'Sam Houston','Louisiana-Monroe':'ULM','Florida International':'FIU','Miami (FL)':'Miami'}
def drafted(s):return sorted({p['team'] for m in ROSTERS['managers'] for p in m['picks'] if p['sport']==s})
def cfb_records():
 k=os.environ.get('CFBD_API_KEY')
 if not k:raise RuntimeError('Missing CFBD_API_KEY GitHub secret.')
 r=requests.get('https://api.collegefootballdata.com/records',params={'year':SEASON},headers={'Authorization':f'Bearer {k}'},timeout=30);r.raise_for_status();by={x['team']:x for x in r.json()};out={}
 for public in drafted('CFB'):
  api=CFB_ALIASES.get(public,public);item=by.get(api)
  if not item:out[f'CFB|{public}']={'wins':0,'losses':0,'ties':0,'source':'CFBD','missing':True};continue
  t=item.get('total') or {};out[f'CFB|{public}']={'wins':t.get('wins',0),'losses':t.get('losses',0),'ties':t.get('ties',0),'source':'CFBD'}
 return out
def espn_events():
 urls=[f'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000&dates={SEASON}&seasontype=2',f'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000&dates={SEASON}&seasontype=3',f'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=1000&dates={SEASON+1}&seasontype=3'];events=[]
 for u in urls:
  rr=requests.get(u,timeout=30);rr.raise_for_status();events.extend(rr.json().get('events',[]))
 return events
def nfl_records():
 teams={n:{'wins':0,'losses':0,'ties':0,'source':'ESPN scoreboard'} for n in drafted('NFL')};seen=set()
 for e in espn_events():
  if e.get('id') in seen:continue
  comps=e.get('competitions') or []
  if not comps or not comps[0].get('status',{}).get('type',{}).get('completed'):continue
  c=comps[0];cs=c.get('competitors',[])
  if len(cs)!=2:continue
  seen.add(e.get('id'));a,b=cs;na=a.get('team',{}).get('displayName');nb=b.get('team',{}).get('displayName')
  try:sa=int(a.get('score',0));sb=int(b.get('score',0))
  except:continue
  for name,score,opp in [(na,sa,sb),(nb,sb,sa)]:
   if name not in teams:continue
   if score>opp:teams[name]['wins']+=1
   elif score<opp:teams[name]['losses']+=1
   else:teams[name]['ties']+=1
 return {f'NFL|{k}':v for k,v in teams.items()}
def build():
 tr={};tr.update(cfb_records());tr.update(nfl_records());stand=[]
 for m in ROSTERS['managers']:
  b={'cfb_winner':0,'cfb_loser':0,'nfl_winner':0,'nfl_loser':0};rows=[]
  for p in m['picks']:
   rec=tr.get(f"{p['sport']}|{p['team']}",{'wins':0,'losses':0,'ties':0});pts=rec['wins'] if p['side']=='Winner' else rec['losses'];b[f"{p['sport'].lower()}_{p['side'].lower()}"]+=pts;rows.append({**p,'points':pts,'record':rec})
  stand.append({'manager':m['manager'],'total':sum(b.values()),'buckets':b,'picks':rows})
 stand.sort(key=lambda x:(-x['total'],x['manager']))
 for i,x in enumerate(stand,1):x['rank']=i
 (ROOT/'data'/'standings.json').write_text(json.dumps({'season':SEASON,'updated_at':datetime.now(timezone.utc).isoformat(),'status':'ok','standings':stand,'team_records':tr},indent=2))
if __name__=='__main__':build()
