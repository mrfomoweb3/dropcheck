"""Generate all narration sections with the free local Kokoro model."""
import json
from pathlib import Path
import soundfile as sf
from kokoro_onnx import Kokoro

project = Path(__file__).resolve().parent / 'dropcheck-film'
plan = json.loads((project / 'narration-plan.json').read_text())
engine = Kokoro('/private/tmp/dropcheck-kokoro.onnx', '/private/tmp/dropcheck-kokoro-voices.bin')
report = []
for line in plan['lines']:
    samples, sample_rate = engine.create(line['spokenText'], voice=plan['voice'], speed=plan['speed'], lang='en-us')
    output = project / 'assets' / f"voice-{line['id']}.wav"
    sf.write(str(output), samples, sample_rate)
    duration = len(samples) / sample_rate
    report.append({'id': line['id'], 'duration': duration, 'slot': line['slot'], 'start': line['start']})
    print(json.dumps(report[-1]), flush=True)
(project / 'voice-durations.json').write_text(json.dumps(report, indent=2))
