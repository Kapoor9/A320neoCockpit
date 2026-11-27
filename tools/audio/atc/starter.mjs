// Dumps a small set of exchanges (made by the same generator the browser uses) for starter_synth.py.
import { AtcGen, crewVoice, controllerVoice } from '../../../src/audio/atcPhrases.js';
const out = {};
for (const flow of ['west', 'east']) {
  const g = new AtcGen(flow);
  for (const [pos, n] of [['ground', 8], ['tower', 6]]) {
    const atc = controllerVoice(), ex = [];
    for (let i = 0; i < n; i++) { const e = pos === 'ground' ? g.ground() : g.tower(); ex.push({ crew: crewVoice(e.cs.grp), lines: e.lines }); }
    out[flow + '-' + pos] = { atc, ex };
  }
}
console.log(JSON.stringify(out));
