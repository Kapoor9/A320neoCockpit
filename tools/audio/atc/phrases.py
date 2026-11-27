"""ATC / pilot exchanges for the radio chatter (ICAO phraseology, Indian ATC flavour).

Every exchange is generated: callsign, flight number, stand, taxi route, runway, wind, QNH, squawk, SID, traffic and
wording are drawn at random, so no two exchanges are alike. Two traffic flows (west: runways 27 / 28 / 29L / 29R,
east: 09 / 10 / 11R / 11L) keep a session consistent: the ground and tower pools of one flow are played together.
Fixes, SIDs, stands and taxiways are plausible inventions, not a real chart."""
import random

D = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'niner'}
NATO = 'Alpha Bravo Charlie Delta Echo Foxtrot Golf Hotel India Juliet Kilo Lima Mike November Oscar Papa Quebec Romeo Sierra Tango Uniform Victor Whiskey X-ray Yankee Zulu'.split()
def dig(s): return ' '.join(D.get(c, c) for c in str(s))
def rwy(r): return dig(r[:2]) + {'L': ' left', 'R': ' right', '': ''}[r[2:]]
def freq(f, short=False):
    a, b = f.split('.'); return dig(a) + (' ' if short else ' decimal ') + dig(b)

# telephony, voice group, how flight numbers look
AIRLINES = [
    ('Indigo', 'in', 26, (3, 4)), ('Air India', 'in', 16, (3, 3)), ('Spice jet', 'in', 7, (3, 4)), ('Akasa Air', 'in', 6, (3, 4)),
    ('Express India', 'in', 5, (3, 4)), ('Allied', 'in', 2, (3, 3)),
    ('Emirates', 'mix', 5, (3, 3)), ('Qatari', 'mix', 4, (3, 3)), ('Etihad', 'mix', 2, (3, 3)), ('Speed bird', 'gb', 3, (2, 3)),
    ('Lufthansa', 'us', 2, (3, 3)), ('Singapore', 'mix', 2, (3, 3)), ('Thai', 'us', 1, (3, 3)), ('Gulf Air', 'mix', 1, (3, 3)),
    ('Air France', 'fr', 1, (3, 3)), ('Japan Air', 'jp', 1, (2, 3)), ('Air China', 'cn', 1, (3, 3)), ('Saudia', 'mix', 1, (3, 3)),
    ('United', 'us', 1, (2, 3)), ('Virgin', 'gb', 1, (3, 3)),
]
TYPES = ['A three twenty', 'A three twenty one', 'triple seven', 'seven eight seven', 'A three fifty', 'seven three seven', 'A three eighty', 'A T R']
DEST = ['Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Hyderabad', 'Goa', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Srinagar', 'Guwahati', 'Kochi', 'Dubai', 'Doha', 'London Heathrow', 'Frankfurt', 'Singapore', 'Bangkok', 'Kathmandu', 'Abu Dhabi', 'Riyadh', 'Paris', 'Tokyo Narita', 'Beijing']
FIXES = ['PARVA', 'SIPRA', 'BUBIM', 'NIKAS', 'GUDUM', 'LUMAN', 'AKBAN', 'TELAP', 'RIDAV', 'OSKAN', 'MOLAD', 'KAMRI']
FLOWS = {
    'west': {'runways': ['29R', '29L', '28', '27'], 'dep': ['29R', '28'], 'arr': ['29L', '28', '27'], 'wind': (250, 310), 'face': ['east', 'west'], 'qnh': [1008, 1009, 1010], 'atis': ['Kilo', 'Lima']},
    'east': {'runways': ['11L', '11R', '10', '09'], 'dep': ['11L', '10'], 'arr': ['11R', '10', '09'], 'wind': (60, 130), 'face': ['east', 'west'], 'qnh': [1012, 1013, 1014], 'atis': ['Papa', 'Quebec']},
}
GROUND, TOWER, DEPARTURE = '121.8', '118.7', '126.35'


class Gen:
    def __init__(self, flow, seed):
        self.f = FLOWS[flow]; self.r = random.Random(seed)

    def pick(self, a): return self.r.choice(a)
    def chance(self, p): return self.r.random() < p

    def callsign(self):
        names = [a for a in AIRLINES]; w = [a[2] for a in AIRLINES]
        name, grp, _, (lo, hi) = self.r.choices(names, w)[0]
        n = str(self.r.randint(1, 9)) + ''.join(str(self.r.randint(0, 9)) for _ in range(self.r.randint(lo, hi) - 1))
        return {'say': name + ' ' + dig(n), 'grp': grp, 'name': name}

    def wind(self):
        lo, hi = self.f['wind']; d = self.r.randrange(lo, hi + 1, 10); s = self.r.randint(3, 16)
        return ('wind ' + dig('%03d' % d) + ' degrees, ' + (dig(s) if s < 10 else dig(s)) + ' knots') if not self.chance(0.12) else 'wind calm'
    def qnh(self): return 'Q N H ' + dig(self.pick(self.f['qnh']) + self.r.choice([0, 0, 0, 1, -1]))
    def stand(self): return self.pick(['stand', 'stand', 'bay']) + ' ' + dig(self.r.randint(1, 58)) + (self.pick([' Alpha', ' Bravo', ' Right', ' Left']) if self.chance(0.15) else '')
    def twy(self):
        t = self.pick(NATO[:14] + ['Papa', 'Sierra', 'Tango', 'Victor', 'Whiskey', 'Yankee', 'Zulu'])
        return t + (' ' + dig(self.r.randint(1, 9)) if self.chance(0.3) else '')
    def route(self, n=None):
        n = n or self.r.randint(2, 4); out = []
        while len(out) < n:
            t = self.twy()
            if t not in out: out.append(t)
        return out
    def via(self, rt): return ', '.join(rt)
    def squawk(self): return ''.join(str(self.r.randint(0, 7)) for _ in range(4))
    def sid(self): return self.pick(FIXES), str(self.r.randint(1, 7)), self.pick(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Golf'])
    def bye(self): return self.pick(['good day', 'good day', 'namaste', 'bye bye', 'thank you', 'have a good flight', ''])
    def pbye(self): return self.pick(['good day', 'namaste', 'bye', 'thank you', 'cheers', ''])

    def fin(self, txt):
        txt = txt.replace(' ,', ',').replace(',,', ',').strip(' ,')
        return txt[0].upper() + txt[1:] + ('.' if not txt.endswith(('.', '?')) else '')

    # one exchange: list of (who, text); who is 'atc' or 'plt'
    def ground(self):
        cs = self.callsign(); c = cs['say']; r = self.r; f = self.f; kind = r.choices(
            ['clr', 'push', 'taxi', 'arr', 'giveway', 'handoff', 'hold', 'standby', 'sayagain', 'expect', 'radio'],
            [12, 16, 18, 14, 8, 12, 6, 5, 3, 5, 1])[0]
        dep = self.pick(f['dep']); ex = []
        A = lambda t: ex.append(('atc', self.fin(t))); P = lambda t: ex.append(('plt', self.fin(t)))
        if kind == 'clr':
            dest = self.pick(DEST); fx, n, l = self.sid(); sq = self.squawk(); alt = self.pick(['four thousand feet', 'six thousand feet', 'flight level one one zero', 'seven thousand feet'])
            if self.chance(0.6): P(f'Delhi Ground, {c}, {self.stand()}, ' + self.pick([f'request start up clearance to {dest}', f'request clearance', f'ready to copy clearance']) + (f', information {self.pick(f["atis"])}' if self.chance(0.6) else ''))
            A(f'{c}, cleared to {dest}, {fx} {dig(n)} {l} departure, runway {rwy(dep)}, ' + self.pick(['climb', 'initial climb', 'climb and maintain']) + f' {alt}, squawk {dig(sq)}')
            P(f'Cleared to {dest}, {fx} {dig(n)} {l}, runway {rwy(dep)}, ' + self.pick(['climb', 'initial']) + f' {alt}, squawk {dig(sq)}, {c}')
            if self.chance(0.5): A(f'{c}, readback correct' + self.pick([', report ready for push back', ', start up approved', '']))
        elif kind == 'push':
            face = self.pick(f['face'])
            if self.chance(0.75): P(f'{self.pick(["Delhi Ground", "Ground", "Delhi Ground, good morning", "Delhi Ground, good evening"])}, {c}, {self.stand()}, ' + self.pick(['request push back and start up', 'ready for push and start', 'request push back', 'fully ready, request push']))
            A(f'{c}, ' + self.pick([f'push back and start up approved, facing {face}', f'push back approved, tail {"west" if face == "east" else "east"}', f'push and start approved, face {face}, expect runway {rwy(dep)}']))
            P(self.pick([f'Push back and start up approved, facing {face}, {c}', f'Push approved facing {face}, {c}', f'Push and start, face {face}, {c}']))
        elif kind == 'taxi':
            rt = self.route(); q = self.qnh()
            if self.chance(0.7): P(f'{self.pick(["Delhi Ground", "Ground"])}, {c}, ' + self.pick(['request taxi', 'ready for taxi', 'request taxi, ' + self.stand()]))
            hs = next((t for t in (self.twy() for _ in range(6)) if t not in rt), None) if self.chance(0.35) else None
            A(f'{c}, taxi to holding point runway {rwy(dep)} via {self.via(rt)}' + (f', hold short of {hs}' if hs else '') + (f', {q}' if self.chance(0.5) else ''))
            P(f'Holding point runway {rwy(dep)} via {self.via(rt)}' + (f', hold short {hs}' if hs else '') + f', {c}')
        elif kind == 'arr':
            ar = self.pick(f['arr']); out = self.twy(); rt = self.route(self.r.randint(2, 3)); st = self.stand()
            P(f'{self.pick(["Delhi Ground", "Ground, good evening", "Delhi Ground, namaste"])}, {c}, ' + self.pick([f'vacated runway {rwy(ar)} via {out}', f'runway vacated via {out}', f'clear of runway {rwy(ar)} on {out}']))
            A(f'{c}, Delhi Ground, taxi to {st} via {self.via(rt)}' + (', give way to the ' + self.pick(TYPES) + ' on your right' if self.chance(0.25) else ''))
            P(f'{st.capitalize()} via {self.via(rt)}, {c}')
        elif kind == 'giveway':
            ty = self.pick(TYPES); al = self.callsign()['name']; side = self.pick(['left to right', 'right to left', 'from your left', 'from your right', 'ahead'])
            nx = self.twy()
            A(f'{c}, give way to the {al} {ty} passing {side}, then continue on {nx}')
            P(self.pick([f'Give way to the {al}, then {nx}, {c}', f'Traffic in sight, give way, then continue {nx}, {c}', f'Give way, then continue {nx}, {c}']))
        elif kind == 'handoff':
            A(f'{c}, ' + self.pick([f'contact Tower {freq(TOWER)}', f'hold short runway {rwy(dep)}, contact Tower {freq(TOWER)}', f'monitor Tower {freq(TOWER)}']) + f', {self.bye()}')
            P(f'{freq(TOWER, self.chance(0.5))}, {c}, {self.pbye()}')
        elif kind == 'hold':
            A(f'{c}, hold position, ' + self.pick(['traffic crossing ahead', 'aircraft pushing behind you', 'follow-me vehicle crossing', 'I will call you back']))
            P(f'Holding position, {c}')
        elif kind == 'standby':
            P(f'{self.pick(["Delhi Ground", "Ground"])}, {c}, ' + self.pick(['request push back', 'request taxi', 'ready for start up']))
            A(f'{c}, ' + self.pick(['standby', 'standby, number two for push', 'stand by, I will call you']))
            if self.chance(0.4): P(self.pick([f'Standing by, {c}', f'Copy, {c}']))
        elif kind == 'sayagain':
            rt = self.route(2)
            A(f'{c}, taxi via {self.via(rt)}, holding point runway {rwy(dep)}')
            P(f'Say again for {c}?')
            A(f'{c}, taxi via {self.via(rt)}, holding point runway {rwy(dep)}')
            P(f'Via {self.via(rt)}, holding point {rwy(dep)}, {c}')
        elif kind == 'expect':
            n = self.r.randint(2, 5)
            A(f'{c}, expect push back in {dig(self.r.randint(3, 12))} minutes, you are number {dig(n)}')
            P(self.pick([f'Copy, number {dig(n)}, {c}', f'Roger, {c}', f'Number {dig(n)}, {c}']))
        else:
            P(f'Delhi Ground, {c}, radio check {freq(GROUND)}')
            A(f'{c}, ' + self.pick(['reading you five', 'read you loud and clear', 'readability five']))
        return {'cs': cs, 'kind': kind, 'lines': ex}

    def tower(self):
        cs = self.callsign(); c = cs['say']; r = self.r; f = self.f; kind = r.choices(
            ['ready', 'luw', 'tko', 'land', 'approach', 'vacate', 'dep', 'behind', 'goaround', 'cont'],
            [12, 10, 16, 16, 10, 10, 12, 6, 1, 5])[0]
        dep = self.pick(f['dep']); ar = self.pick(f['arr']); ex = []
        A = lambda t: ex.append(('atc', self.fin(t))); P = lambda t: ex.append(('plt', self.fin(t)))
        if kind == 'ready':
            P(f'Delhi Tower, {c}, holding point runway {rwy(dep)}, ready for departure')
            A(f'{c}, Delhi Tower, ' + self.pick([f'line up and wait runway {rwy(dep)}', f'hold short runway {rwy(dep)}, landing traffic', f'line up runway {rwy(dep)} and wait, one landing traffic on four mile final']))
            P(self.pick([f'Line up and wait {rwy(dep)}, {c}', f'Holding short {rwy(dep)}, {c}', f'Lining up {rwy(dep)}, {c}']))
        elif kind == 'luw':
            A(f'{c}, runway {rwy(dep)}, line up and wait')
            P(f'Line up and wait runway {rwy(dep)}, {c}')
        elif kind == 'tko':
            A(f'{c}, {self.wind()}, runway {rwy(dep)}, cleared for take off')
            P(self.pick([f'Cleared for take off runway {rwy(dep)}, {c}', f'Cleared take off {rwy(dep)}, {c}', f'Runway {rwy(dep)}, cleared for take off, {c}']))
        elif kind == 'land':
            if self.chance(0.4): P(f'Delhi Tower, {c}, ' + self.pick([f'established I L S runway {rwy(ar)}', f'eight miles final runway {rwy(ar)}', f'on final {rwy(ar)}']))
            A(f'{c}, {self.wind()}, runway {rwy(ar)}, cleared to land')
            P(self.pick([f'Cleared to land runway {rwy(ar)}, {c}', f'Cleared to land {rwy(ar)}, {c}']))
        elif kind == 'approach':
            n = self.r.randint(2, 4)
            P(f'Delhi Tower, {c}, ' + self.pick([f'established I L S runway {rwy(ar)}', f'twelve miles final {rwy(ar)}', f'with you on the localizer {rwy(ar)}']))
            A(f'{c}, Delhi Tower, continue approach, number {dig(n)}, {self.wind()}')
            P(f'Continue approach, {c}')
        elif kind == 'vacate':
            t = self.twy()
            A(f'{c}, vacate ' + self.pick(['left', 'right', '']) + f' via {t}, contact Ground {freq(GROUND)}')
            P(f'Via {t}, Ground {freq(GROUND, True)}, {c}')
        elif kind == 'dep':
            A(f'{c}, contact Delhi Departure {freq(DEPARTURE)}, {self.bye()}')
            P(f'{freq(DEPARTURE, self.chance(0.4))}, {c}, {self.pbye()}')
        elif kind == 'behind':
            ty = self.pick(TYPES)
            A(f'{c}, behind the landing {ty} on short final, line up runway {rwy(dep)} behind')
            P(f'Behind the landing {ty}, line up {rwy(dep)} behind, {c}')
        elif kind == 'goaround':
            A(f'{c}, go around, I say again, go around, ' + self.pick(['vehicle on the runway', 'preceding traffic not vacated']))
            P(f'Going around, {c}')
            A(f'{c}, climb four thousand feet, runway heading, contact Approach one two seven decimal niner')
            P(f'Four thousand, runway heading, Approach one two seven niner, {c}')
        else:
            A(f'{c}, continue approach, expect late landing clearance, {self.wind()}')
            P(self.pick([f'Continue, {c}', f'Continuing, {c}']))
        return {'cs': cs, 'kind': kind, 'lines': ex}
