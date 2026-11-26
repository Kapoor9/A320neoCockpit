# A320 reference values (Phase 3)

Values used for colour and lighting work, with where they came from. Photos of F-WWIY (owner's own) are the primary reference; the web sources below fill in conventions.

## Cockpit paint
- Panels and linings: a light blue-grey; the glareshield and switch knobs are much darker grey/black. Simmers matching it use a French light blue-grey (flat) for panels and a dark blue-grey for darker parts (AVSIM forum, "Boeing and Airbus panel and knob colors").
- Airbus is reported to use RAL greys and blues (Dove grey / Pigeon blue named on the MSFS forums). RAL 5014 Pigeon blue = RGB 104,124,150 (Siemens RAL table). Used only as a sanity check; the photos decide the final value because colour shifts with light and age.

## Lights
- Pushbutton colour code: red = warning needing immediate action, amber = caution/failure, green = normal operation, blue = normal but temporary, white = abnormal switch position / maintenance; dark = normal ("lights out" philosophy) (aviationhunt A320 cockpit notes; A320 FCOM summary on sohu).
- Integral (panel lettering) lighting on current aircraft is a warm white; older standard looks amber-orange (pilotsofamerica thread).
- Cockpit lighting comprises dome, integral panel/instrument lighting, flood (under-glareshield and pedestal), reading lights, annunciator test/dim (A320 ATA 33 notes, HAW Hamburg / aviationhunt).

## Displays
- E/WD colours: green normal, white labels, blue/cyan units and action steps, amber caution, red warning, magenta information, amber XX = data not available (Brainscape indicating/recording cards; Wikipedia ECAM).
- PFD: selected targets cyan, managed magenta; speed trend yellow; current heading yellow line; FMA armed blue/magenta, engaged green (pmflight.co.uk; Brainscape PFD cards).
- SD page conventions per FlyByWire A32NX docs (docs.flybywiresim.com, ECAM SD pages).

## Rendering
- Tone mapping: Khronos PBR Neutral keeps material colours faithful; ACES/AgX give a filmic roll-off (three.js forum "Tone Mapping Overview").
- Realism comes mostly from image-based environment light plus ambient occlusion / indirect-light approximation; flat look comes from missing AO and bounce (three.js forum threads on realistic lighting).
