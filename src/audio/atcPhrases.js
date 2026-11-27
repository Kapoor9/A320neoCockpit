// ATC / pilot exchanges for the radio chatter, made up fresh every time (ICAO phraseology, Indian ATC flavour).
// Callsign, flight number, stand, taxi route, runway, wind, QNH, squawk, SID, traffic and wording are all drawn at
// random. One traffic flow per session (west: runways 27 / 28 / 29L / 29R, east: 09 / 10 / 11R / 11L) keeps Ground
// and Tower consistent. Fixes, SIDs, stands and taxiways are plausible inventions, not a real chart.
// Also picks the voices: controllers keep theirs for the session, every crew gets a new one.

const D = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'niner' };
const NATO = 'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November'.split(' ').concat(['Papa', 'Sierra', 'Tango', 'Victor', 'Whiskey', 'Yankee', 'Zulu']);
const dig = (s) => [...String(s)].map((c) => D[c] ?? c).join(' ');
const rwy = (r) => dig(r.slice(0, 2)) + ({ L: ' left', R: ' right' }[r.slice(2)] || '');
const freq = (f, short) => { const [a, b] = f.split('.'); return dig(a) + (short ? ' ' : ' decimal ') + dig(b); };
const R = Math.random, pick = (a) => a[Math.floor(R() * a.length)], chance = (p) => R() < p, int = (a, b) => a + Math.floor(R() * (b - a + 1));
const wpick = (items, w) => { let t = R() * w.reduce((s, x) => s + x, 0); for (let i = 0; i < items.length; i++) { t -= w[i]; if (t < 0) return items[i]; } return items[0]; };

// telephony, voice group, weight, digits
const AIRLINES = [
  ['Indigo', 'in', 26, 3, 4], ['Air India', 'in', 16, 3, 3], ['Spice jet', 'in', 7, 3, 4], ['Akasa Air', 'in', 6, 3, 4],
  ['Express India', 'in', 5, 3, 4], ['Allied', 'in', 2, 3, 3], ['Emirates', 'mix', 5, 3, 3], ['Qatari', 'mix', 4, 3, 3],
  ['Etihad', 'mix', 2, 3, 3], ['Speed bird', 'gb', 3, 2, 3], ['Lufthansa', 'us', 2, 3, 3], ['Singapore', 'mix', 2, 3, 3],
  ['Thai', 'us', 1, 3, 3], ['Gulf Air', 'mix', 1, 3, 3], ['Air France', 'fr', 1, 3, 3], ['Japan Air', 'jp', 1, 2, 3],
  ['Air China', 'cn', 1, 3, 3], ['Saudia', 'mix', 1, 3, 3], ['United', 'us', 1, 2, 3], ['Virgin', 'gb', 1, 3, 3],
];
const TYPES = ['A three twenty', 'A three twenty one', 'triple seven', 'seven eight seven', 'A three fifty', 'seven three seven', 'A three eighty', 'A T R'];
const DEST = ['Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Goa', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Srinagar', 'Guwahati', 'Kochi', 'Dubai', 'Doha', 'London Heathrow', 'Frankfurt', 'Singapore', 'Bangkok', 'Kathmandu', 'Abu Dhabi', 'Riyadh', 'Paris', 'Tokyo Narita', 'Beijing'];
const FIXES = ['PARVA', 'SIPRA', 'BUBIM', 'NIKAS', 'GUDUM', 'LUMAN', 'AKBAN', 'TELAP', 'RIDAV', 'OSKAN', 'MOLAD', 'KAMRI'];
const FLOWS = {
  west: { dep: ['29R', '28'], arr: ['29L', '28', '27'], wind: [250, 310], qnh: 1003 + int(0, 12), atis: pick(['Kilo', 'Lima', 'Mike']) },
  east: { dep: ['11L', '10'], arr: ['11R', '10', '09'], wind: [60, 130], qnh: 1003 + int(0, 12), atis: pick(['Papa', 'Quebec', 'Romeo']) },
};
export const GROUND = '121.8', TOWER = '118.7', DEPARTURE = '126.35';

// ------------------------------------------------------------------ voices
const MALE = { in: ['hm_omega', 'hm_psi'], us: ['am_adam', 'am_echo', 'am_eric', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_fenrir'], gb: ['bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'], fr: ['ff_siwis'], jp: ['jm_kumo'], cn: ['zm_yunjian', 'zm_yunxi'] };
const FEMALE = { in: ['hf_alpha', 'hf_beta'], us: ['af_heart', 'af_bella', 'af_sarah', 'af_nicole', 'af_kore', 'af_aoede', 'af_river'], gb: ['bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily'], fr: ['ff_siwis'], jp: ['jf_alpha'], cn: ['zf_xiaoxiao'] };
export function crewVoice(grp) {
  if (grp === 'mix') grp = pick(['in', 'gb', 'us', 'us', 'gb']);
  const pool = chance(0.18) ? FEMALE : MALE, other = [...pool.us, ...pool.gb];
  const a = pick(pool[grp]), b = pick([...pool[grp], ...other].filter((v) => v !== a));
  const accented = ['fr', 'jp', 'cn'].includes(grp);
  return { voice: { a, b, w: accented ? 0.35 + R() * 0.2 : 0.5 + R() * 0.38 }, lang: grp === 'gb' ? 'en-gb' : 'en-us', speed: 1.0 + R() * 0.3 };
}
export function controllerVoice() {   // Indian controller, new for each session
  const pool = chance(0.6) ? MALE : FEMALE;
  return { voice: { a: pick(pool.in), b: pick([...pool.gb, ...pool.us]), w: 0.62 + R() * 0.25 }, lang: 'en-us', speed: 1.12 + R() * 0.16 };
}

// ------------------------------------------------------------------ phraseology
export class AtcGen {
  constructor(flow) { this.f = FLOWS[flow]; }
  callsign() {
    const [name, grp, , lo, hi] = wpick(AIRLINES, AIRLINES.map((a) => a[2]));
    let n = String(int(1, 9)); const len = int(lo, hi); while (n.length < len) n += int(0, 9);
    return { say: name + ' ' + dig(n), grp, name };
  }
  wind() { const [lo, hi] = this.f.wind; const d = lo + 10 * int(0, (hi - lo) / 10); return chance(0.12) ? 'wind calm' : `wind ${dig(String(d).padStart(3, '0'))} degrees, ${dig(int(3, 16))} knots`; }
  qnh() { return 'Q N H ' + dig(this.f.qnh + pick([0, 0, 0, 1, -1])); }
  stand() { return pick(['stand', 'stand', 'bay']) + ' ' + dig(int(1, 58)) + (chance(0.15) ? ' ' + pick(['Alpha', 'Bravo', 'Right', 'Left']) : ''); }
  twy() { return pick(NATO) + (chance(0.3) ? ' ' + dig(int(1, 9)) : ''); }
  route(n = int(2, 4)) { const out = []; while (out.length < n) { const t = this.twy(); if (!out.includes(t)) out.push(t); } return out; }
  sid() { return [pick(FIXES), String(int(1, 7)), pick(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Golf'])]; }
  bye() { return pick(['good day', 'good day', 'namaste', 'bye bye', 'thank you', 'have a good flight', '']); }
  pbye() { return pick(['good day', 'namaste', 'bye', 'thank you', 'cheers', '']); }
  static fin(t) { t = t.replace(/ ,/g, ',').replace(/,,/g, ',').replace(/^[ ,]+|[ ,]+$/g, ''); return t[0].toUpperCase() + t.slice(1) + (/[.?]$/.test(t) ? '' : '.'); }

  ground() {
    const cs = this.callsign(), c = cs.say, f = this.f, dep = pick(f.dep), ex = [];
    const A = (t) => ex.push(['atc', AtcGen.fin(t)]), P = (t) => ex.push(['plt', AtcGen.fin(t)]);
    const kind = wpick(['clr', 'push', 'taxi', 'arr', 'giveway', 'handoff', 'hold', 'standby', 'sayagain', 'expect', 'radio'], [12, 16, 18, 14, 8, 12, 6, 5, 3, 5, 1]);
    if (kind === 'clr') {
      const dest = pick(DEST), [fx, n, l] = this.sid(), sq = int(0, 7) + '' + int(0, 7) + int(0, 7) + int(0, 7), alt = pick(['four thousand feet', 'six thousand feet', 'flight level one one zero', 'seven thousand feet']);
      if (chance(0.6)) P(`Delhi Ground, ${c}, ${this.stand()}, ` + pick([`request start up clearance to ${dest}`, 'request clearance', 'ready to copy clearance']) + (chance(0.6) ? `, information ${f.atis}` : ''));
      A(`${c}, cleared to ${dest}, ${fx} ${dig(n)} ${l} departure, runway ${rwy(dep)}, ` + pick(['climb', 'initial climb', 'climb and maintain']) + ` ${alt}, squawk ${dig(sq)}`);
      P(`Cleared to ${dest}, ${fx} ${dig(n)} ${l}, runway ${rwy(dep)}, ` + pick(['climb', 'initial']) + ` ${alt}, squawk ${dig(sq)}, ${c}`);
      if (chance(0.5)) A(`${c}, readback correct` + pick([', report ready for push back', ', start up approved', '']));
    } else if (kind === 'push') {
      const face = pick(['east', 'west']);
      if (chance(0.75)) P(`${pick(['Delhi Ground', 'Ground', 'Delhi Ground, good morning', 'Delhi Ground, good evening'])}, ${c}, ${this.stand()}, ` + pick(['request push back and start up', 'ready for push and start', 'request push back', 'fully ready, request push']));
      A(`${c}, ` + pick([`push back and start up approved, facing ${face}`, `push back approved, tail ${face === 'east' ? 'west' : 'east'}`, `push and start approved, face ${face}, expect runway ${rwy(dep)}`]));
      P(pick([`Push back and start up approved, facing ${face}, ${c}`, `Push approved facing ${face}, ${c}`, `Push and start, face ${face}, ${c}`]));
    } else if (kind === 'taxi') {
      const rt = this.route();
      if (chance(0.7)) P(`${pick(['Delhi Ground', 'Ground'])}, ${c}, ` + pick(['request taxi', 'ready for taxi', 'request taxi, ' + this.stand()]));
      let hs = null; if (chance(0.35)) for (let i = 0; i < 6 && !hs; i++) { const t = this.twy(); if (!rt.includes(t)) hs = t; }
      A(`${c}, taxi to holding point runway ${rwy(dep)} via ${rt.join(', ')}` + (hs ? `, hold short of ${hs}` : '') + (chance(0.5) ? `, ${this.qnh()}` : ''));
      P(`Holding point runway ${rwy(dep)} via ${rt.join(', ')}` + (hs ? `, hold short ${hs}` : '') + `, ${c}`);
    } else if (kind === 'arr') {
      const ar = pick(f.arr), out = this.twy(), rt = this.route(int(2, 3)), st = this.stand();
      P(`${pick(['Delhi Ground', 'Ground, good evening', 'Delhi Ground, namaste'])}, ${c}, ` + pick([`vacated runway ${rwy(ar)} via ${out}`, `runway vacated via ${out}`, `clear of runway ${rwy(ar)} on ${out}`]));
      A(`${c}, Delhi Ground, taxi to ${st} via ${rt.join(', ')}` + (chance(0.25) ? ', give way to the ' + pick(TYPES) + ' on your right' : ''));
      P(`${st} via ${rt.join(', ')}, ${c}`);
    } else if (kind === 'giveway') {
      const ty = pick(TYPES), al = this.callsign().name, side = pick(['left to right', 'right to left', 'from your left', 'from your right', 'ahead']), nx = this.twy();
      A(`${c}, give way to the ${al} ${ty} passing ${side}, then continue on ${nx}`);
      P(pick([`Give way to the ${al}, then ${nx}, ${c}`, `Traffic in sight, give way, then continue ${nx}, ${c}`, `Give way, then continue ${nx}, ${c}`]));
    } else if (kind === 'handoff') {
      A(`${c}, ` + pick([`contact Tower ${freq(TOWER)}`, `hold short runway ${rwy(dep)}, contact Tower ${freq(TOWER)}`, `monitor Tower ${freq(TOWER)}`]) + `, ${this.bye()}`);
      P(`${freq(TOWER, chance(0.5))}, ${c}, ${this.pbye()}`);
    } else if (kind === 'hold') {
      A(`${c}, hold position, ` + pick(['traffic crossing ahead', 'aircraft pushing behind you', 'follow-me vehicle crossing', 'I will call you back']));
      P(`Holding position, ${c}`);
    } else if (kind === 'standby') {
      P(`${pick(['Delhi Ground', 'Ground'])}, ${c}, ` + pick(['request push back', 'request taxi', 'ready for start up']));
      A(`${c}, ` + pick(['standby', 'standby, number two for push', 'stand by, I will call you']));
      if (chance(0.4)) P(pick([`Standing by, ${c}`, `Copy, ${c}`]));
    } else if (kind === 'sayagain') {
      const rt = this.route(2);
      A(`${c}, taxi via ${rt.join(', ')}, holding point runway ${rwy(dep)}`); P(`Say again for ${c}?`);
      A(`${c}, taxi via ${rt.join(', ')}, holding point runway ${rwy(dep)}`); P(`Via ${rt.join(', ')}, holding point ${rwy(dep)}, ${c}`);
    } else if (kind === 'expect') {
      const n = int(2, 5);
      A(`${c}, expect push back in ${dig(int(3, 12))} minutes, you are number ${dig(n)}`);
      P(pick([`Copy, number ${dig(n)}, ${c}`, `Roger, ${c}`, `Number ${dig(n)}, ${c}`]));
    } else {
      P(`Delhi Ground, ${c}, radio check ${freq(GROUND)}`); A(`${c}, ` + pick(['reading you five', 'read you loud and clear', 'readability five']));
    }
    return { cs, kind, lines: ex };
  }

  tower() {
    const cs = this.callsign(), c = cs.say, f = this.f, dep = pick(f.dep), ar = pick(f.arr), ex = [];
    const A = (t) => ex.push(['atc', AtcGen.fin(t)]), P = (t) => ex.push(['plt', AtcGen.fin(t)]);
    const kind = wpick(['ready', 'luw', 'tko', 'land', 'approach', 'vacate', 'dep', 'behind', 'goaround', 'cont'], [12, 10, 16, 16, 10, 10, 12, 6, 1, 5]);
    if (kind === 'ready') {
      P(`Delhi Tower, ${c}, holding point runway ${rwy(dep)}, ready for departure`);
      A(`${c}, Delhi Tower, ` + pick([`line up and wait runway ${rwy(dep)}`, `hold short runway ${rwy(dep)}, landing traffic`, `line up runway ${rwy(dep)} and wait, one landing traffic on four mile final`]));
      P(pick([`Line up and wait ${rwy(dep)}, ${c}`, `Holding short ${rwy(dep)}, ${c}`, `Lining up ${rwy(dep)}, ${c}`]));
    } else if (kind === 'luw') {
      A(`${c}, runway ${rwy(dep)}, line up and wait`); P(`Line up and wait runway ${rwy(dep)}, ${c}`);
    } else if (kind === 'tko') {
      A(`${c}, ${this.wind()}, runway ${rwy(dep)}, cleared for take off`);
      P(pick([`Cleared for take off runway ${rwy(dep)}, ${c}`, `Cleared take off ${rwy(dep)}, ${c}`, `Runway ${rwy(dep)}, cleared for take off, ${c}`]));
    } else if (kind === 'land') {
      if (chance(0.4)) P(`Delhi Tower, ${c}, ` + pick([`established I L S runway ${rwy(ar)}`, `eight miles final runway ${rwy(ar)}`, `on final ${rwy(ar)}`]));
      A(`${c}, ${this.wind()}, runway ${rwy(ar)}, cleared to land`);
      P(pick([`Cleared to land runway ${rwy(ar)}, ${c}`, `Cleared to land ${rwy(ar)}, ${c}`]));
    } else if (kind === 'approach') {
      P(`Delhi Tower, ${c}, ` + pick([`established I L S runway ${rwy(ar)}`, `twelve miles final ${rwy(ar)}`, `with you on the localizer ${rwy(ar)}`]));
      A(`${c}, Delhi Tower, continue approach, number ${dig(int(2, 4))}, ${this.wind()}`); P(`Continue approach, ${c}`);
    } else if (kind === 'vacate') {
      const t = this.twy();
      A(`${c}, vacate ` + pick(['left', 'right', '']) + ` via ${t}, contact Ground ${freq(GROUND)}`); P(`Via ${t}, Ground ${freq(GROUND, true)}, ${c}`);
    } else if (kind === 'dep') {
      A(`${c}, contact Delhi Departure ${freq(DEPARTURE)}, ${this.bye()}`); P(`${freq(DEPARTURE, chance(0.4))}, ${c}, ${this.pbye()}`);
    } else if (kind === 'behind') {
      const ty = pick(TYPES);
      A(`${c}, behind the landing ${ty} on short final, line up runway ${rwy(dep)} behind`); P(`Behind the landing ${ty}, line up ${rwy(dep)} behind, ${c}`);
    } else if (kind === 'goaround') {
      A(`${c}, go around, I say again, go around, ` + pick(['vehicle on the runway', 'preceding traffic not vacated'])); P(`Going around, ${c}`);
      A(`${c}, climb four thousand feet, runway heading, contact Approach one two seven decimal niner`); P(`Four thousand, runway heading, Approach one two seven niner, ${c}`);
    } else {
      A(`${c}, continue approach, expect late landing clearance, ${this.wind()}`); P(pick([`Continue, ${c}`, `Continuing, ${c}`]));
    }
    return { cs, kind, lines: ex };
  }
}
