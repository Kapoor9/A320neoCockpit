// The controller you talk to (Delhi Ground 121.800, Delhi Tower 118.700): understands the pilot's call (already turned
// into text), keeps the flight's details and answers with ICAO phraseology - never the same wording twice in a row,
// and a repeated request gets an answer that says the same thing differently.
// The first call fixes the callsign for the flight; the flight is kept for this browser session only.
// Everything is rules and phrase banks: no network, no outside service. To add a call: add a pattern in INTENTS and
// an entry in the handler table (H) below; wording lives in BANK.
import { dig, rwy, freq, GROUND, TOWER, DEPARTURE, setRng } from './atcPhrases.js';

// Every choice the controller makes (wording, squawk, route, runway roll...) comes from a seeded generator kept in the
// flight state. Replaying the same state gives the same reply, so likely replies can be voiced before you call.
let RNG = Math.random;
const R = () => RNG(), pick = (a) => a[Math.floor(R() * a.length)], chance = (p) => R() < p, int = (a, b) => a + Math.floor(R() * (b - a + 1));
const STORE = 'a320.atc.flight';
const CITIES = ['Mumbai', 'Bengaluru', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Goa', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Srinagar', 'Guwahati', 'Kochi', 'Cochin', 'Amritsar', 'Chandigarh', 'Varanasi', 'Patna', 'Indore', 'Nagpur', 'Bhopal', 'Leh', 'Dehradun', 'Dubai', 'Doha', 'London', 'Heathrow', 'Frankfurt', 'Singapore', 'Bangkok', 'Kathmandu', 'Abu Dhabi', 'Riyadh', 'Paris', 'Tokyo', 'Colombo', 'Dhaka', 'Male', 'Muscat', 'Sharjah', 'Kuala Lumpur', 'Hong Kong', 'Istanbul', 'New York', 'Toronto'];
const FIXES = ['PARVA', 'SIPRA', 'BUBIM', 'NIKAS', 'GUDUM', 'LUMAN', 'AKBAN', 'TELAP', 'RIDAV', 'OSKAN', 'MOLAD', 'KAMRI'];
const NATO_WORDS = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu';
const TWY = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'Juliet', 'Kilo', 'Lima', 'Mike', 'November', 'Papa', 'Sierra', 'Tango', 'Victor', 'Whiskey', 'Yankee', 'Zulu'];
const SPOKEN = { spicejet: 'Spice jet', speedbird: 'Speed bird', ifly: 'Eye fly', akasa: 'Akasa', indigo: 'Indigo' };
const STATION = { ground: 'Delhi Ground', tower: 'Delhi Tower' };

// ------------------------------------------------------------------ what the pilot said, cleaned up
const NUM = { zero: '0', oh: '0', one: '1', two: '2', three: '3', tree: '3', four: '4', five: '5', fife: '5', six: '6', seven: '7', eight: '8', nine: '9', niner: '9' };
export function normalize(raw) {
  let t = ' ' + raw.toLowerCase().replace(/(\d)(er|r)\b/g, '$1').replace(/\b(\d) to knots\b/g, '$1 2 knots').replace(/(\d),(\d{3})\b/g, '$1$2') + ' ';
  t = t.replace(/\b(zero|oh|one|two|three|tree|four|five|fife|six|seven|eight|nine|niner)\b/g, (w) => NUM[w]);
  t = t.replace(/\b(\d)\b(?:[\s,\-]+\b(\d)\b)+/g, (m) => m.replace(/[^\d]/g, ''));   // "2, 4 5" -> "245"
  t = t.replace(/(\d)\s*(?:decimal|point|dot)\s*(\d)/g, '$1.$2');
  t = t.replace(/\btake[\s-]?off\b/g, 'takeoff').replace(/\bpush[\s-]?back\b/g, 'pushback').replace(/\bstart[\s-]?up\b/g, 'startup');
  return t.replace(/[^a-z0-9.\s]/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
}
// ------------------------------------------------------------------ misheard words -> the word that was meant
// Speech recognition hears "deli ground", "texi", "push bag", "in the go 245": phrase fixes first, then every word is
// matched to the radio vocabulary with a small spelling tolerance (1 letter on short words, 2 on long ones).
const AIRLINE_WORDS = ['indigo', 'spicejet', 'akasa', 'vistara', 'emirates', 'qatari', 'etihad', 'speedbird', 'lufthansa', 'singapore', 'thai', 'saudia', 'united', 'virgin', 'allied', 'express', 'india', 'air', 'gulf', 'france', 'japan', 'china', 'british', 'american', 'delta', 'qantas', 'turkish', 'oman', 'kuwaiti', 'cathay', 'alliance'];
// words a misheard word may be corrected TO: everyday radio words, callsigns, the alphabet, cities. Words that change
// what happens in a serious way (mayday, reject, abort, stop, emergency) are never guessed: they must be heard clearly.
const VOCAB = new Set(('delhi ground tower delivery departure request requesting clearance pushback startup taxi takeoff ready runway holding point short lined wait cleared squawk qnh weather information atis radio check vacated stand gate frequency wilco roger copy standby affirm negative approved facing east west destination temperature morning afternoon evening namaste contact monitor engines running heading metar position traffic '
  + NATO_WORDS + ' ' + AIRLINE_WORDS.join(' ') + ' ' + CITIES.join(' ').toLowerCase()).split(/\s+/));
// everyday words that are never "corrected" even when close to a radio word (about/abort, where/tower, ...)
const KEEP = new Set('about above after again also back been before being both bring call came come could does done down each even every from give going good have here into just keep know last like look make many maybe more most much must need next only other over please right said same some such take than thank thanks that them then there these they this those time today tomorrow very want well were what when where which while will with would your yours left right stop power water about after hello sorry truck catering weather'.split(' '));
const PHRASES = [
  [/\b(deli|delly|dilly|dilli|dehli|delhis|daily|deli's|dili)\b(?= (ground|tower|delivery|departure))/g, 'delhi'],
  [/\bpush(ed)?\s+(bag|pack|bank|back|backed|pack)\b/g, 'pushback'], [/\bpush and start\b/g, 'pushback and startup'],
  [/\btake\s+(of|on|up|off)\b/g, 'takeoff'], [/\bstart(ed)?\s+(up|app|op)\b/g, 'startup'], [/\brun\s?a?\s?way\b/g, 'runway'],
  [/\b(q n h|q and h|queue and h|cue and h|q nh|qn h|kuna|q h n)\b/g, 'qnh'], [/\b(in the go|in de go|indygo|endigo|indego|indi go|in digo)\b/g, 'indigo'],
  [/\b(spice jet|spicy jet|spice chat)\b/g, 'spicejet'], [/\b(speed bird|speedbirds)\b/g, 'speedbird'], [/\b(a kasa|akasha|aakasa|akaasa)\b/g, 'akasa'],
  [/\b(air india express|express india)\b/g, 'express india'], [/\bholding\s+short\b/g, 'holding short'], [/\bline\s+up\b/g, 'lineup'],
  [/\b(may day)\b/g, 'mayday'], [/\b(squak|squawks|square|squad|squawked)\b(?= \d)/g, 'squawk'], [/\bready to go\b/g, 'ready'],
];
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const fixCache = new Map();
function fixWord(w) {
  if (w.length < 4 || /\d/.test(w) || VOCAB.has(w) || KEEP.has(w)) return w;
  if (fixCache.has(w)) return fixCache.get(w);
  let best = w, bd = w.length >= 7 ? 2 : 1;
  for (const v of VOCAB) { if (v.length < 4 || v.includes(' ')) continue; const d = lev(w, v); if (d < bd || (d === bd && best === w && d <= (w.length >= 7 ? 2 : 1))) { if (d <= (w.length >= 7 ? 2 : 1)) { best = v; bd = d; } } }
  fixCache.set(w, best); return best;
}
export function understand(raw) {
  let t = normalize(raw);
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  t = t.split(' ').map(fixWord).join(' ');
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  return t.replace(/\blineup\b/g, 'line up');
}
const numbers = (t) => t.match(/\d+(?:\.\d+)?/g) || [];
const has = (t, re) => re.test(t);

const STOP = /^(request|requesting|ready|radio|with|for|at|on|holding|good|morning|evening|afternoon|namaste|hello|hi|is|and|the|we|are|stand|bay|gate|information|runway|taxi|pushback|startup|clearance|vacated|clear|lined|line|mayday|pan|say|time|delhi|deli|dehli|dilli|ground|tower|delivery|departure|this)$/;
function parseCallsign(t) {
  const w = t.replace(/^(\w+\s+)?(ground|tower|delivery|departure)\b/, ' ').replace(/\b(delhi\s+)?(ground|tower|delivery)\b/g, ' ').replace(/\b(good (morning|afternoon|evening|day)|namaste|hello|hi)\b/g, ' ').trim().split(' ').filter(Boolean);
  const i = w.findIndex((x) => /^\d{1,5}$/.test(x)); if (i < 1) return null;
  const name = []; for (let j = i - 1; j >= 0 && name.length < 3 && !STOP.test(w[j]); j--) name.unshift(w[j]);
  if (!name.length) return null;
  let num = w[i]; const k = w[i + 1]; if (k && TWY.map((x) => x.toLowerCase()).includes(k)) num += ' ' + k;
  return { name: name.join(' '), num };
}
const cityIn = (t) => CITIES.find((c) => t.includes(c.toLowerCase()));

// ------------------------------------------------------------------ intents, checked in order
const INTENTS = [
  ['mayday', /\b(mayday|may day|pan pan|emergency)\b/],
  ['radio', /\bradio check\b|\bhow do you read\b|\bread(ing)? me\b/],
  ['sayAgain', /\bsay again\b|\bsay that again\b|\brepeat (that|the|your|last)\b|\bdid not copy\b|\bdidn t copy\b/],
  ['time', /\btime check\b|\bwhat time\b/],
  ['reject', /\breject(ing)?\b|\babort(ing)?\b|\bstopping\b/],
  ['returnStand', /\b(taxi back|return) to (the )?(stand|gate|bay|apron)\b|\breturn(ing)? to (stand|gate|bay)\b/],
  ['arrival', /\bvacated\b|\bclear of (the )?runway\b/],
  ['clearance', /\bclearance\b|\bready to copy\b|\bifr\b/],
  ['push', /\bpushback\b|\bpush\b/],
  ['startup', /\bstartup\b|\bengine start\b|\brequest(ing)? start\b/],
  ['rwyChange', /\brequest(ing)? runway \d/],
  ['taxi', /\btaxi\b/],
  ['readyDep', /\bready for (departure|takeoff)\b|\bready\b.*\bholding\b|\bholding (point|short)\b.*\bready\b|\brequest(ing)? (takeoff|departure)\b/],
  ['linedUp', /\blined up\b|\bon the runway\b|\bready on runway\b/],
  ['freq', /\bfrequency\b/],
  ['info', /\b(qnh|weather|atis|wind check|temperature|runway in use|active runway|metar)\b/],
  ['bye', /\bgood ?day\b|\bbye\b|\bnamaste\b|\bthank(s| you)\b|\bcheers\b|\bsee you\b/],
  ['ack', /^(.* )?(roger|wilco|copy|copied|standing by|standby|stand by|affirm|affirmative|will do)( .*)?$/],
];

// ------------------------------------------------------------------ wording: several ways to say each thing
const BANK = {
  noCallsign: [() => 'Station calling Delhi, say again your callsign.', () => 'Aircraft calling, say again callsign.', () => 'Last station calling, your callsign was not readable, say again.'],
  unreadable: [(v) => `${v.cs}, say again, you were broken.`, (v) => `${v.cs}, you are unreadable, say again.`, (v) => `${v.cs}, say again your request.`, (v) => `${v.cs}, I did not get that, say again.`],
  contact: [(v) => `${v.cs}, ${v.stn}, ${v.hi}go ahead.`, (v) => `${v.cs}, ${v.stn}, good ${v.tod}, pass your message.`, (v) => `${v.cs}, ${v.stn}, ${v.hi}go ahead with your request.`, (v) => `${v.cs}, ${v.stn}, good ${v.tod}, go ahead.`],
  radio: [(v) => `${v.cs}, ${v.stn}, reading you five.`, (v) => `${v.cs}, loud and clear.`, (v) => `${v.cs}, ${v.stn}, readability five.`, (v) => `${v.cs}, read you five by five.`],
  time: [(v) => `${v.cs}, time ${v.hhmm}.`, (v) => `${v.cs}, the time is ${v.hhmm}.`, (v) => `${v.cs}, time check ${v.hhmm}.`],
  info: [(v) => `${v.cs}, Delhi information ${v.atis}, runway ${v.rwy} in use, ${v.wind}, visibility ${v.vis} kilometres, temperature ${v.temp}, Q N H ${v.qnh}.`,
    (v) => `${v.cs}, ${v.wind}, Q N H ${v.qnh}, departure runway ${v.rwy}, information ${v.atis} is current.`,
    (v) => `${v.cs}, current Q N H ${v.qnh}, ${v.wind}, temperature ${v.temp}, runway ${v.rwy}.`],
  askDest: [(v) => `${v.cs}, say your destination.`, (v) => `${v.cs}, confirm destination?`, (v) => `${v.cs}, what is your destination?`],
  clearance: [(v) => `${v.cs}, cleared to ${v.dest}, ${v.sid} departure, runway ${v.rwy}, climb ${v.alt}, squawk ${v.sq}.`,
    (v) => `${v.cs}, cleared to destination ${v.dest} via ${v.sid}, runway ${v.rwy}, initial climb ${v.alt}, squawk ${v.sq}.`,
    (v) => `${v.cs}, Delhi Ground, you are cleared ${v.dest}, ${v.sid} departure, runway ${v.rwy}, climb and maintain ${v.alt}, squawk ${v.sq}, departure frequency ${v.depf}.`],
  clearanceAgain: [(v) => `${v.cs}, you are already cleared to ${v.dest}, ${v.sid}, runway ${v.rwy}, squawk ${v.sq}.`, (v) => `${v.cs}, your clearance stands: ${v.dest} via ${v.sid}, ${v.alt}, squawk ${v.sq}.`],
  rbCorrect: [(v) => `${v.cs}, readback correct${v.next}.`, (v) => `${v.cs}, correct${v.next}.`, (v) => `${v.cs}, readback is correct${v.next}.`],
  rbWrong: [(v) => `${v.cs}, negative, ${v.fix}.`, (v) => `${v.cs}, correction, ${v.fix}.`, (v) => `${v.cs}, check readback, ${v.fix}.`],
  rbMissing: [(v) => `${v.cs}, read back the ${v.item}.`, (v) => `${v.cs}, readback incomplete, ${v.fix}.`, (v) => `${v.cs}, confirm ${v.fix}.`],
  needClr: [(v) => `${v.cs}, I don't have your clearance yet, request clearance first.`, (v) => `${v.cs}, no clearance on file, call ready to copy.`, (v) => `${v.cs}, request your clearance first, then call for push.`],
  startup: [(v) => `${v.cs}, start up approved, Q N H ${v.qnh}.`, (v) => `${v.cs}, start up approved, report ready for push.`, (v) => `${v.cs}, Delhi Ground, start approved, temperature ${v.temp}.`],
  startupAgain: [(v) => `${v.cs}, start up is already approved.`, (v) => `${v.cs}, affirm, you have start up approval.`],
  push: [(v) => `${v.cs}, push back and start up approved, facing ${v.face}.`, (v) => `${v.cs}, push back approved, tail ${v.tail}.`, (v) => `${v.cs}, Delhi Ground, push and start approved, face ${v.face}, expect runway ${v.rwy}.`, (v) => `${v.cs}, push back approved, facing ${v.face}, report ready for taxi.`],
  pushAgain: [(v) => `${v.cs}, affirm, you are cleared to push, facing ${v.face}.`, (v) => `${v.cs}, push back already approved, face ${v.face}.`, (v) => `${v.cs}, as approved, push facing ${v.face}.`],
  pushWait: [(v) => `${v.cs}, standby, traffic taxiing behind you.`, (v) => `${v.cs}, hold position, an aircraft is passing behind, I'll call you.`, (v) => `${v.cs}, expect push in one minute, traffic behind.`],
  engNotRunning: [(v) => `${v.cs}, report ready for taxi once both engines are running.`, (v) => `${v.cs}, roger, call me when you are ready to taxi with engines running.`, (v) => `${v.cs}, standby, report fully ready.`],
  taxi: [(v) => `${v.cs}, taxi to holding point runway ${v.rwy} via ${v.route}${v.hs}, Q N H ${v.qnh}.`, (v) => `${v.cs}, Delhi Ground, taxi via ${v.route} to holding point ${v.rwy}${v.hs}.`, (v) => `${v.cs}, taxi holding point runway ${v.rwy}, via ${v.route}${v.hs}.`],
  taxiAgain: [(v) => `${v.cs}, continue as cleared, holding point ${v.rwy} via ${v.route}.`, (v) => `${v.cs}, you are already cleared to taxi, ${v.route}, holding point ${v.rwy}.`, (v) => `${v.cs}, taxi as instructed, holding point runway ${v.rwy}.`],
  rwyOk: [(v) => `${v.cs}, runway ${v.rwy} approved, taxi via ${v.route}.`, (v) => `${v.cs}, approved, expect runway ${v.rwy}, taxi ${v.route}.`],
  rwyNo: [(v) => `${v.cs}, unable, runway ${v.want} not available for departure, continue for ${v.rwy}.`, (v) => `${v.cs}, negative, departures only from ${v.rwy} at this time.`],
  toTower: [(v) => `${v.cs}, contact Tower ${v.twr}, ${v.bye}.`, (v) => `${v.cs}, hold short runway ${v.rwy}, contact Tower ${v.twr}.`, (v) => `${v.cs}, monitor Tower ${v.twr}, ${v.bye}.`],
  wrongToGround: [(v) => `${v.cs}, contact Ground on ${v.gnd} for taxi.`, (v) => `${v.cs}, Delhi Tower, call Ground ${v.gnd}.`, (v) => `${v.cs}, you need Ground, ${v.gnd}.`],
  wrongToTower: [(v) => `${v.cs}, contact Tower ${v.twr} when at the holding point.`, (v) => `${v.cs}, for departure call Tower on ${v.twr}.`, (v) => `${v.cs}, that is Tower's frequency, ${v.twr}.`],
  freq: [(v) => `${v.cs}, ${v.which} frequency ${v.f}.`, (v) => `${v.cs}, ${v.which} is on ${v.f}.`],
  luw: [(v) => `${v.cs}, Delhi Tower, runway ${v.rwy}, line up and wait.`, (v) => `${v.cs}, line up runway ${v.rwy} and wait.`, (v) => `${v.cs}, line up and wait runway ${v.rwy}, one departure ahead.`],
  holdShort: [(v) => `${v.cs}, Delhi Tower, hold short runway ${v.rwy}, landing traffic.`, (v) => `${v.cs}, hold at holding point ${v.rwy}, one landing on short final.`, (v) => `${v.cs}, hold short, traffic on four mile final.`],
  tko: [(v) => `${v.cs}, ${v.wind}, runway ${v.rwy}, cleared for take off.`, (v) => `${v.cs}, runway ${v.rwy}, cleared for take off, ${v.wind}.`, (v) => `${v.cs}, Delhi Tower, ${v.wind}, runway ${v.rwy}, cleared take off.`],
  tkoAgain: [(v) => `${v.cs}, you are cleared for take off runway ${v.rwy}.`, (v) => `${v.cs}, affirm, cleared take off ${v.rwy}, ${v.wind}.`],
  notCleared: [(v) => `${v.cs}, stop immediately, I say again, stop immediately, you are not cleared for take off!`, (v) => `${v.cs}, stop, stop, stop, no take off clearance!`],
  toDep: [(v) => `${v.cs}, contact Delhi Departure ${v.dep}, ${v.bye}.`, (v) => `${v.cs}, airborne at ${v.hhmm}, contact Departure ${v.dep}.`, (v) => `${v.cs}, Departure on ${v.dep}, ${v.bye}.`],
  withDep: [(v) => `${v.cs}, you should be with Departure on ${v.dep}.`, (v) => `${v.cs}, contact Departure ${v.dep}, good day.`],
  reject: [(v) => `${v.cs}, roger, hold position, report when able to vacate.`, (v) => `${v.cs}, copied, stop on the runway, advise intentions.`, (v) => `${v.cs}, roger, emergency services available, report your intentions.`],
  arrival: [(v) => `${v.cs}, Delhi Ground, taxi to ${v.stand} via ${v.route}.`, (v) => `${v.cs}, welcome to Delhi, taxi ${v.stand}, via ${v.route}.`, (v) => `${v.cs}, taxi via ${v.route} to ${v.stand}, give way to the A three twenty on your left.`],
  returnStand: [(v) => `${v.cs}, roger, taxi back to ${v.stand} via ${v.route}, advise if you need assistance.`, (v) => `${v.cs}, approved, return to ${v.stand} via ${v.route}.`],
  mayday: [(v) => `${v.cs}, roger mayday, ${v.stn}, emergency services alerted, runway ${v.rwy} available, ${v.wind}.`, (v) => `${v.cs}, mayday acknowledged, all traffic on this frequency stand by, emergency services on the way.`],
  bye: [(v) => `${v.cs}, ${v.bye}.`, (v) => `Namaste, ${v.cs}.`, (v) => `${v.cs}, good day, safe flight.`],
};

export class AtcBrain {
  constructor(gen) {
    this.gen = gen;
    try { this.f = JSON.parse(sessionStorage.getItem(STORE) || 'null'); } catch { this.f = null; }
    this.f ||= this.fresh();
  }
  fresh() {
    const g = this.gen.f;
    return { seed: (Math.random() * 2 ** 31) | 0, cs: null, phase: 'new', dest: null, rwy: pick(g.dep), used: {}, count: {}, pending: null, last: null, timers: [], qnh: g.qnh, atis: g.atis, temp: int(18, 36), vis: pick(['6', '8', '10', '5']) };
  }
  run(fn) {
    const f = this.f, r = () => { let t = (f.seed = (f.seed + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    RNG = r; setRng(r);
    try { return fn(); } finally { RNG = Math.random; setRng(null); }
  }
  save() { try { sessionStorage.setItem(STORE, JSON.stringify(this.f)); } catch { /* storage unavailable */ } }
  reset() { this.f = this.fresh(); this.save(); }
  get callsign() { return this.f.cs ? this.f.cs.display : null; }

  // never the same wording twice in a row for the same message
  line(key, v) {
    const b = BANK[key], last = this.f.used[key]; let i = Math.floor(R() * b.length);
    if (b.length > 1 && i === last) i = (i + 1 + Math.floor(R() * (b.length - 1))) % b.length;
    this.f.used[key] = i; this.f.last = { key, v }; return b[i](v);
  }
  vars(stn, extra = {}) {
    const f = this.f, d = new Date(), g = this.gen;
    return { cs: f.cs?.say || 'Station calling', stn: STATION[stn], tod: f.greet && f.greet !== 'namaste' && f.greet !== 'day' ? f.greet : d.getHours() < 12 ? 'morning' : d.getHours() < 17 ? 'afternoon' : 'evening',
      rwy: rwy(f.rwy), qnh: dig(f.qnh), atis: f.atis, temp: dig(f.temp), vis: f.vis, wind: g.wind(), hhmm: dig(String(d.getUTCHours()).padStart(2, '0') + String(d.getUTCMinutes()).padStart(2, '0')),
      twr: freq(TOWER), gnd: freq(GROUND), dep: freq(DEPARTURE), depf: freq(DEPARTURE), bye: pick(['good day', 'namaste', 'bye bye', 'have a good flight']), next: '', hi: f.greet === 'namaste' ? 'namaste, ' : f.greet ? `good ${f.greet === 'day' ? 'day' : f.greet}, ` : '', ...extra };
  }

  // the pilot's call -> {say, after?} ; ctx: live aircraft facts
  handle(raw, stn, ctx, dry = false) { return this.run(() => this.handle0(raw, stn, ctx, dry)); }
  handle0(raw, stn, ctx, dry) {
    const t = understand(raw); const f = this.f;
    if (!t) return null;
    const gm = t.match(/\bgood (morning|afternoon|evening|day)\b|\bnamaste\b/); if (gm) f.greet = gm[1] || 'namaste';
    if (!f.cs) {   // first call of the flight: the callsign is whatever the pilot says
      const c = parseCallsign(t); if (!c) return { say: this.line('noCallsign', {}) };
      const words = c.name.split(' ').map((w) => SPOKEN[w] || w[0].toUpperCase() + w.slice(1)).join(' ');
      f.cs = { display: words + ' ' + c.num.toUpperCase(), say: words + ' ' + c.num.replace(/\d+/g, (n) => dig(n)) };
    }
    let intent = (f.pending && this.isReadback(t)) ? 'readback' : (INTENTS.find(([, re]) => re.test(t))?.[0] || null);
    if (!intent) intent = this.guess(t, stn);
    f.count[intent] = (f.count[intent] || 0) + 1;
    const out = (H[intent] || H.unknown).call(this, t, stn, ctx);
    if (!dry) this.save(); return out;
  }

  // The replies the pilot most likely needs next, worked out on a copy of the flight (nothing changes): the radio voices
  // them while the frequency is quiet, so the real answer plays at once. Most likely first.
  predict(stn, ctx) {
    const f = this.f, tries = [], G = stn === 'ground';
    if (!f.cs) tries.push(['h', `delhi ${stn} indigo 1 radio check`], ['h', `delhi ${stn} indigo 1`]);   // first call: everything after the callsign
    else {
    if (f.pending) tries.push(['h', this.goodReadback()]);
    if (G) {
      if (!f.clr) { tries.push(['h', 'request clearance to ' + (f.dest || 'mumbai').toLowerCase()]); if (!f.dest) tries.push(['h', 'request clearance']); }
      else if (!f.pushOk) tries.push(['h', 'request pushback'], ['h', 'request startup']);
      else if (!f.taxiOk) tries.push(['h', 'request taxi']);
    } else tries.push(['h', f.phase === 'luw' ? 'lined up ready' : 'holding point ready for departure']);
    for (const x of f.timers) tries.push(['timer', x]);
    tries.push(['h', 'delhi ' + stn + ' ' + f.cs.say.toLowerCase()], ['h', 'radio check'], ['h', 'say again']);
    }
    const out = [];
    for (const [k, v] of tries) {
      const saved = this.f; this.f = JSON.parse(JSON.stringify(saved));
      try { const r = k === 'timer' ? this.run(() => PROACTIVE[v.fn].call(this)) : this.handle(v, stn, ctx, true); if (r?.say) out.push(r.say); } catch { /* a guess that does not apply */ } finally { this.f = saved; }
    }
    return [...new Set(out)];
  }
  goodReadback() {
    const p = this.f.pending;
    return p.keys.map((k) => (k.item === 'squawk' ? 'squawk ' + k.val : k.item.includes('runway') ? 'runway ' + k.val.slice(0, 2) : k.item === 'direction' ? 'facing ' + k.val : String(k.val).toLowerCase())).join(' ') + ' ' + (this.f.cs?.say.toLowerCase() || '');
  }

  // no clear request: use where the flight is to work out what the pilot most likely means
  guess(t, stn) {
    const f = this.f, ready = /\b(ready|request|requesting|looking for|we would like|like to)\b/.test(t);
    if (ready) {
      if (stn === 'tower') return f.phase === 'luw' ? 'linedUp' : 'readyDep';
      if (!f.clr) return 'clearance'; if (!f.pushOk) return 'push'; if (!f.taxiOk) return 'taxi'; return 'taxi';
    }
    if (f.askedDest && cityIn(t)) return 'clearance';
    if (parseCallsign(t) || t.split(' ').length <= 7) return 'contact';
    return 'unknown';
  }

  // readbacks: the pilot repeats the instruction's numbers / key words
  isReadback(t) {
    const p = this.f.pending, own = this.f.cs?.num?.split(' ')[0];
    const nums = numbers(t).filter((n) => n !== own);   // the callsign's own digits are not a readback
    if (p.keys.some((k) => new RegExp(k.src).test(t))) return true;
    if (/\b(request|requesting|ready|radio check|say again|mayday|pushback|taxi|startup|takeoff|lined|qnh|weather|time check)\b/.test(t)) {
      // the pilot moved on: the instruction counts as copied (a strict controller would insist; this one is kind)
      this.accept(p); return false;
    }
    return nums.length > 0 || /\b(wilco|roger|copied|copy)\b/.test(t);
  }
  accept(p) { const f = this.f; f.pending = null; f.rbTries = 0; if (p.kind === 'clearance') { f.clr = true; if (f.phase === 'new') f.phase = 'cleared'; } if (p.kind === 'freq' && f.phase === 'handoff') f.phase = 'tower'; }
  expect(kind, keys, next = '') { this.f.pending = { kind, keys: keys.map(([item, val, re, hard]) => ({ item, val, re: new RegExp(re), src: re, hard })), next }; }
  checkReadback(t) {
    const p = this.f.pending; const keys = p.keys.map((k) => ({ ...k, re: new RegExp(k.src) }));
    const nums = numbers(t);
    for (const k of keys) {
      if (k.item === 'direction') { const opp = k.val === 'east' ? 'west' : 'east'; if (new RegExp(`\\b${opp}\\b`).test(t) && !new RegExp(`\\b${k.val}\\b`).test(t)) return { wrong: k }; continue; }
      if (k.re.test(t)) continue;
      if (k.hard === 'num') {   // a different number where this one belongs: wrong
        const want = k.val.replace(/\D/g, ''), diff = (n) => [...n].filter((ch, i) => ch !== want[i]).length;
        if (want.length === 4 && nums.some((n) => n.length === 4 && diff(n) <= 1)) continue;   // one digit misheard in a squawk: fine
        const near = nums.find((n) => n.length === want.length && n !== want);
        if (near) return { wrong: k };
      }
      if (k.hard) return { missing: k };
    }
    return { ok: true };
  }

  schedule(ms, stn, fn) { this.f.timers.push({ at: Date.now() + ms, stn, fn }); }
  // called every half second: controller-initiated calls (line up after landing traffic, cleared take-off, handoffs, stop!)
  tick(ctx) {
    const f = this.f, now = Date.now(); if (!f.cs) return null;
    if (ctx.thrustTO && ['new', 'cleared', 'startup', 'push', 'taxi', 'tower', 'holdShort', 'luw'].includes(f.phase) && !f.stopCalled) { f.stopCalled = true; const say = this.run(() => this.line('notCleared', this.vars('tower'))); this.save(); return { stn: f.phase === 'tower' || f.phase === 'holdShort' || f.phase === 'luw' ? 'tower' : 'ground', say }; }
    if (!ctx.thrustTO) f.stopCalled = false;
    if (f.phase === 'takeoff' && ctx.thrustTO) { f.toHeld = (f.toHeld || 0) + 0.5; if (f.toHeld > 20) { f.phase = 'departed'; const say = this.run(() => this.line('toDep', this.vars('tower'))); this.save(); return { stn: 'tower', say }; } }
    const due = f.timers.findIndex((x) => x.at <= now);
    if (due >= 0) { const [x] = f.timers.splice(due, 1); const r = this.run(() => PROACTIVE[x.fn].call(this)); this.save(); return r && { stn: x.stn, ...r }; }
    return null;
  }
}

// controller-initiated follow-ups
const PROACTIVE = {
  pushNow() { const v = this.vars('ground', { face: this.f.face, tail: this.f.face === 'east' ? 'west' : 'east' }); this.f.phase = 'push'; this.expect('push', [['direction', this.f.face, `\\b${this.f.face}\\b|\\bpush`, false]]); return { say: this.line('push', v) }; },
  toTower() { if (this.f.phase !== 'taxi') return null; this.f.phase = 'handoff'; this.expect('freq', [['frequency', '118.7', '\\b118\\.?7|\\b1187|\\btower\\b', false]]); return { say: this.line('toTower', this.vars('ground')) }; },
  lineUp() { if (this.f.phase !== 'holdShort') return null; this.f.phase = 'luw'; this.expect('luw', [['runway', this.f.rwy, `\\b${this.f.rwy.slice(0, 2)}[lrc]?\\b`, 'num']]); this.schedule(int(15000, 28000), 'tower', 'cleared'); return { say: this.line('luw', this.vars('tower')) }; },
  cleared() { if (this.f.phase !== 'luw') return null; this.f.phase = 'takeoff'; this.f.toHeld = 0; this.expect('tko', [['runway', this.f.rwy, `\\b${this.f.rwy.slice(0, 2)}[lrc]?\\b`, 'num'], ['take-off clearance', 'cleared', '\\bcleared\\b|\\btakeoff\\b', false]]); return { say: this.line('tko', this.vars('tower')) }; },
};

// what the controller does with each kind of call (this = AtcBrain)
const H = {
  unknown(t, stn) { return { say: this.line('unreadable', this.vars(stn)) }; },
  contact(t, stn) { return { say: this.line('contact', this.vars(stn)) }; },
  ack() { return null; },
  radio(t, stn) { return { say: this.line('radio', this.vars(stn)) }; },
  time(t, stn) { return { say: this.line('time', this.vars(stn)) }; },
  info(t, stn) { return { say: this.line('info', this.vars(stn)) }; },
  bye(t, stn) { return this.f.phase === 'handoff' || this.f.phase === 'departed' ? { say: this.line('bye', this.vars(stn)) } : null; },
  sayAgain(t, stn) {   // the last message again, worded differently
    const L = this.f.last; if (!L || !BANK[L.key]) return { say: this.line('unreadable', this.vars(stn)) };
    const prev = this.f.used[L.key]; let i = (prev + 1) % BANK[L.key].length; this.f.used[L.key] = i;
    return { say: pick(['I say again, ', '', 'Again, ']) + BANK[L.key][i]({ ...L.v, cs: this.f.cs.say }) };
  },
  mayday(t, stn) { return { say: this.line('mayday', this.vars(stn)) }; },
  freq(t, stn) {
    const which = /\bdeparture\b/.test(t) ? ['Departure', DEPARTURE] : /\bground\b/.test(t) ? ['Ground', GROUND] : /\btower\b/.test(t) ? ['Tower', TOWER] : this.f.phase === 'takeoff' || this.f.phase === 'departed' ? ['Departure', DEPARTURE] : stn === 'ground' ? ['Tower', TOWER] : ['Ground', GROUND];
    return { say: this.line('freq', this.vars(stn, { which: which[0], f: freq(which[1]) })) };
  },

  clearance(t, stn) {
    const f = this.f;
    if (stn === 'tower') return { say: this.line('wrongToGround', this.vars(stn)) };
    const city = cityIn(t); if (city) f.dest = city;
    if (f.clr) return { say: this.line('clearanceAgain', this.vars(stn, this.clrVars())) };
    if (!f.dest) { f.askedDest = true; return { say: this.line('askDest', this.vars(stn)) }; }
    return this.giveClearance(stn);
  },
  startup(t, stn) {
    const f = this.f; if (stn === 'tower') return { say: this.line('wrongToGround', this.vars(stn)) };
    if (!f.clr) return { say: this.line('needClr', this.vars(stn)) };
    if (f.startup) return { say: this.line('startupAgain', this.vars(stn)) };
    f.startup = true; if (f.phase === 'cleared') f.phase = 'startup'; return { say: this.line('startup', this.vars(stn)) };
  },
  push(t, stn) {
    const f = this.f; if (stn === 'tower') return { say: this.line('wrongToGround', this.vars(stn)) };
    if (!f.clr) return { say: this.line('needClr', this.vars(stn)) };
    f.face ||= pick(['east', 'west']); const v = this.vars(stn, { face: f.face, tail: f.face === 'east' ? 'west' : 'east' });
    if (f.pushOk) return { say: this.line('pushAgain', v) };
    f.pushOk = true; f.startup = true;
    if (chance(0.2)) { this.schedule(int(9000, 16000), 'ground', 'pushNow'); return { say: this.line('pushWait', v) }; }
    f.phase = 'push'; this.expect('push', [['direction', f.face, `\\b${f.face}\\b|\\bpush`, false]]);
    return { say: this.line('push', v) };
  },
  taxi(t, stn, ctx) {
    const f = this.f; if (stn === 'tower') return { say: this.line('wrongToGround', this.vars(stn)) };
    if (!f.clr) return { say: this.line('needClr', this.vars(stn)) };
    if (ctx.engines < 2) return { say: this.line('engNotRunning', this.vars(stn)) };
    if (f.taxiOk) return { say: this.line('taxiAgain', this.vars(stn, { route: f.route })) };
    const rt = this.gen.route(int(2, 3)); f.route = rt.join(', '); f.taxiOk = true; f.phase = 'taxi';
    const hs = chance(0.3) ? this.gen.twy() : null;
    this.expect('taxi', [['holding point runway', f.rwy, `\\b${f.rwy.slice(0, 2)}[lrc]?\\b|\\bholding\\b|\\btaxi\\b|\\bvia\\b`, false], ...(hs ? [['hold short', hs, `\\bshort\\b|\\b${hs.split(' ')[0].toLowerCase()}\\b`, true]] : [])]);
    this.schedule(int(55000, 90000), 'ground', 'toTower');   // reaching the holding point
    return { say: this.line('taxi', this.vars(stn, { route: f.route, hs: hs ? `, hold short of ${hs}` : '' })) };
  },
  rwyChange(t, stn) {
    const f = this.f, m = t.match(/runway (\d{1,2})\s*(left|right|l|r)?/); if (!m) return H.unknown.call(this, t, stn);
    const want = m[1].padStart(2, '0') + (m[2] ? m[2][0].toUpperCase() : ''), ok = this.gen.f.dep.find((r) => r.startsWith(want.slice(0, 2)));
    if (ok && chance(0.8)) { f.rwy = ok; const rt = this.gen.route(int(2, 3)); f.route = rt.join(', '); return { say: this.line('rwyOk', this.vars(stn, { route: f.route })) }; }
    return { say: this.line('rwyNo', this.vars(stn, { want: rwy(want) })) };
  },
  readyDep(t, stn) {
    const f = this.f; if (stn === 'ground') return { say: this.line('wrongToTower', this.vars(stn)) };
    if (f.phase === 'takeoff') return { say: this.line('tkoAgain', this.vars(stn)) };
    const roll = R();
    if (roll < 0.35) { f.phase = 'takeoff'; f.toHeld = 0; this.expect('tko', [['runway', f.rwy, `\\b${f.rwy.slice(0, 2)}[lrc]?\\b`, 'num'], ['take-off clearance', 'cleared', '\\bcleared\\b|\\btakeoff\\b', false]]); return { say: this.line('tko', this.vars(stn)) }; }
    if (roll < 0.75) { f.phase = 'luw'; this.expect('luw', [['runway', f.rwy, `\\b${f.rwy.slice(0, 2)}[lrc]?\\b`, 'num']]); this.schedule(int(15000, 28000), 'tower', 'cleared'); return { say: this.line('luw', this.vars(stn)) }; }
    f.phase = 'holdShort'; this.expect('holdShort', [['hold short', 'hold', '\\bhold', false]]); this.schedule(int(20000, 35000), 'tower', 'lineUp');
    return { say: this.line('holdShort', this.vars(stn)) };
  },
  linedUp(t, stn) {
    const f = this.f; if (stn === 'ground') return { say: this.line('wrongToTower', this.vars(stn)) };
    if (f.phase === 'luw') { f.timers = f.timers.filter((x) => x.fn !== 'cleared'); return PROACTIVE.cleared.call(this); }
    return H.readyDep.call(this, t, stn);
  },
  reject(t, stn) { const f = this.f; f.phase = 'rejected'; f.timers = []; return { say: this.line('reject', this.vars(stn)) }; },
  arrival(t, stn) {
    if (stn === 'tower') return { say: this.line('wrongToGround', this.vars(stn)) };
    const st = this.gen.stand(), rt = this.gen.route(int(2, 3)).join(', '); this.expect('stand', [['stand', st, `\\b${st.replace(/\D/g, '').split('').join('\\s?') || 'stand'}\\b|\\bstand\\b|\\bbay\\b`, false]]);
    return { say: this.line('arrival', this.vars(stn, { stand: st, route: rt })) };
  },
  returnStand(t, stn) {
    const f = this.f; if (stn === 'tower') return { say: this.line('wrongToGround', this.vars(stn)) };
    f.phase = 'return'; f.timers = []; const st = this.gen.stand(), rt = this.gen.route(int(2, 3)).join(', ');
    return { say: this.line('returnStand', this.vars(stn, { stand: st, route: rt })) };
  },

  readback(t, stn) {
    const f = this.f, p = f.pending, r = this.checkReadback(t);
    if ((r.wrong || r.missing) && (f.rbTries = (f.rbTries || 0) + 1) <= 2) {   // corrected at most twice, then accepted
      const k = r.wrong || r.missing; const fix = k.item === 'direction' ? `facing ${k.val}` : k.item === 'squawk' ? `squawk ${dig(k.val)}` : k.item.includes('runway') ? `runway ${rwy(k.val)}` : `${k.item} ${k.val}`;
      return { say: this.line(r.wrong ? 'rbWrong' : 'rbMissing', this.vars(stn, { fix, item: k.item })) };
    }
    f.pending = null; f.rbTries = 0;
    if (p.kind === 'clearance') { f.clr = true; f.phase = 'cleared'; return { say: this.line('rbCorrect', this.vars(stn, { next: pick([', report ready for start up', ', call for push and start', '', ', report ready']) })) }; }
    if (p.kind === 'freq' && f.phase === 'handoff') { f.phase = 'tower'; return null; }
    return chance(0.15) ? { say: this.line('rbCorrect', this.vars(stn)) } : null;   // routine readbacks mostly need no answer
  },
};

// clearance details, kept for the flight
AtcBrain.prototype.clrVars = function () { const f = this.f; return { dest: f.dest, sid: f.sidSay, alt: f.alt, sq: dig(f.sq) }; };
AtcBrain.prototype.giveClearance = function (stn) {
  const f = this.f; const [fx, n, l] = this.gen.sid();
  f.sidSay = `${fx} ${dig(n)} ${l}`; f.alt = pick(['four thousand feet', 'six thousand feet', 'flight level one one zero', 'seven thousand feet']);
  f.sq = String(int(1, 7)) + int(0, 7) + int(0, 7) + int(0, 7);
  this.expect('clearance', [['squawk', f.sq, `\\b${f.sq}\\b`, 'num'], ['runway', f.rwy, `\\b${f.rwy.slice(0, 2)}[lrc]?\\b`, 'num'], ['destination', f.dest, f.dest.toLowerCase().slice(0, 4), false]]);
  return { say: this.line('clearance', this.vars(stn, this.clrVars())) };
};
// a destination said on its own after "say destination"
const baseUnknown = H.unknown;
H.unknown = function (t, stn) { const c = cityIn(t); if (c && this.f.askedDest && !this.f.clr) { this.f.dest = c; this.f.askedDest = false; return this.giveClearance(stn); } return baseUnknown.call(this, t, stn); };
H.contact = ((base) => function (t, stn) { const c = cityIn(t); if (c && this.f.askedDest && !this.f.clr) return H.unknown.call(this, t, stn); return base.call(this, t, stn); })(H.contact);
