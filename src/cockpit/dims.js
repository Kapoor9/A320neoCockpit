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
  faceZ: 0.132,       // face position at baseY; the face leans back 13 degrees from there
  height: 0.395,      // along the face, up to the top edge at y 0.835
  tiltDeg: 13,
  halfWidth: 0.81,
  centreHalf: 0.215,
  bottomSideY: 0.50,  // captain / F/O panels end higher (knee room)
};
const yl = (y) => (y - 0.45) / Math.cos((13 * Math.PI) / 180);   // world height -> along-face
export const PANEL_Y = yl;

// Display units: square bezel, ~6.25 in screen (measured)
export const DU = { bezel: 0.19, screen: 0.158, depth: 0.03 };
export const DU_POS = {          // panel-local x, along-face y
  PFD1: [-0.51, yl(0.725)], ND1: [-0.312, yl(0.725)], EWD: [0.005, yl(0.725)], SD: [0.005, yl(0.515)],
  ND2: [0.322, yl(0.725)], PFD2: [0.52, yl(0.725)],
};

// Glareshield: thin anti-glare hood; the FCU, EFIS panels and warning blocks form one
// strip across the centre (about ±0.37 m), measured from the reference.
export const GLARE = {
  underY: 0.905, topY: 1.012, frontZ: -0.29, rearZ: 0.27,
  strip: { y: 0.952, faceZ: 0.30, half: 0.67, h: 0.08 },   // measured: face 0.915-0.99, x +-0.67, z 0.30
  fcu: { x: 0, w: 0.24 }, efis: { x: 0.205, w: 0.16 }, warn: { x: 0.405, w: 0.1 },
};

export const PEDESTAL = {
  halfWidth: 0.265,      // forward section: MCDUs, radio panels, thrust quadrant (measured)
  aftHalfWidth: 0.205,   // aft section behind z 0.68: speed brake, flaps, parking brake, door
  aftZ: 0.765,
  // side profile [z, y] from the panel face back to the rear face
  profile: [[0.13, 0.45], [0.40, 0.38], [1.1, 0.38]],
  rearZ: 1.12,
};

export const OVERHEAD = { halfWidth: 0.32, front: [0.473, 1.384], rear: [1.516, 1.749], systemLen: 0.65 };

// side console (lower than the seat armrest) with the sidestick and steering tiller, measured from the reference
export const CONSOLE = { innerX: 0.74, topY: 0.505, z0: 0.05, z1: 0.75 };
export const SIDESTICK = { x: 0.84, z: 0.49 };
export const TILLER = { x: 0.965, z: 0.47 };

export const SEAT = { panY: 0.50, panZ: 0.98, backZ: 1.24, backTop: 1.30 };

// Nose interior cross-section, measured station by station: crown height and the wall
// half-width at each HULL_Y height (up to the crown, where it closes to zero).
export const HULL_Y = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0];
export const HULL = [
  // z,    crownY, half-widths at HULL_Y
  [-0.45, 0.86, [1.00, 0.99, 0.92, 0.78, 0.40]],
  [-0.20, 1.00, [1.16, 1.15, 1.07, 0.93, 0.58]],
  [ 0.10, 1.31, [1.30, 1.29, 1.22, 1.10, 0.93, 0.57, 0.38, 0.19, 0.01]],
  [ 0.40, 1.56, [1.42, 1.40, 1.35, 1.26, 1.12, 0.97, 0.90, 0.75, 0.57, 0.37, 0.17]],
  [ 0.70, 1.78, [1.54, 1.52, 1.47, 1.40, 1.28, 1.12, 1.05, 0.98, 0.91, 0.85, 0.72, 0.55, 0.29]],
  [ 1.00, 1.91, [1.58, 1.58, 1.57, 1.51, 1.41, 1.28, 1.21, 1.14, 1.08, 1.01, 0.92, 0.82, 0.68, 0.48, 0.06]],
  [ 1.40, 2.03, [1.60, 1.60, 1.58, 1.55, 1.48, 1.41, 1.35, 1.29, 1.23, 1.17, 1.09, 1.00, 0.91, 0.77, 0.60, 0.34]],
  [ 2.10, 2.05, [1.60, 1.60, 1.58, 1.55, 1.48, 1.41, 1.35, 1.29, 1.23, 1.17, 1.09, 1.00, 0.91, 0.78, 0.62, 0.38]],
];

// Windshield pane (F/O side; the captain's is the mirror image), corners [x, y, z]:
// a swept V in plan, raked about 45 degrees, centre post forward.
export const WINDSHIELD = {
  innerBottom: [0.022, 0.89, -0.29], innerTop: [0.022, 1.353, 0.171],
  outerTop: [0.765, 1.398, 0.612], outerBottom: [0.875, 0.92, 0.20],
};
// Side windows as outlines in side view [z, y] (sliding window 2, fixed window 3)
export const SIDE_WINDOWS = {
  w2: [[0.28, 0.935], [0.79, 0.81], [0.975, 0.81], [0.975, 1.385], [0.64, 1.395]],
  w3: [[1.065, 0.81], [1.58, 0.81], [1.62, 0.87], [1.62, 1.25], [1.49, 1.39], [1.065, 1.39]],
};

export const GROUND_Y = -2.7;   // apron below the cockpit floor (~)
export const REAR_WALL_Z = 2.08;
