"""Generate Kokoro narration with the model author's public CPU demo."""
import json, subprocess, hashlib, concurrent.futures, wave
from pathlib import Path
p=Path(__file__).resolve().parent/'dropcheck-film'
plan=json.loads((p/'narration-plan.json').read_text())
host='https://hexgrad-kokoro-tts.hf.space'
def curl(args):
 return subprocess.run(['curl','-sS','--fail','--connect-timeout','15','--max-time','90',*args],check=True,capture_output=True,text=True).stdout

def generate(line):
 out=p/'assets'/f"voice-{line['id']}.wav"
 if out.exists():
  try:
   with wave.open(str(out)) as w: complete=out.stat().st_size >= w.getnframes()*w.getnchannels()*w.getsampwidth()+44
   if complete:return {'id':line['id'],'status':'reused'}
  except (wave.Error, EOFError):pass
 session='dropcheck-'+hashlib.sha256(line['spokenText'].encode()).hexdigest()[:20]
 payload={'data':[line['spokenText'],plan['voice'],plan['speed'],False],'fn_index':4,'session_hash':session}
 join=json.loads(curl(['-X','POST',host+'/gradio_api/queue/join','-H','Content-Type: application/json','-d',json.dumps(payload)]))
 events=curl(['-N',host+'/gradio_api/queue/data?session_hash='+session])
 output=None
 for event in events.splitlines():
  if event.startswith('data: '):
   data=json.loads(event[6:])
   if data.get('msg')=='process_completed':output=data
 if not output or not output.get('success'):raise RuntimeError(str(output))
 media=output['output']['data'][0]
 partial=out.with_suffix('.download')
 curl([media['url'],'-o',str(partial)])
 partial.replace(out)
 return {'id':line['id'],'voice':plan['voice'],'host':host,'bytes':out.stat().st_size,'phonemes':output['output']['data'][1]}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=[]
 for result in pool.map(generate,plan['lines']):
  results.append(result);print(json.dumps(result),flush=True)
(p/'voice-provenance.json').write_text(json.dumps(results,indent=2))
