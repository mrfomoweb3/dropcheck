"""Fit narration to scenes, normalize, mix with music/SFX and retain video frames."""
import json, subprocess
from pathlib import Path
p=Path(__file__).resolve().parent/'dropcheck-film'
def run(args):
 return subprocess.run(args,check=True,capture_output=True,text=True)
plan=json.loads((p/'narration-plan.json').read_text())
inputs=[];filters=[];labels=[];report=[]
for i,line in enumerate(plan['lines']):
 raw=p/'assets'/f"voice-{line['id']}.wav"
 duration=float(run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(raw)]).stdout.strip())
 tempo=max(1,duration/(line['slot']-.6))
 if tempo>1.2:raise RuntimeError(f"Rewrite {line['id']}; speech exceeds slot: {duration}")
 fitted=p/'assets'/f"voice-{line['id']}-fitted.wav"
 run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(raw),'-af',f'atempo={tempo},loudnorm=I=-18:TP=-2:LRA=7','-ar','48000',str(fitted)])
 inputs+=['-i',str(fitted)]
 delay=round((line['start']+.2)*1000)
 filters.append(f'[{i}:a]adelay={delay}:all=1[v{i}]');labels.append(f'[v{i}]')
 report.append({'id':line['id'],'rawSeconds':duration,'tempo':tempo,'start':line['start']+.2,'end':line['start']+.2+duration/tempo})
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0:duration=longest,apad,atrim=0:48[voice]')
voice=p/'assets/narration.wav'
run(['ffmpeg','-y','-hide_banner','-loglevel','error',*inputs,'-filter_complex',';'.join(filters),'-map','[voice]','-ar','48000',str(voice)])
finalmix=p/'assets/final-mix.wav'
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(p/'renders/dropcheck-demo-music-draft.mp4'),'-i',str(voice),'-filter_complex','[0:a][1:a]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-16:TP=-1:LRA=9[a]','-map','[a]','-ar','48000',str(finalmix)])
output=p/'renders/dropcheck-demo.mp4'
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(p/'renders/dropcheck-demo-music-draft.mp4'),'-i',str(finalmix),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','48','-movflags','+faststart',str(output)])
(p/'narration-timing.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'output':str(output),'timing':report},indent=2))
