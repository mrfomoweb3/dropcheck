import {readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('./dropcheck-film/',import.meta.url));
const plan=JSON.parse(await readFile(project+'narration-plan.json','utf8'));
for(const line of plan.lines){
 const out=`assets/voice-${line.id}.wav`;
 try{await access(project+out);console.log('Already generated:',line.id);continue;}catch{}
 console.log('Generating locally:',line.id);
 await new Promise((resolve,reject)=>{const child=spawn('hyperframes',['tts',line.spokenText,'--voice',plan.voice,'--speed',String(plan.speed),'--output',out,'--json'],{cwd:project,env:{...process.env,HYPERFRAMES_PYTHON:'/private/tmp/dropcheck-kokoro-venv/bin/python'},stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Narration ${line.id} failed (${code})`)));});
}
