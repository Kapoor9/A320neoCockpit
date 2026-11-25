// A320neo flight deck — dimensions in metres.
// Axes: x = right (F/O side +), y = up from the cockpit floor, z = aft (+ towards the seats).
// z = 0 is the face of the main instrument panel at its base.
//
// Vertical proportions were measured from the owner's reference model, whose airframe is
// true to scale (35.8 m wingspan). Lateral seat positions also come from it. Everything
// else is standard A320 flight-deck geometry; values marked ~ are best estimates.

export const SEAT_X = 0.53;                 // seat centreline, each side of the aircraft centreline
export const EYE = { y: 1.15, z: 0.92 };    // seated eye position (~)

export const PANEL = {
  baseY: 0.45,        // bottom of the centre instrument panel (meets the pedestal)
  height: 0.42,       // up to the glareshield underside
  tiltDeg: 8,         // top leans forward
  halfWidth: 1.0,
  sideWidth: 0.74,    // captain / F/O panel width (x from 0.26 to 1.0)
  centreHalf: 0.26,
  bottomSideY: 0.50,  // captain / F/O panels end higher (knee room)
};

// Display units: 7.25 in bezel, ~6.25 in screen
export const DU = { bezel: 0.200, screen: 0.162, depth: 0.035 };
export const DU_POS = {          // panel-local x, y (y from PANEL.baseY up the tilted face)
  PFD1: [-0.72, 0.30], ND1: [-0.49, 0.30], EWD: [0, 0.30], SD: [0, 0.112],
  ND2: [0.49, 0.30], PFD2: [0.72, 0.30],
};

// Glareshield: thin anti-glare hood; the FCU, EFIS panels and warning blocks form one
// strip across the centre (about ±0.37 m), measured from the reference.
export const GLARE = {
  underY: 0.865, topY: 1.02, frontZ: -0.34, rearZ: 0.04,
  strip: { y: 0.925, faceZ: 0.085 },      // centre of the control strip, and its face position
  fcu: { x: 0, w: 0.25 }, efis: { x: 0.225, w: 0.19 }, warn: { x: 0.355, w: 0.06 },
};

export const PEDESTAL = {
  halfWidth: 0.25,
  // side profile [z, y] from the panel back to the rear face
  profile: [[0.02, 0.45], [0.40, 0.38], [1.02, 0.38]],
  rearZ: 1.04,
};

export const OVERHEAD = { halfWidth: 0.32, front: [0.45, 1.45], rear: [1.45, 1.80] };

// side console (lower than the seat armrest) with the sidestick and steering tiller, measured from the reference
export const CONSOLE = { innerX: 0.74, topY: 0.505, z0: 0.05, z1: 0.75 };
export const SIDESTICK = { x: 0.84, z: 0.49 };
export const TILLER = { x: 0.965, z: 0.47 };

export const SEAT = { panY: 0.50, panZ: 0.98, backZ: 1.24, backTop: 1.30 };

// Fuselage interior cross-section by station (z): floor half-width, shoulder half-width
// (at SHOULDER_Y) and crown height.
export const SHOULDER_Y = 1.10;
export const SHELL = [
  // z,    floorHW, shoulderHW, crownY
  [-0.45, 0.80, 0.82, 1.42],
  [-0.10, 0.88, 0.96, 1.48],
  [ 0.20, 0.92, 1.04, 1.56],
  [ 0.45, 0.95, 1.08, 1.66],
  [ 0.90, 0.97, 1.12, 1.86],
  [ 1.40, 0.98, 1.13, 1.95],
  [ 2.10, 0.98, 1.13, 1.97],
];

// Openings in the shell (windshield and side windows)
export const WINDOWS = {
  windshield: { z0: -0.45, z1: 0.43, y0: 1.07 },
  side2: { z0: 0.51, z1: 1.10, y0: 1.12, y1: 1.47 },   // sliding window
  side3: { z0: 1.18, z1: 1.52, y0: 1.14, y1: 1.43 },
};

export const GROUND_Y = -2.7;   // apron below the cockpit floor (~)
export const REAR_WALL_Z = 2.08;
