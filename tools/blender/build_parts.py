# Detailed A320 flight-deck parts modelled in Blender (subdivision surfaces, bevels),
# exported to one GLB. Run with the bpy module:  python tools/blender/build_parts.py
# Axes (Blender): X = right (toward the F/O), Y = forward, Z = up. Units: metres.
# Each part is parented to an empty whose name the cockpit looks up.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else os.path.join(os.path.dirname(__file__), '../../public/models/a320_parts.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgb, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m

M = {
    'grip': mat('StickGrip', (0.028, 0.030, 0.033), 0.62),
    'red': mat('ButtonRed', (0.55, 0.035, 0.025), 0.35),
    'rubber': mat('Rubber', (0.012, 0.012, 0.013), 0.88),
    'plate': mat('PanelGrey', (0.045, 0.057, 0.067), 0.55),
    'metal': mat('Metal', (0.55, 0.57, 0.58), 0.3, 0.9),
    'handle': mat('LeverGrey', (0.075, 0.08, 0.085), 0.5),
    'black': mat('Black', (0.018, 0.019, 0.02), 0.5),
    'pad': mat('Pad', (0.035, 0.045, 0.06), 0.85),
    'pedal': mat('PedalGrey', (0.11, 0.12, 0.125), 0.6, 0.2),
}

def obj_from_bm(name, bm, material, parent, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(material); o.parent = parent
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o

def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def subsurf(o, lv=2):
    m = o.modifiers.new('sub', 'SUBSURF'); m.levels = lv; m.render_levels = lv
def bevel(o, w, seg=3, limit='ANGLE'):
    m = o.modifiers.new('bev', 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = limit
    if limit == 'ANGLE': m.angle_limit = math.radians(30)

def empty(name):
    e = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(e); return e

def rounded_box(name, sx, sy, sz, r, material, parent, loc=(0, 0, 0), rot=(0, 0, 0), seg=4, sub=0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    o = obj_from_bm(name, bm, material, parent, smooth=True)
    bevel(o, min(r, sx / 2.01, sy / 2.01, sz / 2.01), seg, 'NONE')
    if sub: subsurf(o, sub)
    apply_mods(o); o.location = loc; o.rotation_euler = rot
    return o

def cylinder(name, r, h, material, parent, loc=(0, 0, 0), rot=(0, 0, 0), seg=32, bev=0.0):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    o = obj_from_bm(name, bm, material, parent)
    if bev: bevel(o, bev, 3); apply_mods(o)
    o.location = loc; o.rotation_euler = rot
    return o

def lathe(name, prof, material, parent, steps=64):
    """revolve a (r, z) profile about Z"""
    bm = bmesh.new(); rings = []
    for i in range(steps):
        a = 2 * math.pi * i / steps
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in prof])
    for i in range(steps):
        A, B = rings[i], rings[(i + 1) % steps]
        for k in range(len(prof) - 1): bm.faces.new((A[k], A[k + 1], B[k + 1], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, parent)

def loft(name, spine, secs, material, parent, n=24, shape=None):
    """sweep elliptical sections (a: half-width in X, b: half-depth in the spine plane) along a spine in the YZ plane"""
    bm = bmesh.new(); rings = []; P = [Vector(p) for p in spine]
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        X = Vector((1, 0, 0)); N = X.cross(t).normalized()
        a, b = secs[i]; ring = []
        for k in range(n):
            th = 2 * math.pi * k / n; c, s = math.cos(th), math.sin(th)
            ka, kb = shape(i, c, s) if shape else (1, 1)
            ring.append(bm.verts.new(p + X * (a * ka * c) + N * (b * kb * s)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(n): bm.faces.new((rings[i][k], rings[i][(k + 1) % n], rings[i + 1][(k + 1) % n], rings[i + 1][k]))
    for ring, end in ((rings[0], P[0] - (P[1] - P[0]).normalized() * 0.002), (rings[-1], P[-1] + (P[-1] - P[-2]).normalized() * 0.004)):
        c = bm.verts.new(end)
        for k in range(n): bm.faces.new((ring[k], ring[(k + 1) % n], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = obj_from_bm(name, bm, material, parent); subsurf(o, 2); apply_mods(o); return o

# ------------------------------------------------------------------ sidestick (captain; takeover button inboard, +X)
# Squared-off pistol grip: thick shaft, head swept forward over the fingers with a drooping nose,
# radio trigger under the nose, on a stacked rubber boot in a square bezel.
st = empty('Sidestick')
spine = [(0, -0.002, 0.036), (0, 0.0, 0.068), (0, 0.004, 0.098), (0, 0.012, 0.121), (0, 0.026, 0.137), (0, 0.044, 0.146), (0, 0.060, 0.145), (0, 0.073, 0.138), (0, 0.081, 0.127)]
secs = [(0.0168, 0.0168), (0.0162, 0.0165), (0.0168, 0.0172), (0.0192, 0.0192), (0.0222, 0.0212), (0.0226, 0.0205), (0.0205, 0.0185), (0.0165, 0.0148), (0.0102, 0.0092)]
def stick_shape(i, c, s):
    n = 2.7                                                     # superellipse: squarer sections, like a moulded grip
    sc = abs(c) ** (2 / n - 1) if c else 1; ss = abs(s) ** (2 / n - 1) if s else 1
    ka, kb = sc, ss
    if 3 <= i <= 7 and c > 0: ka *= 1 + 0.16 * c * c            # thumb rest, inboard
    if i >= 4 and s > 0: kb *= 0.82                              # flat top of the head
    return ka, kb
loft('StickGrip', spine, secs, M['grip'], st, shape=stick_shape)
tr = rounded_box('StickTrigger', 0.016, 0.012, 0.032, 0.0045, M['black'], st, loc=(0, 0.066, 0.118), rot=(math.radians(-35), 0, 0), sub=1)
cylinder('StickButtonBezel', 0.0088, 0.004, M['black'], st, loc=(0.0115, 0.044, 0.1625), rot=(math.radians(-6), math.radians(26), 0), bev=0.0012)
cylinder('StickButton', 0.0068, 0.006, M['red'], st, loc=(0.0122, 0.044, 0.1645), rot=(math.radians(-6), math.radians(26), 0), bev=0.0018)
# stacked rubber boot: rounded-square layers stepping in toward the grip, on a rubber core
for k in range(6):
    w = 0.098 - k * 0.009
    rounded_box('StickBootLayer', w, w, 0.0042, 0.006 + k * 0.0008, M['rubber'], st, loc=(0, 0, 0.004 + k * 0.0062), seg=3)
lathe('StickBootCore', [(0.022, 0.0), (0.021, 0.03), (0.018, 0.04), (0.0168, 0.046)], M['rubber'], st)
pl = rounded_box('StickPlate', 0.122, 0.122, 0.008, 0.006, M['plate'], st, loc=(0, 0, -0.004))
for sx in (-1, 1):
    for sy in (-1, 1):
        cylinder('StickScrew', 0.0034, 0.0024, M['metal'], st, loc=(sx * 0.052, sy * 0.052, 0.001), seg=16, bev=0.0008)

# ------------------------------------------------------------------ thrust lever handle (left lever; A/THR pb outboard, -X)
th = empty('ThrustHandle')
prof2 = [(-0.019, 0.0), (0.014, 0.0), (0.023, 0.009), (0.022, 0.024), (0.010, 0.034), (-0.010, 0.034), (-0.020, 0.024)]
bm = bmesh.new(); vs = []
for xx in (-0.025, 0.025): vs.append([bm.verts.new((xx, y, z)) for y, z in prof2])
n = len(prof2)
for k in range(n): bm.faces.new((vs[0][k], vs[0][(k + 1) % n], vs[1][(k + 1) % n], vs[1][k]))
bm.faces.new(vs[0][::-1]); bm.faces.new(vs[1])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
ho = obj_from_bm('ThrustGrip', bm, M['handle'], th); bevel(ho, 0.0065, 4, 'NONE'); subsurf(ho, 1); apply_mods(ho)
rounded_box('ThrustGripPad', 0.046, 0.022, 0.006, 0.0025, M['black'], th, loc=(0, 0.002, 0.034), sub=1)
cylinder('AthrDisconnect', 0.0062, 0.006, M['red'], th, loc=(-0.0275, 0.003, 0.017), rot=(0, math.radians(90), 0), bev=0.0015)
rounded_box('ReverseLatch', 0.03, 0.006, 0.022, 0.0025, M['metal'], th, loc=(0.0, 0.026, -0.008), rot=(math.radians(32), 0, 0))
rounded_box('ThrustNeck', 0.012, 0.016, 0.02, 0.003, M['metal'], th, loc=(0, 0, -0.008))

# ------------------------------------------------------------------ rudder pedal (hinge at the top, plate facing aft)
rp = empty('RudderPedal')
plate = rounded_box('PedalPlate', 0.085, 0.014, 0.2, 0.006, M['pedal'], rp, loc=(0, 0.0, -0.11), rot=(math.radians(-22), 0, 0))
for k in range(7):
    rounded_box('PedalRib', 0.07, 0.005, 0.006, 0.002, M['black'], rp, loc=(0, -0.008 - (0.03 + k * 0.024) * math.sin(math.radians(22)) * 0, -0.03 - k * 0.025), rot=(math.radians(-22), 0, 0))
rounded_box('PedalArm', 0.018, 0.02, 0.13, 0.004, M['metal'], rp, loc=(0, 0.05, 0.01), rot=(math.radians(-55), 0, 0))
cylinder('PedalHinge', 0.011, 0.1, M['black'], rp, loc=(0, 0.0, 0.0), rot=(0, math.radians(90), 0))

# ------------------------------------------------------------------ side-console armrest (padded, on its adjuster)
ar = empty('Armrest')
pad = rounded_box('ArmPad', 0.075, 0.3, 0.05, 0.018, M['pad'], ar, loc=(0, 0, 0.075), sub=2)
rounded_box('ArmBase', 0.05, 0.16, 0.05, 0.008, M['plate'], ar, loc=(0, -0.04, 0.03))
cylinder('ArmKnob', 0.012, 0.03, M['black'], ar, loc=(0.035, -0.08, 0.04), rot=(0, math.radians(90), 0), bev=0.002)

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_apply=True, export_yup=True)
print('wrote', OUT, os.path.getsize(OUT))
