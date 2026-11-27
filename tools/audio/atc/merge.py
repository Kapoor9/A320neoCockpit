"""Joins the per-pool manifests written by synth.py into public/sounds/atc/atc.json."""
import json, glob, os, sys, shutil
SRC, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
for f in glob.glob(f'{OUT}/*'): os.remove(f)
man = {'version': 1, 'pools': {}}
for j in sorted(glob.glob(f'{SRC}/*-*.json')):
    p = json.load(open(j))['pools']; man['pools'].update(p)
    for v in p.values(): shutil.copy(f'{SRC}/{v["file"]}', OUT)
json.dump(man, open(f'{OUT}/atc.json', 'w'), separators=(',', ':'))
print({k: len(v['exchanges']) for k, v in man['pools'].items()})
