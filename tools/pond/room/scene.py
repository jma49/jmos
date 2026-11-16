# The room under the pond, detailed: the agreed greybox (greybox.py) built out into real objects,
# materials and light, all from code. Run with Blender's Python module (Cycles on the CPU):
#   python tools/pond/room/scene.py out.png [samples] [width] [view] [stats]
# view is one of hero (the seat, the default), laptop, arm, tree (and keys, a check on the keyboard).
# "stats" prints triangles per object group. The screens' pictures are painted into ROOM_TEX.
# Lengths are metres. The seat looks toward -Y, so +X is on the LEFT of the picture.
import math
import os
import random
import sys
import warnings

import bpy  # before bmesh and mathutils, which it provides
import bmesh
import numpy as np
from mathutils import Matrix, Vector

warnings.filterwarnings('ignore', category=DeprecationWarning)

OUT = sys.argv[1] if len(sys.argv) > 1 else 'room.png'
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 96
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 1280
VIEW = sys.argv[4] if len(sys.argv) > 4 else 'hero'
STATS = 'stats' in sys.argv
TEX = os.environ.get('ROOM_TEX', '/home/user/room/tex')  # where the generated screen pictures go

rad = math.radians
TOP = 0.74  # the desk top's height
MAT_H = 0.003  # the desk mat's thickness

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
COLL = scene.collection


# ---------------------------------------------------------------------------------------------
# Building blocks: every mesh below is made from these few shapes.
# ---------------------------------------------------------------------------------------------

def empty(name, at=(0, 0, 0), rot=(0, 0, 0), parent=None):
    """A named point that other objects hang from."""
    o = bpy.data.objects.new(name, None)
    COLL.objects.link(o)
    o.location, o.rotation_euler, o.parent = at, rot, parent
    return o


def obj_from_bm(name, bm, mat=None, at=(0, 0, 0), rot=(0, 0, 0), parent=None, sharp=50, smooth=True):
    """Turn a bmesh into an object. Faces are smooth, edges sharper than `sharp` degrees stay
    crisp, and normals are weighted by face area so large flat faces stay flat beside their bevels."""
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    o.location, o.rotation_euler, o.parent = at, rot, parent
    if mat:
        me.materials.append(mat)
    if smooth:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=rad(sharp))
        wn = o.modifiers.new('normals', 'WEIGHTED_NORMAL')
        wn.keep_sharp = True
    return o


def rrect(w, d, r, seg):
    """The outline of a rounded rectangle, anticlockwise seen from above."""
    r = max(min(r, w / 2 - 1e-6, d / 2 - 1e-6), 1e-6)
    pts = []
    for cx, cy, a0 in ((w / 2 - r, d / 2 - r, 0), (-w / 2 + r, d / 2 - r, 90),
                       (-w / 2 + r, -d / 2 + r, 180), (w / 2 - r, -d / 2 + r, 270)):
        for i in range(seg + 1):
            a = rad(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def rsec(h, rb=0.0, rt=0.0, n=3):
    """Cross-sections (inset, height) for a slab h tall whose bottom and top edges are rounded."""
    s = []
    if rb > 0:
        s += [(rb * (1 - math.sin(math.pi / 2 * i / n)), rb * (1 - math.cos(math.pi / 2 * i / n))) for i in range(n + 1)]
    else:
        s.append((0, 0))
    if rt > 0:
        s += [(rt * (1 - math.cos(math.pi / 2 * i / n)), h - rt * (1 - math.sin(math.pi / 2 * i / n))) for i in range(n + 1)]
    else:
        s.append((0, h))
    return s


def loft_into(bm, w, d, r, sections, seg=6, off=(0, 0, 0)):
    """Add a rounded-rectangle solid to a bmesh: one ring per (inset, height) section, capped."""
    rings = []
    for inset, z in sections:
        rings.append([bm.verts.new((x + off[0], y + off[1], z + off[2]))
                      for x, y in rrect(w - 2 * inset, d - 2 * inset, r - inset, seg)])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def slab(name, w, d, h, r, mat, at=(0, 0, 0), rot=(0, 0, 0), parent=None, rb=0.0, rt=0.0, seg=6, n=3):
    """A rounded-rectangle plate w by d, h tall (z from 0 to h), corner radius r, with rounded
    bottom (rb) and top (rt) edges. The workhorse: laptop, monitors, books, phone, plates."""
    bm = bmesh.new()
    loft_into(bm, w, d, r, rsec(h, rb, rt, n), seg)
    return obj_from_bm(name, bm, mat, at, rot, parent)


def box(name, size, at, mat, rot=(0, 0, 0), parent=None, bevel=0.0):
    """A plain box centred on `at`, with its edges eased by `bevel`."""
    w, d, h = size
    b = min(bevel, w / 2.01, d / 2.01, h / 2.01)
    bm = bmesh.new()
    loft_into(bm, w, d, b, rsec(h, b, b, 2) if b else [(0, 0), (0, h)], 2 if b else 1, off=(0, 0, -h / 2))
    return obj_from_bm(name, bm, mat, at, rot, parent)


def beam(name, a, b, thick, mat, parent=None, bevel=0.004):
    """A bar from a to b; thick is (sideways, upward)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = box(name, (thick[0], thick[1], d.length), (a + b) / 2, mat, parent=parent, bevel=bevel)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return o


def lathe(name, prof, mat, at=(0, 0, 0), rot=(0, 0, 0), parent=None, seg=48, sharp=50):
    """Spin a profile of (radius, height) points about the Z axis: mugs, pots, shades, knobs."""
    bm = bmesh.new()
    rings = []
    for r, z in prof:
        if r < 1e-7:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z))
                          for i in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[j], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[j], b[0]))
            else:
                bm.faces.new((a[i], a[j], b[j], b[i]))
    return obj_from_bm(name, bm, mat, at, rot, parent, sharp=sharp)


def cyl(name, r, h, at, mat, rot=(0, 0, 0), parent=None, bevel=0.0, seg=32):
    """A cylinder centred on `at`, its rims eased by `bevel`."""
    b = min(bevel, r * 0.9, h * 0.45)
    if b:
        prof = [(0, -h / 2), (r - b, -h / 2), (r - b * 0.3, -h / 2 + b * 0.3), (r, -h / 2 + b),
                (r, h / 2 - b), (r - b * 0.3, h / 2 - b * 0.3), (r - b, h / 2), (0, h / 2)]
    else:
        prof = [(0, -h / 2), (r, -h / 2), (r, h / 2), (0, h / 2)]
    return lathe(name, prof, mat, at, rot, parent, seg)


def tube(name, pts, r, mat, parent=None, res=12, extrude=0.0):
    """A round cable or rod through the given points (a smooth curve with thickness)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = r, 3, res
    cu.use_fill_caps = True
    cu.extrude = extrude
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for p, co in zip(sp.bezier_points, pts):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    o = bpy.data.objects.new(name, cu)
    COLL.objects.link(o)
    o.parent = parent
    cu.materials.append(mat)
    return o


def picture_plane(name, w, h, mat, at=(0, 0, 0), rot=(0, 0, 0), parent=None):
    """An upright rectangle facing -Y with a picture mapped across it (a lit screen)."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new('UVMap')
    for loop, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = c
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    o.location, o.rotation_euler, o.parent = at, rot, parent
    me.materials.append(mat)
    return o


# ---------------------------------------------------------------------------------------------
# Materials. A small wrapper keeps the node wiring readable.
# ---------------------------------------------------------------------------------------------

class Nodes:
    """Shorthand for wiring a material's nodes."""

    def __init__(self, name):
        self.mat = bpy.data.materials.new(name)
        self.mat.use_nodes = True
        self.nt = self.mat.node_tree
        self.bsdf = self.nt.nodes['Principled BSDF']
        self.out = self.nt.nodes['Material Output']

    def node(self, kind, inputs=None, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        for k, v in (inputs or {}).items():
            self.put(n.inputs[k], v)
        return n

    def put(self, socket, v):
        if isinstance(v, bpy.types.NodeSocket):
            self.nt.links.new(v, socket)
        elif isinstance(v, bpy.types.Node):
            self.nt.links.new(v.outputs[0], socket)
        else:
            socket.default_value = v

    def set(self, **inputs):
        """Set Principled inputs by name, e.g. set(Roughness=0.3)."""
        for k, v in inputs.items():
            self.put(self.bsdf.inputs[k.replace('_', ' ')], v)
        return self

    def coords(self, kind='Object'):
        return self.node('ShaderNodeTexCoord').outputs[kind]

    def mapping(self, vec, scale=(1, 1, 1), loc=(0, 0, 0), rot=(0, 0, 0)):
        return self.node('ShaderNodeMapping', {'Vector': vec, 'Scale': scale, 'Location': loc, 'Rotation': rot}).outputs[0]

    def math(self, op, a, b=0.0, clamp=False):
        return self.node('ShaderNodeMath', {0: a, 1: b}, operation=op, use_clamp=clamp).outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        return self.node('ShaderNodeMix', {0: fac, 6: a, 7: b}, data_type='RGBA', blend_type=blend).outputs[2]

    def noise(self, vec, scale=5.0, detail=3.0, rough=0.55, distortion=0.0, color=False):
        n = self.node('ShaderNodeTexNoise', {'Vector': vec, 'Scale': scale, 'Detail': detail,
                                             'Roughness': rough, 'Distortion': distortion})
        return n.outputs['Color' if color else 'Fac']

    def ramp(self, fac, stops, interp='LINEAR'):
        n = self.node('ShaderNodeValToRGB', {'Fac': fac})
        cr = n.color_ramp
        cr.interpolation = interp
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for e, (pos, col) in zip(cr.elements, stops):
            e.position = pos
            e.color = (*col, 1) if len(col) == 3 else col
        return n.outputs['Color']

    def bump(self, height, strength=0.2, distance=0.001):
        n = self.node('ShaderNodeBump', {'Height': height, 'Strength': strength, 'Distance': distance})
        self.nt.links.new(n.outputs[0], self.bsdf.inputs['Normal'])
        return n.outputs[0]


def rgba(c):
    return (*c, 1)


def pbr(name, color, rough=0.5, metal=0.0, grain=0.0, grain_scale=400.0, **more):
    """A plain surface: colour, roughness, metalness; `grain` adds a fine bumpy texture
    (powder coat, moulded plastic, anodising) that also breaks up the highlights."""
    n = Nodes(name)
    n.set(Base_Color=rgba(color), Roughness=rough, Metallic=metal)
    for k, v in more.items():
        n.set(**{k: rgba(v) if isinstance(v, tuple) and len(v) == 3 else v})
    if grain:
        f = n.noise(n.coords(), grain_scale, 2.0, 0.6)
        n.bump(f, grain, 0.0003)
        n.set(Roughness=n.math('ADD', n.math('MULTIPLY', f, 0.25), rough - 0.12))
    return n.mat


def wood(name, dark, light, stave=0.11, along_y=False, rough=0.4, seed=0.0):
    """Wood with the grain running lengthwise: glued staves, each with its own figure and tone,
    long wavy growth lines, fine pores, and a satin finish that is a little uneven."""
    n = Nodes(name)
    co = n.mapping(n.coords(), rot=(0, 0, rad(90) if along_y else 0), loc=(seed, seed * 2, 0))
    sep = n.node('ShaderNodeSeparateXYZ', {0: co})
    # which stave are we on, and a random number for it
    idx = n.math('FLOOR', n.math('DIVIDE', sep.outputs['Y'], stave))
    rnd = n.node('ShaderNodeTexWhiteNoise', {'W': idx}, noise_dimensions='1D')
    shifted = n.node('ShaderNodeVectorMath', {0: co, 1: n.node('ShaderNodeVectorMath', {0: rnd.outputs['Color'], 3: 7.0}, operation='SCALE')}, operation='ADD').outputs[0]
    # growth lines: bands across the width, stretched far along the length, pushed about by noise
    rings = n.node('ShaderNodeTexWave', {'Vector': n.mapping(shifted, (0.07, 1, 1)), 'Scale': 5.0, 'Distortion': 14.0,
                                         'Detail': 3.0, 'Detail Scale': 1.2, 'Detail Roughness': 0.6},
                   wave_type='BANDS', bands_direction='Y', wave_profile='SAW').outputs['Fac']
    # pores: short dark streaks
    pores = n.noise(n.mapping(shifted, (6, 420, 420)), 1.0, 2.0, 0.7)
    streak = n.noise(n.mapping(shifted, (0.5, 40, 40)), 1.0, 3.0, 0.6)
    tone = n.math('ADD', n.math('MULTIPLY', rings, 0.32), n.math('MULTIPLY', streak, 0.85))
    tone = n.math('ADD', tone, n.math('MULTIPLY', n.math('SUBTRACT', rnd.outputs['Value'], 0.5), 0.35))
    col = n.ramp(tone, [(0.15, dark), (0.85, light)])
    col = n.mix(n.math('MULTIPLY', n.math('LESS_THAN', pores, 0.38), 0.35), col, rgba(tuple(c * 0.45 for c in dark)))
    # the glue lines between staves, barely there
    edge = n.math('LESS_THAN', n.math('FRACT', n.math('DIVIDE', sep.outputs['Y'], stave)), 0.006)
    col = n.mix(n.math('MULTIPLY', edge, 0.25), col, rgba(tuple(c * 0.4 for c in dark)))
    wear = n.noise(co, 2.2, 3.0, 0.6)
    n.set(Base_Color=col, Roughness=n.math('ADD', n.math('MULTIPLY', pores, 0.18), n.math('ADD', n.math('MULTIPLY', wear, 0.16), rough - 0.17)),
          Coat_Weight=0.12, Coat_Roughness=0.25)
    n.bump(n.math('ADD', n.math('MULTIPLY', pores, 0.6), n.math('MULTIPLY', rings, 0.25)), 0.12, 0.0006)
    return n.mat


def dots(name, color, pitch, rough=0.35, metal=1.0):
    """A metal face drilled with a grid of fine holes (the speaker grilles)."""
    n = Nodes(name)
    g = n.node('ShaderNodeVectorMath', {0: n.mapping(n.coords(), (1 / pitch,) * 3)}, operation='FRACTION').outputs[0]
    d = n.node('ShaderNodeVectorMath', {0: g, 1: (0.5, 0.5, 0.0)}, operation='SUBTRACT').outputs[0]
    sep = n.node('ShaderNodeSeparateXYZ', {0: d})
    hole = n.math('LESS_THAN', n.math('ADD', n.math('POWER', sep.outputs[0], 2.0), n.math('POWER', sep.outputs[1], 2.0)), 0.085)
    n.set(Base_Color=n.mix(hole, rgba(color), (0.004, 0.004, 0.004, 1)), Metallic=n.math('SUBTRACT', 1.0, hole) if metal else 0.0,
          Roughness=rough)
    n.bump(n.math('SUBTRACT', 1.0, hole), 0.6, 0.0003)
    return n.mat


def screen(name, image=None, strength=1.0, rough=0.12):
    """A lit display: black glass that shows a picture as light."""
    n = Nodes(name)
    n.set(Base_Color=(0.004, 0.004, 0.005, 1), Roughness=rough)
    if image:
        tex = n.node('ShaderNodeTexImage', {'Vector': n.coords('UV')}, image=image, extension='EXTEND')
        n.set(Emission_Color=tex.outputs['Color'], Emission_Strength=strength)
    else:
        # the map's placeholder: clean dark navy, a little darker toward the corners
        d = n.node('ShaderNodeVectorMath', {0: n.coords('UV'), 1: (0.5, 0.5, 0)}, operation='DISTANCE').outputs['Value']
        n.set(Emission_Color=n.ramp(d, [(0.0, (0.020, 0.052, 0.165)), (0.75, (0.006, 0.016, 0.06))]), Emission_Strength=strength)
    return n.mat


def glass_pane():
    """Window glass that lets light and shadow straight through and mirrors the room faintly."""
    n = Nodes('window glass')
    fres = n.node('ShaderNodeFresnel', {'IOR': 1.5}).outputs[0]
    clear = n.node('ShaderNodeBsdfTransparent', {'Color': (0.93, 0.97, 0.96, 1)})
    shine = n.node('ShaderNodeBsdfGlossy', {'Roughness': 0.0})
    both = n.node('ShaderNodeMixShader', {0: n.math('MULTIPLY', fres, 1.6, clamp=True), 1: clear.outputs[0], 2: shine.outputs[0]})
    n.nt.links.new(both.outputs[0], n.out.inputs['Surface'])
    return n.mat


# the shared palette
M = {}


def materials():
    M['desk'] = wood('desk wood', (0.105, 0.052, 0.026), (0.36, 0.20, 0.105), stave=0.115, rough=0.42)
    M['floor'] = wood('floor wood', (0.10, 0.065, 0.04), (0.27, 0.185, 0.115), stave=0.14, along_y=True, rough=0.38, seed=3.1)
    M['steel'] = pbr('black steel', (0.012, 0.012, 0.013), 0.48, 0.0, grain=0.25, grain_scale=900)
    M['arm'] = pbr('arm powder coat', (0.016, 0.016, 0.018), 0.42, 0.0, grain=0.3, grain_scale=1200)
    M['arm plastic'] = pbr('arm plastic', (0.02, 0.02, 0.021), 0.55)
    M['chrome'] = pbr('bolt steel', (0.55, 0.55, 0.56), 0.22, 1.0)
    M['alu'] = pbr('aluminium', (0.74, 0.745, 0.76), 0.34, 1.0, grain=0.05, grain_scale=3000)
    M['alu pad'] = pbr('trackpad glass', (0.66, 0.665, 0.68), 0.26, 1.0)
    M['silver'] = pbr('samsung silver', (0.70, 0.71, 0.73), 0.30, 1.0, grain=0.04, grain_scale=2500)
    M['key'] = pbr('keycap', (0.022, 0.022, 0.024), 0.40)
    M['well'] = pbr('keyboard well', (0.006, 0.006, 0.007), 0.5)
    M['legend'] = pbr('key legend', (0.8, 0.8, 0.8), 0.5, Emission_Color=(0.85, 0.9, 1.0), Emission_Strength=0.5)
    M['black glass'] = pbr('black glass', (0.003, 0.003, 0.004), 0.06)
    M['rubber'] = pbr('rubber', (0.01, 0.01, 0.01), 0.75)
    M['dell'] = pbr('dell plastic', (0.018, 0.018, 0.02), 0.5, grain=0.35, grain_scale=1500)
    M['dell bezel'] = pbr('dell bezel', (0.012, 0.012, 0.013), 0.38)
    M['mat'] = pbr('desk mat', (0.011, 0.0115, 0.0135), 0.85, grain=0.5, grain_scale=2500, Sheen_Weight=0.12, Sheen_Roughness=0.5)
    M['wall'] = pbr('wall paint', (0.42, 0.39, 0.35), 0.9, grain=0.15, grain_scale=250)
    M['frame'] = pbr('window frame', (0.018, 0.018, 0.02), 0.42, 0.8)
    M['glass'] = glass_pane()
    M['cable'] = pbr('cable', (0.015, 0.015, 0.016), 0.55)
    M['brass'] = pbr('brass', (0.78, 0.56, 0.26), 0.28, 1.0, grain=0.04, grain_scale=1500)
    M['led'] = pbr('led', (1, 1, 1), 0.3, Emission_Color=(0.8, 0.9, 1.0), Emission_Strength=3.0)


# ---------------------------------------------------------------------------------------------
# The pictures on the screens, painted here with numpy and saved beside the renders.
# ---------------------------------------------------------------------------------------------

def paint_rr(img, x0, y0, x1, y1, r, col, a=1.0):
    """Paint an anti-aliased rounded rectangle (y counted from the top)."""
    H, W, _ = img.shape
    xa, xb, ya, yb = max(int(x0) - 1, 0), min(int(x1) + 2, W), max(int(y0) - 1, 0), min(int(y1) + 2, H)
    if xa >= xb or ya >= yb:
        return
    yy, xx = np.mgrid[ya:yb, xa:xb]
    r = min(r, (x1 - x0) / 2, (y1 - y0) / 2)
    dx = np.abs(xx + 0.5 - (x0 + x1) / 2) - ((x1 - x0) / 2 - r)
    dy = np.abs(yy + 0.5 - (y0 + y1) / 2) - ((y1 - y0) / 2 - r)
    dist = np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) + np.minimum(np.maximum(dx, dy), 0) - r
    m = (np.clip(0.5 - dist, 0, 1) * a)[..., None]
    img[ya:yb, xa:xb] = img[ya:yb, xa:xb] * (1 - m) + np.array(col, dtype=np.float32) * m


def wallpaper(w, h, rng):
    """A calm dark desktop picture: night sky fading to a dim glow over layered hills."""
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    top, mid, low = np.array((0.035, 0.045, 0.11)), np.array((0.13, 0.10, 0.22)), np.array((0.42, 0.24, 0.20))
    img = np.where(y < 0.55, top + (mid - top) * (y / 0.55), mid + (low - mid) * ((y - 0.55) / 0.45)) * np.ones((1, w, 1))
    img = img.astype(np.float32)
    for k, (base, amp, col) in enumerate([(0.62, 0.05, (0.10, 0.08, 0.17)), (0.72, 0.06, (0.065, 0.055, 0.12)),
                                          (0.83, 0.05, (0.04, 0.036, 0.08)), (0.93, 0.03, (0.022, 0.02, 0.045))]):
        ridge = base + amp * np.sin(x * (3.1 + k * 1.7) + rng.uniform(0, 6)) + amp * 0.4 * np.sin(x * (9 + k * 3) + rng.uniform(0, 6))
        m = np.clip((y - ridge) * h / 1.5, 0, 1)
        img = img * (1 - m) + np.array(col, dtype=np.float32) * m
    return img


def text_lines(img, x0, y0, x1, y1, rng, line_h, colors, indent=True):
    """Fake text: rows of small bars, like words seen from too far to read."""
    y = y0
    ind = 0
    while y + line_h < y1:
        if rng.random() < 0.12:
            y += line_h
            continue
        if indent:
            ind = max(0, min(4, ind + rng.choice((-1, 0, 0, 1))))
        x = x0 + ind * line_h * 1.6
        for _ in range(rng.randint(1, 6)):
            wd = rng.uniform(1.5, 7) * line_h
            if x + wd > x1:
                break
            paint_rr(img, x, y + line_h * 0.3, x + wd, y + line_h * 0.72, line_h * 0.2, rng.choice(colors), 0.85)
            x += wd + line_h * 0.7
        y += line_h


def window(img, x0, y0, x1, y1, s, body=(0.085, 0.09, 0.11)):
    """A dark app window with a title bar and the three round buttons."""
    paint_rr(img, x0 - 2 * s, y0 + 6 * s, x1 + 2 * s, y1 + 14 * s, 14 * s, (0, 0, 0), 0.35)
    paint_rr(img, x0, y0, x1, y1, 11 * s, body)
    paint_rr(img, x0, y0, x1, y0 + 30 * s, 11 * s, (0.13, 0.135, 0.155))
    paint_rr(img, x0, y0 + 16 * s, x1, y0 + 30 * s, 0, (0.13, 0.135, 0.155))
    for i, c in enumerate(((0.85, 0.35, 0.32), (0.86, 0.68, 0.26), (0.33, 0.72, 0.36))):
        paint_rr(img, x0 + (12 + i * 20) * s, y0 + 9 * s, x0 + (24 + i * 20) * s, y0 + 21 * s, 6 * s, c)


def menu_bar(img, s, bar_h, rng):
    h, w, _ = img.shape
    img[:int(bar_h)] = img[:int(bar_h)] * 0.45
    x = 22 * s
    for i in range(7):
        wd = (14 if i == 0 else rng.uniform(34, 60)) * s
        paint_rr(img, x, bar_h * 0.36, x + wd, bar_h * 0.66, 3 * s, (0.8, 0.8, 0.82), 0.8)
        x += wd + 18 * s
    x = w - 22 * s
    for i in range(6):
        wd = (70 if i == 0 else 16) * s
        paint_rr(img, x - wd, bar_h * 0.34, x, bar_h * 0.68, 3 * s, (0.8, 0.8, 0.82), 0.75)
        x -= wd + 16 * s


CODE = [(0.55, 0.6, 0.68), (0.55, 0.6, 0.68), (0.45, 0.62, 0.85), (0.78, 0.52, 0.42), (0.52, 0.72, 0.55), (0.72, 0.6, 0.82)]


def save_image(name, img):
    """Store a painted picture as a PNG and hand back the loaded image."""
    os.makedirs(TEX, exist_ok=True)
    h, w, _ = img.shape
    im = bpy.data.images.new(name, w, h, alpha=False)
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = np.clip(img[::-1], 0, 1)
    im.pixels.foreach_set(px.ravel())
    im.filepath_raw = os.path.join(TEX, name + '.png')
    im.file_format = 'PNG'
    im.save()
    return bpy.data.images.load(im.filepath_raw)


def laptop_picture():
    """The MacBook's desktop: wallpaper, menu bar around the notch, a terminal, the Dock."""
    rng = random.Random(11)
    w, h = 1512, 982
    img = wallpaper(w, h, rng)
    menu_bar(img, 1, 34, rng)
    window(img, 150, 150, 900, 640, 1)
    text_lines(img, 172, 196, 880, 628, rng, 15, [(0.62, 0.66, 0.7), (0.62, 0.66, 0.7), (0.45, 0.75, 0.55)], indent=False)
    window(img, 820, 300, 1380, 760, 1, body=(0.11, 0.11, 0.12))
    text_lines(img, 846, 350, 1356, 740, rng, 18, [(0.7, 0.7, 0.72), (0.55, 0.55, 0.58)], indent=False)
    icons = [(0.30, 0.55, 0.90), (0.90, 0.45, 0.30), (0.35, 0.75, 0.50), (0.85, 0.75, 0.35), (0.65, 0.45, 0.85),
             (0.30, 0.70, 0.80), (0.88, 0.40, 0.55), (0.55, 0.58, 0.62), (0.25, 0.35, 0.75), (0.75, 0.75, 0.78)]
    dw = len(icons) * 58 + 16
    paint_rr(img, w / 2 - dw / 2, h - 76, w / 2 + dw / 2, h - 10, 18, (0.3, 0.3, 0.36), 0.55)
    for i, c in enumerate(icons):
        x = w / 2 - dw / 2 + 13 + i * 58
        paint_rr(img, x, h - 67, x + 48, h - 19, 12, tuple(v * 0.8 for v in c))
    paint_rr(img, w / 2 - 92, -20, w / 2 + 92, 32, 10, (0, 0, 0))  # the notch
    mask = np.zeros((h, w, 3), dtype=np.float32)
    paint_rr(mask, 0, 0, w, h, 26, (1, 1, 1))  # the display's rounded corners
    return save_image('screen-laptop', img * mask)


def dell_picture():
    """The Dell's desktop: the same wallpaper with an editor and a notes window."""
    rng = random.Random(5)
    w, h = 2560, 1440
    img = wallpaper(w, h, rng)
    s = 1.6
    menu_bar(img, s, 26 * s, rng)
    window(img, 180, 130, 1640, 1290, s)
    paint_rr(img, 180, 130 + 30 * s, 470, 1290, 0, (0.07, 0.074, 0.09))
    paint_rr(img, 180, 1270, 470, 1290, 11 * s, (0.07, 0.074, 0.09))
    text_lines(img, 205, 200, 450, 1260, rng, 26, [(0.5, 0.52, 0.58)], indent=True)
    text_lines(img, 510, 200, 1600, 1260, rng, 27, CODE, indent=True)
    window(img, 1740, 250, 2400, 1000, s, body=(0.12, 0.115, 0.11))
    text_lines(img, 1775, 330, 2370, 980, rng, 30, [(0.75, 0.73, 0.68), (0.6, 0.58, 0.55)], indent=False)
    return save_image('screen-dell', img)


# ---------------------------------------------------------------------------------------------
# The desk: 2.0 m by 0.8 m, its top 0.74 m up; a solid wooden top on a black steel frame.
# ---------------------------------------------------------------------------------------------

def desk():
    root = empty('desk')
    # the top's cross-section (y, z): the front edge, toward the seat, is a full soft round
    t, y0, y1, r = 0.04, 0.05, 0.85, 0.014
    prof = [(y0 + 0.002, TOP - t), (y0, TOP - t + 0.002), (y0, TOP - 0.002), (y0 + 0.002, TOP)]
    for i in range(9):
        a = rad(90 - 90 * i / 8)
        prof.append((y1 - r + r * math.cos(a), TOP - r + r * math.sin(a)))
    for i in range(7):
        a = rad(-90 * i / 6)
        prof.append((y1 - 0.008 + 0.008 * math.cos(a), TOP - t + 0.008 + 0.008 * math.sin(a)))
    bm = bmesh.new()
    rings = []
    for x, inset in ((-1.0, 0.003), (-0.997, 0.0), (0.997, 0.0), (1.0, 0.003)):
        cy, cz = (y0 + y1) / 2, TOP - t / 2
        rings.append([bm.verts.new((x, y + (cy - y) * inset / 0.4, z + (cz - z) * inset / 0.02)) for y, z in prof])
    for a, b in zip(rings, rings[1:]):
        for i in range(len(prof)):
            bm.faces.new((a[i], a[(i + 1) % len(prof)], b[(i + 1) % len(prof)], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    obj_from_bm('desk top', bm, M['desk'], parent=root, sharp=40)
    # the frame: a sled leg at each end, a rail under the back to stop racking
    for x in (-0.88, 0.88):
        for y in (0.13, 0.77):
            box('desk leg', (0.06, 0.03, TOP - t - 0.03), (x, y, (TOP - t + 0.03) / 2), M['steel'], parent=root, bevel=0.003)
            cyl('desk foot', 0.016, 0.006, (x, y, 0.003), M['rubber'], parent=root)
        box('desk sled', (0.06, 0.72, 0.03), (x, 0.45, 0.021), M['steel'], parent=root, bevel=0.003)
        box('desk bearer', (0.06, 0.70, 0.03), (x, 0.45, TOP - t - 0.015), M['steel'], parent=root, bevel=0.003)
    box('desk rail', (1.70, 0.03, 0.06), (0, 0.22, TOP - t - 0.045), M['steel'], parent=root, bevel=0.003)
    # the dark mat the laptop sits on
    slab('desk mat', 0.80, 0.36, MAT_H, 0.012, M['mat'], at=(0, 0.62, TOP), parent=root, rt=0.001)
    return root


# ---------------------------------------------------------------------------------------------
# MacBook Pro 14: 312.6 by 221.2 by 15.5 mm, silver, open about 110 degrees.
# Built in the sitter's own frame (x to their right, y away from them), then turned to face the seat.
# ---------------------------------------------------------------------------------------------

LW, LD = 0.3126, 0.2212
FOOT, BASE_H = 0.0012, 0.0113
LZ = FOOT + BASE_H  # the height of the palm rest above the mat
LAPTOP_AT = Vector((0.0, 0.60, TOP + MAT_H))


def lap(p):
    """A point in the laptop's own frame, as a point in the room."""
    return LAPTOP_AT + Vector((-p[0], -p[1], p[2]))


def text_mesh(name, items, mat, parent):
    """Flat lettering: items are (text, x, y, z, size). One mesh for all of it."""
    objs = []
    for t, x, y, z, s in items:
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body, cu.size, cu.align_x, cu.align_y = t, s, 'CENTER', 'CENTER'
        o = bpy.data.objects.new('t', cu)
        COLL.objects.link(o)
        o.location = (x, y, z)
        objs.append(o)
    dg = bpy.context.evaluated_depsgraph_get()
    bm = bmesh.new()
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(Matrix.Translation(o.location))
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    for o in objs:
        cu = o.data
        bpy.data.objects.remove(o)
        bpy.data.curves.remove(cu)
    return obj_from_bm(name, bm, mat, parent=parent, smooth=False)


def macbook():
    root = empty('macbook', LAPTOP_AT, (0, 0, math.pi))
    well_w, well_d, well_drop = 0.2775, 0.1165, 0.0010
    well_y = LD / 2 - 0.0145 - well_d / 2
    pad_w, pad_d = 0.130, 0.0815
    pad_y = -LD / 2 + 0.0062 + pad_d / 2

    # the unibody: flat sides, a soft lower edge, a crisp upper edge
    base = slab('macbook base', LW, LD, BASE_H, 0.0105, M['alu'], at=(0, 0, FOOT), parent=root, rb=0.003, rt=0.0005, seg=8)
    # cut the keyboard well, the trackpad's seat and the thumb scoop out of it
    bm = bmesh.new()
    loft_into(bm, well_w, well_d, 0.003, [(0, 0), (0, 0.01)], 5, off=(0, well_y, FOOT + BASE_H - well_drop))
    loft_into(bm, pad_w + 0.0006, pad_d + 0.0006, 0.0045, [(0, 0), (0, 0.01)], 5, off=(0, pad_y, FOOT + BASE_H - 0.0006))
    loft_into(bm, 0.075, 0.009, 0.004, [(0, 0), (0, 0.01)], 5, off=(0, -LD / 2, FOOT + BASE_H - 0.0016))
    cutter = obj_from_bm('macbook cutter', bm, None, parent=root, smooth=False)
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    cut = base.modifiers.new('cut', 'BOOLEAN')
    cut.object, cut.operation, cut.solver = cutter, 'DIFFERENCE', 'EXACT'
    base.modifiers.move(len(base.modifiers) - 1, 0)  # cut first, then smooth the normals

    slab('macbook well', well_w - 0.0002, well_d - 0.0002, 0.0001, 0.003, M['well'], at=(0, well_y, LZ - well_drop), parent=root)
    slab('macbook trackpad', pad_w, pad_d, 0.00055, 0.0042, M['alu pad'], at=(0, pad_y, LZ - 0.0006), parent=root, rt=0.00012)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl('macbook foot', 0.007, FOOT + 0.0004, (sx * 0.135, sy * 0.090, FOOT / 2 + 0.0002), M['rubber'], parent=root, bevel=0.0005)
        # the speaker grilles beside the keys
        slab('macbook grille', 0.0085, 0.104, 0.00006, 0.002, M['grille'], at=(sx * (well_w / 2 + 0.0088), well_y, LZ), parent=root)

    # the keys: one mesh, each cap a small rounded tile; then their legends, lit from below
    u, gap, cap_h = 0.019, 0.0028, well_drop - 0.00015
    rows = [
        [('esc', 1.5)] + [(f'F{i}', 1) for i in range(1, 13)] + [('', 1)],  # the last is Touch ID
        [(c, 1) for c in '`1234567890-='] + [('delete', 1.5)],
        [('tab', 1.5)] + [(c, 1) for c in 'QWERTYUIOP[]\\'],
        [('caps lock', 1.75)] + [(c, 1) for c in "ASDFGHJKL;'"] + [('return', 1.75)],
        [('shift', 2.25)] + [(c, 1) for c in 'ZXCVBNM,./'] + [('shift', 2.25)],
        [('fn', 1), ('control', 1), ('option', 1), ('command', 1.25), ('', 5), ('command', 1.25), ('option', 1)],
    ]
    keys = bmesh.new()
    legends = []
    x_left = -14.5 * u / 2
    row_y = lambda r: well_y + well_d / 2 - 0.00125 - u / 2 - r * u
    key_z = LZ - well_drop

    def key(cx, cy, w, d):
        loft_into(keys, w, d, 0.0016, [(0, 0), (0, cap_h - 0.0002), (0.00008, cap_h - 0.00006), (0.00025, cap_h)], 4, off=(cx, cy, key_z))

    for r, row in enumerate(rows):
        x = x_left
        for label, wu in row:
            cx = x + wu * u / 2
            key(cx, row_y(r), wu * u - gap, u - gap)
            if label:
                small = len(label) > 1
                legends.append((label, cx, row_y(r) - (0.0035 if small and r else 0), key_z + cap_h + 0.00002,
                                0.0021 if small else 0.0046))
            x += wu * u
    half = (u - gap) / 2 - 0.0004
    for col, up in ((11.5, False), (12.5, True), (12.5, False), (13.5, False)):  # the arrow keys
        cx = x_left + (col + 0.5) * u
        key(cx, row_y(5) + (1 if up else -1) * (half / 2 + 0.0004), u - gap, half)
    obj_from_bm('macbook keys', keys, M['key'], parent=root)
    text_mesh('macbook legends', legends, M['legend'], root)
    # Touch ID: a matt disc on the last key of the top row
    cyl('macbook touch id', 0.0058, 0.00005, (x_left + 14 * u, row_y(0), key_z + cap_h + 0.00003), M['well'], parent=root)

    # the ports: MagSafe, two USB-C and the headphone jack on the left; HDMI, USB-C and the card slot on the right
    for x, y, w, h in ((-1, 0.094, 0.0165, 0.0030), (-1, 0.072, 0.0086, 0.0027), (-1, 0.057, 0.0086, 0.0027),
                       (1, 0.094, 0.0150, 0.0048), (1, 0.074, 0.0086, 0.0027), (1, 0.050, 0.0240, 0.0024)):
        slab('macbook port', w, h, 0.0003, h / 2, M['well'], at=(x * (LW / 2 + 0.0001), y, FOOT + 0.0068),
             rot=(rad(90), 0, rad(90) * x), parent=root)
    cyl('macbook jack', 0.0018, 0.0003, (-LW / 2 - 0.0001, 0.040, FOOT + 0.0068), M['well'], rot=(0, rad(90), 0), parent=root)

    # the hinge and the lid, leaning back 20 degrees past upright (open about 110)
    hinge = empty('macbook lid', (0, LD / 2 - 0.0035, LZ + 0.0010), (rad(-20), 0, 0), root)
    cyl('macbook hinge', 0.0042, 0.262, (0, 0, 0), M['well'], rot=(0, rad(90), 0), parent=hinge, bevel=0.0008)
    up = (rad(-90), 0, 0)  # stand a plate upright, its underside toward the sitter
    zc = LD / 2 + 0.0012
    slab('macbook lid shell', LW, LD, 0.0040, 0.0105, M['alu'], at=(0, 0, zc), rot=up, parent=hinge, rb=0.0005, rt=0.0016, seg=8)
    slab('macbook display glass', LW - 0.003, LD - 0.003, 0.0003, 0.0092, M['black glass'], at=(0, -0.0003, zc), rot=up, parent=hinge, seg=8)
    picture_plane('macbook picture', 0.3024, 0.1964, M['screen laptop'], at=(0, -0.00036, zc + LD / 2 - 0.0036 - 0.0982), parent=hinge)
    cyl('macbook camera', 0.0013, 0.0001, (0, -0.0004, zc + LD / 2 - 0.0062), M['black glass'], rot=(rad(90), 0, 0), parent=hinge)
    return root


# ---------------------------------------------------------------------------------------------
# The monitors, each built in its own frame (screen toward -y, the back toward +y) and then
# turned to face the seat, toed in a little. Each returns where its arm must reach.
# ---------------------------------------------------------------------------------------------

UP = (rad(-90), 0, 0)
LIFT = 0.198  # the monitors' lower edges above the desk: on the laptop lid's upper edge, seen from the seat


def monitor_root(name, x, yaw):
    at = Vector((x, 0.26, TOP))
    root = empty(name, at, (0, 0, math.pi + yaw))
    return root, Matrix.Translation(at) @ Matrix.Rotation(math.pi + yaw, 4, 'Z')


def vesa_head(root, yb, zc):
    """What joins a monitor to its arm: the VESA plate with four screws, a tilt joint, a neck
    and a swivel pin. Returns the swivel's centre."""
    slab('vesa plate', 0.118, 0.118, 0.004, 0.012, M['arm'], at=(0, yb, zc), rot=UP, parent=root, rt=0.001)
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl('vesa screw', 0.0042, 0.003, (sx * 0.05, yb + 0.0052, zc + sz * 0.05), M['chrome'], rot=(rad(90), 0, 0), parent=root, bevel=0.0008, seg=6)
        box('tilt cheek', (0.006, 0.034, 0.05), (sx * 0.027, yb + 0.019, zc), M['arm'], parent=root, bevel=0.002)
        cyl('tilt bolt', 0.007, 0.004, (sx * 0.0315, yb + 0.022, zc), M['chrome'], rot=(0, rad(90), 0), parent=root, bevel=0.001, seg=6)
    cyl('tilt barrel', 0.014, 0.048, (0, yb + 0.022, zc), M['arm'], rot=(0, rad(90), 0), parent=root, bevel=0.002)
    box('head neck', (0.03, 0.03, 0.034), (0, yb + 0.042, zc), M['arm'], parent=root, bevel=0.004)
    cyl('swivel pin', 0.019, 0.060, (0, yb + 0.064, zc), M['arm'], parent=root, bevel=0.003)
    cyl('swivel cap', 0.012, 0.004, (0, yb + 0.064, zc + 0.031), M['arm plastic'], parent=root, bevel=0.001)
    return Vector((0, yb + 0.064, zc))


def samsung():
    """Samsung Odyssey OLED G8 (G80SD), 32 in, 714 by 412 mm: a very thin silver slab with the
    electronics in a shallow hump behind, a ring round the mount, a matt screen to the edge."""
    w, h = 0.714, 0.412
    root, mw = monitor_root('samsung g80sd', 0.37, rad(7))
    zc = LIFT + h / 2
    slab('samsung shell', w, h, 0.0058, 0.004, M['silver'], at=(0, 0, zc), rot=UP, parent=root, rb=0.0006, rt=0.0022)
    slab('samsung glass', w - 0.002, h - 0.002, 0.0004, 0.0032, M['oled glass'], at=(0, -0.0004, zc), rot=UP, parent=root)
    picture_plane('samsung picture', 0.697, 0.392, M['screen map'], at=(0, -0.00046, zc + 0.003), parent=root)
    slab('samsung hump', 0.40, 0.24, 0.020, 0.04, M['silver'], at=(0, 0.0058, zc), rot=UP, parent=root, rt=0.012, n=5, seg=10)
    lathe('samsung ring', [(0.066, 0), (0.066, 0.0025), (0.069, 0.004), (0.080, 0.004), (0.083, 0.0025), (0.083, 0)],
          M['black glass'], at=(0, 0.0258, zc), rot=UP, parent=root, seg=64)
    box('samsung ports', (0.22, 0.012, 0.006), (0, 0.0145, zc - 0.121), M['dell bezel'], parent=root, bevel=0.002)
    box('samsung nub', (0.026, 0.008, 0.005), (0, 0.004, zc - h / 2 - 0.002), M['dell bezel'], parent=root, bevel=0.0015)
    return root, mw, vesa_head(root, 0.0258, zc), Vector((0.06, 0.016, zc - 0.124))


def dell():
    """Dell 27 (612 by 356 mm): a plain dark office monitor, thicker, with a plastic chin."""
    w, h = 0.612, 0.356
    root, mw = monitor_root('dell 27', -0.335, rad(-7))
    zc = LIFT + h / 2
    slab('dell frame', w, h, 0.012, 0.003, M['dell bezel'], at=(0, 0, zc), rot=UP, parent=root, rb=0.0008, rt=0.003)
    slab('dell glass', w - 0.003, h - 0.0155, 0.0004, 0.002, M['matte glass'], at=(0, -0.0004, zc + 0.0063), rot=UP, parent=root)
    picture_plane('dell picture', 0.597, 0.336, M['screen dell'], at=(0, -0.00046, zc + h / 2 - 0.0065 - 0.168), parent=root)
    cyl('dell led', 0.0009, 0.0002, (0.275, -0.0001, zc - h / 2 + 0.0065), M['led'], rot=(rad(90), 0, 0), parent=root)
    for i in range(5):
        box('dell button', (0.008, 0.004, 0.0015), (0.20 + i * 0.016, 0.006, zc - h / 2 - 0.0005), M['dell bezel'], parent=root, bevel=0.0005)
    slab('dell back', 0.575, 0.325, 0.012, 0.03, M['dell'], at=(0, 0.012, zc), rot=UP, parent=root, rt=0.008, n=4, seg=8)
    slab('dell bulge', 0.40, 0.25, 0.020, 0.05, M['dell'], at=(0, 0.024, zc - 0.01), rot=UP, parent=root, rt=0.012, n=5, seg=10)
    slab('dell vents', 0.30, 0.010, 0.0002, 0.003, M['vents'], at=(0, 0.024, zc + 0.135), rot=UP, parent=root)
    box('dell ports', (0.20, 0.012, 0.008), (0, 0.030, zc - 0.137), M['dell bezel'], parent=root, bevel=0.002)
    slab('dell mount', 0.11, 0.11, 0.0015, 0.006, M['dell bezel'], at=(0, 0.044, zc - 0.0), rot=UP, parent=root)
    return root, mw, vesa_head(root, 0.0455, zc), Vector((-0.05, 0.03, zc - 0.142))


# ---------------------------------------------------------------------------------------------
# The dual monitor arm (North Bayou's kind): a C-clamp on the middle of the desk's back edge, one
# post, and for each monitor a level arm from a collar on the post, an elbow, and a gas-spring
# arm up to the monitor's swivel pin. Cables are clipped under the arms and drop behind the desk.
# ---------------------------------------------------------------------------------------------

def monitor_arm(mounts):
    root = empty('monitor arm')
    A, P = M['arm'], Vector((0.0, 0.07, TOP))
    edge = 0.05  # the desk's back edge
    # the clamp: a plate on the desk, a spine down behind the edge, a jaw below with its screw
    slab('clamp plate', 0.10, 0.095, 0.008, 0.008, A, at=(0, edge + 0.045, TOP), parent=root, rt=0.002)
    box('clamp spine', (0.07, 0.008, 0.118), (0, edge - 0.006, TOP - 0.051), A, parent=root, bevel=0.002)
    slab('clamp jaw', 0.07, 0.07, 0.008, 0.006, A, at=(0, edge + 0.027, TOP - 0.110), parent=root, rb=0.002)
    cyl('clamp screw', 0.005, 0.085, (0, edge + 0.035, TOP - 0.087), M['chrome'], parent=root)
    cyl('clamp pad', 0.019, 0.005, (0, edge + 0.035, TOP - 0.0425), A, parent=root, bevel=0.001)
    cyl('clamp handle', 0.0035, 0.06, (0, edge + 0.035, TOP - 0.128), M['chrome'], rot=(0, rad(90), 0), parent=root, bevel=0.001)
    for sx in (-1, 1):
        cyl('clamp bolt', 0.005, 0.003, (sx * 0.036, edge + 0.075, TOP + 0.009), M['chrome'], parent=root, bevel=0.001, seg=6)
    # the post
    cyl('post foot', 0.029, 0.022, P + Vector((0, 0, 0.019)), A, parent=root, bevel=0.004)
    cyl('post', 0.0175, 0.46, P + Vector((0, 0, 0.238)), M['post'], parent=root, bevel=0.002, seg=48)
    cyl('post cap', 0.0185, 0.008, P + Vector((0, 0, 0.47)), M['arm plastic'], parent=root, bevel=0.003)
    cable_pts = []
    for n, (mount, port, side) in enumerate(mounts):
        zc = TOP + 0.28 + n * 0.055
        C = Vector((P.x, P.y, zc))
        E = Vector((mount.x * 0.5, 0.048, zc))
        # the collar on the post, with its split and pinch bolt, and a stop ring under it
        cyl('arm collar', 0.031, 0.05, C, A, parent=root, bevel=0.004)
        cyl('arm stop', 0.026, 0.012, C - Vector((0, 0, 0.033)), A, parent=root, bevel=0.002)
        cyl('arm stop bolt', 0.004, 0.012, C + Vector((0, 0.03, -0.033)), M['chrome'], rot=(rad(90), 0, 0), parent=root, seg=6)
        # the level arm: a flat bar with round ends
        d = E - C
        slab('arm level', d.length + 0.056, 0.056, 0.026, 0.028, A, at=(C + E) / 2 - Vector((0, 0, 0.013)),
             rot=(0, 0, math.atan2(d.y, d.x)), parent=root, rb=0.003, rt=0.003, seg=10)
        # the elbow: a turret the sprung arm turns on
        cyl('arm elbow', 0.026, 0.034, E + Vector((0, 0, 0.030)), A, parent=root, bevel=0.004)
        cyl('arm elbow cap', 0.014, 0.004, E - Vector((0, 0, 0.015)), M['arm plastic'], parent=root, bevel=0.001)
        # the gas-spring arm from the elbow up to the monitor's swivel pin
        a0 = E + Vector((0, 0, 0.062))
        b0 = mount.copy()
        run = b0 - a0
        across = Vector((run.y, -run.x, 0)).normalized()  # level, square to the arm
        upward = run.cross(across).normalized()
        if upward.z < 0:
            upward = -upward
        turn = math.atan2(across.y, across.x)
        beam('arm spring', a0, b0, (0.046, 0.036), A, parent=root, bevel=0.006)
        beam('arm spring cover', a0 + run * 0.14 + upward * 0.019, a0 + run * 0.86 + upward * 0.019, (0.030, 0.006), M['arm plastic'], parent=root, bevel=0.002)
        for p, r in ((a0, 0.027), (b0, 0.025)):
            cyl('arm knuckle', r, 0.058, p, A, rot=(0, rad(90), turn), parent=root, bevel=0.004)
            for s in (-1, 1):
                cyl('arm pivot bolt', 0.007, 0.004, p + across * s * 0.030, M['chrome'], rot=(0, rad(90), turn), parent=root, bevel=0.001, seg=6)
        cyl('arm elbow neck', 0.02, 0.03, E + Vector((0, 0, 0.05)), A, parent=root)
        # the tension screw at the lower knuckle, and two cable clips under the arm
        cyl('arm tension', 0.006, 0.006, a0 + run * 0.1 + upward * 0.020, M['chrome'], parent=root, seg=6)
        for t in (0.3, 0.7):
            box('arm clip', (0.03, 0.012, 0.03), a0 + run * t - upward * 0.022, M['arm plastic'], parent=root, bevel=0.003).rotation_euler = \
                run.to_track_quat('Z', 'Y').to_euler()
        for t in (0.35, 0.7):
            box('arm clip', (0.022, 0.03, 0.012), C + d * t - Vector((0, 0, 0.031)), M['arm plastic'], rot=(0, 0, math.atan2(d.y, d.x)), parent=root, bevel=0.003)
        # the monitor's power cable: out of its ports, under the sprung arm, under the level arm, down the post
        dn = Vector((0, 0, -1))
        off = Vector((0, -0.012 * (1 if n else -1), 0))
        cable_pts.append([port, port + Vector((0, -0.02, -0.05)), b0 - upward * 0.03 + Vector((0, 0, -0.03)),
                          a0 + run * 0.7 - upward * 0.027, a0 + run * 0.3 - upward * 0.027, a0 + dn * 0.05 + run * 0.02,
                          E + dn * 0.036 + (C - E) * 0.25, C - d * 0.3 + dn * 0.036, C + dn * 0.07 + Vector((side * 0.02, -0.022, 0)),
                          Vector((side * 0.012, edge - 0.016, TOP + 0.05)), Vector((side * 0.02, edge - 0.02, TOP - 0.2)),
                          Vector((side * 0.05, edge - 0.015, 0.25)), Vector((side * 0.10, 0.03, 0.012)), Vector((side * 0.5, 0.06, 0.006))])
    for pts in cable_pts:
        tube('monitor power cable', pts, 0.0032, M['cable'], parent=root)
    return root


# ---------------------------------------------------------------------------------------------
# The room: a bedroom kept quiet and dark. Behind the desk the wall is glass from floor to
# ceiling in three panes with slim dark frames, the middle one a sliding door.
# ---------------------------------------------------------------------------------------------

def room():
    root = empty('room')
    box('floor', (4.7, 4.2, 0.05), (0, 2.0, -0.025), M['floor'], parent=root)
    box('ceiling', (4.7, 4.2, 0.05), (0, 2.0, 2.725), M['ceiling'], parent=root)
    for x in (-2.35, 2.35):
        box('side wall', (0.1, 4.2, 2.7), (x, 2.0, 1.35), M['wall'], parent=root)
        box('skirting', (0.012, 4.1, 0.09), (x * 0.976, 2.0, 0.045), M['skirting'], parent=root, bevel=0.003)
    box('back wall', (4.7, 0.1, 2.7), (0, 4.1, 1.35), M['wall'], parent=root)
    box('skirting', (4.6, 0.012, 0.09), (0, 4.044, 0.045), M['skirting'], parent=root, bevel=0.003)

    F = M['frame']
    # the glass: one sheet, so the room is mirrored in it once, faintly
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(p) for p in ((-2.3, -0.05, 0), (2.3, -0.05, 0), (2.3, -0.05, 2.7), (-2.3, -0.05, 2.7))])
    obj_from_bm('window glass', bm, M['glass'], parent=root, smooth=False)
    # the outer frame, a head and a sill track
    for x in (-2.275, 2.275):
        box('window jamb', (0.05, 0.11, 2.7), (x, -0.05, 1.35), F, parent=root, bevel=0.002)
    box('window head', (4.6, 0.11, 0.05), (0, -0.05, 2.675), F, parent=root, bevel=0.002)
    box('window sill', (4.6, 0.12, 0.022), (0, -0.05, 0.011), F, parent=root, bevel=0.002)
    for y in (-0.075, -0.025):
        box('window track', (4.5, 0.006, 0.012), (0, y, 0.026), F, parent=root)
    # the stiles where the panes meet: the side panes sit on the outer track, the door on the inner
    for x, s in ((0.77, 1), (-0.77, -1)):
        box('pane stile', (0.045, 0.04, 2.62), (x + s * 0.02, -0.072, 1.34), F, parent=root, bevel=0.003)
        box('door stile', (0.045, 0.04, 2.62), (x - s * 0.02, -0.028, 1.34), F, parent=root, bevel=0.003)
    for x, w, y in ((0, 1.56, -0.028), (1.52, 1.5, -0.072), (-1.52, 1.5, -0.072)):
        box('pane rail', (w, 0.04, 0.04), (x, y, 0.045), F, parent=root, bevel=0.003)
        box('pane rail', (w, 0.04, 0.04), (x, y, 2.63), F, parent=root, bevel=0.003)
    # linen curtains drawn back to each side, on a slim track
    box('curtain track', (4.5, 0.02, 0.015), (0, 0.085, 2.69), M['skirting'], parent=root)
    for x0, x1, seed in ((1.14, 1.62, 1), (-1.62, -1.14, 2)):
        rng = random.Random(seed)
        bm = bmesh.new()
        nx, nz, folds = 140, 10, 9
        ph = [rng.uniform(0, 6.28) for _ in range(3)]
        grid = []
        for j in range(nz + 1):
            z = 0.03 + (2.65 - 0.03) * j / nz
            loose = 1.0 + 0.35 * (1 - j / nz)  # the folds open a little toward the floor
            row = []
            for i in range(nx + 1):
                t = i / nx
                a = 2 * math.pi * folds * t
                y = 0.085 + 0.028 * loose * math.sin(a + 0.5 * math.sin(3 * t + ph[0])) + 0.008 * math.sin(a * 2.3 + ph[1] + j * 0.2)
                row.append(bm.verts.new((x0 + (x1 - x0) * t + 0.006 * math.sin(j * 0.7 + ph[2] + 9 * t), y, z)))
            grid.append(row)
        for a, b in zip(grid, grid[1:]):
            for i in range(nx):
                bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
        obj_from_bm('curtain', bm, M['linen'], parent=root, sharp=180)
    # the door's pull: a slim bar on standoffs
    hx = 0.75
    box('door pull', (0.012, 0.012, 0.32), (hx, 0.012, 1.05), M['chrome'], parent=root, bevel=0.004)
    for z in (0.93, 1.17):
        cyl('door pull post', 0.005, 0.03, (hx, -0.002, z), M['chrome'], rot=(rad(90), 0, 0), parent=root)
    return root


# ---------------------------------------------------------------------------------------------
# Outside: a deck at the door, a lawn, a hedge, a few roofs with lit windows far off, and
# close to the glass the one big tree.
# ---------------------------------------------------------------------------------------------

def outside():
    root = empty('outside')
    rng = random.Random(21)
    box('deck', (9, 1.9, 0.04), (0, -1.07, -0.05), M['deck'], parent=root, bevel=0.003)
    box('deck skirt', (9, 0.03, 0.25), (0, -2.0, -0.17), M['deck'], parent=root)
    box('lawn', (90, 60, 0.05), (0, -30, -0.30), M['lawn'], parent=root)
    # a hedge along the end of the garden: a dark core clothed in leaves
    box('hedge core', (44, 0.9, 1.5), (0, -12.1, 0.45), M['hedge'], parent=root)
    P, A, S, N, SZ, RND = [], [], [], [], [], []
    for _ in range(45000):
        top = rng.random() < 0.35
        x = rng.uniform(-22, 22)
        p = Vector((x, -12.1 + rng.uniform(-0.45, 0.5), 1.2 + rng.uniform(-0.05, 0.12) + 0.06 * math.sin(x * 1.3))) if top else \
            Vector((x, -11.65 + rng.uniform(-0.05, 0.1), rng.uniform(-0.3, 1.25)))
        d = Vector((rng.gauss(0, 1), rng.gauss(0, 1) + 0.6, rng.gauss(0, 1) + 0.3)).normalized()
        up = Vector((rng.gauss(0, 0.6), rng.gauss(0, 0.6), 1)).normalized()
        side = d.cross(up).normalized()
        P.append(p), A.append(d), S.append(side), N.append(side.cross(d)), SZ.append(rng.uniform(0.11, 0.17)), RND.append(rng.random() * 0.6)
    leaf_cloud('hedge leaves', P, A, S, N, SZ, RND, M['leaf'], root)
    # the neighbours: low houses, their roofs against the sky, a window or two lit
    for x, w, h, lit in ((-27, 10, 3.2, (1,)), (-7, 11, 2.9, (0, 2)), (12, 9, 3.4, (1,)), (30, 10, 3.0, (2,))):
        y = -50 + rng.uniform(-3, 3)
        box('house', (w, 7, h), (x, y, h / 2 - 0.3), M['house'], parent=root)
        bm = bmesh.new()
        e = 0.5
        vs = [bm.verts.new(p) for p in ((-w / 2 - e, -4, 0), (w / 2 + e, -4, 0), (w / 2 + e, 4, 0), (-w / 2 - e, 4, 0),
                                        (-w / 2 - e, 0, 2.1), (w / 2 + e, 0, 2.1))]
        for f in ((0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (0, 3, 2, 1)):
            bm.faces.new([vs[i] for i in f])
        obj_from_bm('roof', bm, M['roof'], at=(x, y, h - 0.3), parent=root, smooth=False)
        for k in range(3):
            wx = x + (k - 1) * w * 0.3
            box('house window', (0.9, 0.05, 1.1), (wx, y + 3.52, h * 0.5 + 0.2), M['window lit' if k in lit else 'window dark'], parent=root)
    return root


FAR = {}  # the big tree's meshes, shown again far off as other trees
TREE_AT = Vector((-0.9, -3.2, -0.28))


def leaf_cloud(name, P, A, S, N, SZ, RND, mat, parent):
    """Many leaves as one mesh. For each leaf: where its stalk is (P), which way it points (A),
    its sideways (S) and upward (N) directions, its length (SZ) and a random number for its colour."""
    n = len(P)
    P, A, S, N = (np.array([tuple(v) for v in L], dtype=np.float32) for L in (P, A, S, N))
    SZ, RND = np.array(SZ, dtype=np.float32), np.array(RND, dtype=np.float32)
    # one leaf: base, two points on the midrib, tip, then two points on each edge, lifted into a shallow fold
    shape = np.array([(0, 0, 0), (0.33, 0, 0), (0.68, 0, -0.02), (1, 0, -0.08), (0.30, 0.30, 0.07), (0.66, 0.25, 0.05),
                      (0.30, -0.30, 0.07), (0.66, -0.25, 0.05)], dtype=np.float32)
    V = (P[:, None, :] + SZ[:, None, None] * (shape[None, :, 0:1] * A[:, None, :] + shape[None, :, 1:2] * S[:, None, :] + shape[None, :, 2:3] * N[:, None, :]))
    faces = [(0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (0, 6, 1), (1, 6, 7, 2), (2, 7, 3)]
    corner = np.array([i for f in faces for i in f], dtype=np.int32)
    starts = np.cumsum([0] + [len(f) for f in faces[:-1]]).astype(np.int32)
    me = bpy.data.meshes.new(name)
    me.vertices.add(n * 8)
    me.vertices.foreach_set('co', V.reshape(-1))
    me.loops.add(n * len(corner))
    me.loops.foreach_set('vertex_index', (corner[None, :] + (np.arange(n, dtype=np.int32) * 8)[:, None]).reshape(-1))
    me.polygons.add(n * len(faces))
    me.polygons.foreach_set('loop_start', (starts[None, :] + (np.arange(n, dtype=np.int32) * len(corner))[:, None]).reshape(-1))
    # the map carries, for the leaf material, a random number per leaf (u) and how far along the leaf (v)
    uv = np.zeros((n, len(corner), 2), dtype=np.float32)
    uv[:, :, 0] = RND[:, None]
    uv[:, :, 1] = shape[corner, 0][None, :]
    me.uv_layers.new(name='UVMap').data.foreach_set('uv', uv.reshape(-1))
    me.update(calc_edges=True)
    me.validate()
    me.shade_smooth()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    o.parent = parent
    return o


def tree(base=TREE_AT, seed=5):
    """One big deciduous tree, grown branch by branch: a trunk that leans a little, low spreading
    boughs, each forking again and again down to twigs that droop; then leaves on every twig."""
    rng = random.Random(seed)
    root = empty('tree')
    bm = bmesh.new()
    twigs = []
    LEN = [2.2, 2.2, 1.6, 1.15, 0.8, 0.55, 0.4]
    BEND = [0.03, 0.09, 0.14, 0.18, 0.22, 0.25, 0.3]
    RISE = [0.0, 0.11, 0.06, 0.02, -0.03, -0.08, -0.14]  # thick wood reaches up, thin wood hangs

    def gauss3():
        return Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))

    def fork(d, degrees):
        axis = Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, d) @ d.orthogonal().normalized()
        return (Matrix.Rotation(rad(degrees), 3, axis) @ d).normalized()

    def skin(path):
        """Wrap a tube round a branch's centre line."""
        r0 = path[0][1]
        sides = 14 if r0 > 0.12 else 9 if r0 > 0.05 else 6 if r0 > 0.02 else 4
        u, prev = None, None
        for i, (p, r) in enumerate(path):
            t = (path[min(i + 1, len(path) - 1)][0] - path[max(i - 1, 0)][0]).normalized()
            u = t.orthogonal().normalized() if u is None else (u - t * u.dot(t)).normalized()
            v = t.cross(u)
            ring = [bm.verts.new(p + (u * math.cos(2 * math.pi * k / sides) + v * math.sin(2 * math.pi * k / sides)) * r)
                    for k in range(sides)]
            if prev:
                for k in range(sides):
                    bm.faces.new((prev[k], prev[(k + 1) % sides], ring[(k + 1) % sides], ring[k]))
            prev = ring
        bm.faces.new(prev)

    def grow(pos, d, r, level, forks=True):
        L = LEN[level] * rng.uniform(0.8, 1.2)
        n = max(3, round(L / (0.3 if level < 2 else 0.17)))
        path = [(pos.copy(), r * (1.7 if level == 0 else 1.0))]
        r_end = r * 0.7
        for i in range(n):
            d = (d + gauss3() * BEND[level] + Vector((0, 0, RISE[level]))).normalized()
            if pos.y > -1.9:  # the house is in the way: wood near the glass turns aside, as a pruned tree's does
                d = (d + Vector((0, -0.5 * (pos.y + 1.9) - 0.15, 0))).normalized()
            pos = pos + d * (L / n)
            if pos.y > -1.0:
                break
            rr = r + (r_end - r) * (i + 1) / n
            if level == 0 and i == 0:
                rr = r * 1.15  # the flare at the root
            path.append((pos.copy(), rr))
            if level >= 1 and 1 <= i < n - 1 and rr > 0.011 and rng.random() < 0.5:
                grow(pos, fork(d, rng.uniform(40, 75)), rr * rng.uniform(0.45, 0.6), level + 1)
        skin(path)
        if level >= 4:
            twigs.append(path)
        if not forks:
            return path
        if r_end < 0.010 or level >= 6:
            if level < 4:
                twigs.append(path)
            return path
        k = 2 if rng.random() < 0.7 else 3
        for _ in range(k):
            grow(pos, fork(d, rng.uniform(18, 38)), r_end * (0.8 if k == 2 else 0.7), level + 1)
        return path

    trunk = grow(base.copy(), Vector((0.03, 0.02, 1)).normalized(), 0.25, 0, forks=False)
    # the boughs: (how far up the trunk, compass direction, lean from upright, thickness)
    for frac, az, lean, r in ((0.70, 12, 62, 0.115), (0.80, 172, 60, 0.12), (0.88, 262, 56, 0.11),
                              (0.95, 310, 46, 0.12), (1.0, 215, 40, 0.12), (1.0, 80, 14, 0.14)):
        i = min(int(frac * (len(trunk) - 1)), len(trunk) - 1)
        d = Vector((math.cos(rad(az)) * math.sin(rad(lean)), math.sin(rad(az)) * math.sin(rad(lean)), math.cos(rad(lean))))
        grow(trunk[i][0].copy(), d, r, 1)
    wood_obj = obj_from_bm('tree wood', bm, M['bark'], parent=root, sharp=80)

    # the leaves: small folded blades, several to each span of twig, hanging every which way
    P, A, S, N, SZ, RND = [], [], [], [], [], []
    for path in twigs:
        for (a, _), (b, rb) in zip(path, path[1:]):
            along = (b - a).normalized()
            for _ in range(7 if rb < 0.012 else 4):
                p = a.lerp(b, rng.random())
                # none against the glass, and few low down, so the sky shows under the crown
                if p.y > -0.9 or rng.random() > min(1.0, max(0.3, (p.z - 1.5) / 1.0)):
                    continue
                d = (along * 0.6 + gauss3() * 0.75 + Vector((0, 0, -0.45))).normalized()
                up = (gauss3() * 0.6 + Vector((0, 0, 1))).normalized()
                side = d.cross(up).normalized()
                P.append(p + d * 0.015)
                A.append(d)
                S.append(side)
                N.append(side.cross(d))
                SZ.append(rng.uniform(0.085, 0.135))
                RND.append(rng.random())
    leaves = leaf_cloud('tree leaves', P, A, S, N, SZ, RND, M['leaf'], root)
    FAR['wood'], FAR['leaves'] = wood_obj, leaves
    return root


def outdoor_materials():
    n = Nodes('bark')
    co = n.coords()
    ridges = n.noise(n.mapping(co, (9, 9, 1.6)), 1.0, 5.0, 0.65, 1.5)
    n.set(Base_Color=n.ramp(ridges, [(0.3, (0.018, 0.013, 0.010)), (0.7, (0.10, 0.075, 0.055))]), Roughness=0.9)
    n.bump(ridges, 1.0, 0.02)
    M['bark'] = n.mat

    n = Nodes('leaf')
    uv = n.node('ShaderNodeSeparateXYZ', {0: n.coords('UV')})
    green = n.ramp(uv.outputs[0], [(0.0, (0.020, 0.060, 0.012)), (0.55, (0.045, 0.115, 0.018)), (0.85, (0.10, 0.17, 0.025)), (1.0, (0.22, 0.20, 0.03))])
    n.set(Base_Color=green, Roughness=0.45, Specular_IOR_Level=0.4)
    thru = n.node('ShaderNodeBsdfTranslucent', {'Color': n.mix(0.5, green, (0.30, 0.42, 0.05, 1))})
    both = n.node('ShaderNodeMixShader', {0: 0.42, 1: n.bsdf.outputs[0], 2: thru.outputs[0]})
    n.nt.links.new(both.outputs[0], n.out.inputs['Surface'])
    M['leaf'] = n.mat

    n = Nodes('lawn')
    g = n.noise(n.coords(), 0.5, 6.0, 0.75)
    n.set(Base_Color=n.ramp(g, [(0.3, (0.008, 0.024, 0.005)), (0.7, (0.03, 0.07, 0.014))]), Roughness=1.0, Specular_IOR_Level=0.0)
    n.bump(n.noise(n.coords(), 60.0, 3.0, 0.7), 1.0, 0.05)
    M['lawn'] = n.mat
    n = Nodes('hedge')
    g = n.noise(n.coords(), 3.0, 5.0, 0.75)
    n.set(Base_Color=n.ramp(g, [(0.3, (0.006, 0.016, 0.007)), (0.7, (0.02, 0.045, 0.016))]), Roughness=0.9)
    n.bump(g, 1.0, 0.1)
    M['hedge'] = n.mat
    M['deck'] = wood('deck wood', (0.05, 0.04, 0.032), (0.17, 0.14, 0.11), stave=0.14, along_y=True, rough=0.7, seed=5.0)
    M['house'] = pbr('house wall', (0.05, 0.045, 0.045), 0.9)
    M['roof'] = pbr('roof', (0.022, 0.02, 0.022), 0.8)
    M['window lit'] = pbr('lit window', (0.1, 0.08, 0.05), 0.5, Emission_Color=(1.0, 0.62, 0.28), Emission_Strength=3.0)
    M['window dark'] = pbr('dark window', (0.01, 0.012, 0.016), 0.1)


def far_trees():
    """Other trees beyond the hedge: the big tree's own meshes again, turned and scaled, far off."""
    root = empty('far trees')
    rng = random.Random(8)
    for x, y in ((-21, -24), (-12.5, -33), (4.5, -29), (13, -22), (24, -34), (-33, -38)):
        m = (Matrix.Translation((x, y, -0.3)) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z') @ Matrix.Scale(rng.uniform(0.75, 1.1), 4)
             @ Matrix.Translation(-TREE_AT))
        for src in (FAR['wood'], FAR['leaves']):
            o = bpy.data.objects.new('far ' + src.name, src.data)
            COLL.objects.link(o)
            o.parent = root
            o.matrix_world = m
    return root


def sky():
    """Dusk, a little after sunset: a warm band low down where the sun went (behind the tree,
    a little right of where the seat looks), lavender above it, deep blue overhead, thin cloud."""
    w = bpy.data.worlds.new('dusk')
    w.use_nodes = True
    nt = w.node_tree
    new, link = nt.nodes.new, nt.links.new
    co = new('ShaderNodeTexCoord')
    sep = new('ShaderNodeSeparateXYZ')
    link(co.outputs['Generated'], sep.inputs[0])
    ramp = new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    stops = [(0.40, (0.02, 0.025, 0.035)), (0.497, (0.60, 0.33, 0.22)), (0.54, (0.50, 0.36, 0.42)), (0.60, (0.26, 0.29, 0.50)),
             (0.74, (0.10, 0.16, 0.38)), (1.0, (0.03, 0.06, 0.20))]
    while len(cr.elements) < len(stops):
        cr.elements.new(0.5)
    for e, (p, c) in zip(cr.elements, stops):
        e.position, e.color = p, (*c, 1)
    half = new('ShaderNodeMath')
    half.operation = 'MULTIPLY_ADD'
    half.inputs[1].default_value, half.inputs[2].default_value = 0.5, 0.5
    link(sep.outputs['Z'], half.inputs[0])
    link(half.outputs[0], ramp.inputs['Fac'])
    # the afterglow round where the sun set
    dot = new('ShaderNodeVectorMath')
    dot.operation = 'DOT_PRODUCT'
    dot.inputs[1].default_value = Vector((-0.30, -0.95, 0.03)).normalized()
    link(co.outputs['Generated'], dot.inputs[0])
    glow = new('ShaderNodeMath')
    glow.operation = 'POWER'
    glow.use_clamp = True
    glow.inputs[1].default_value = 5.0
    link(dot.outputs['Value'], glow.inputs[0])
    warm = new('ShaderNodeMix')
    warm.data_type, warm.blend_type = 'RGBA', 'ADD'
    warm.inputs[7].default_value = (0.75, 0.30, 0.08, 1)
    link(glow.outputs[0], warm.inputs[0])
    link(ramp.outputs['Color'], warm.inputs[6])
    # thin streaks of cloud, stretched level
    mp = new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.2, 1.2, 9.0)
    link(co.outputs['Generated'], mp.inputs['Vector'])
    noise = new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value, noise.inputs['Detail'].default_value = 2.2, 5.0
    link(mp.outputs[0], noise.inputs['Vector'])
    cloud = new('ShaderNodeValToRGB')
    cloud.color_ramp.elements[0].position, cloud.color_ramp.elements[1].position = 0.52, 0.75
    cloud.color_ramp.elements[1].color = (0.35, 0.35, 0.35, 1)
    link(noise.outputs['Fac'], cloud.inputs['Fac'])
    hazy = new('ShaderNodeMix')
    hazy.data_type = 'RGBA'
    hazy.inputs[7].default_value = (0.42, 0.30, 0.34, 1)
    link(cloud.outputs['Color'], hazy.inputs[0])
    link(warm.outputs[2], hazy.inputs[6])
    bg = nt.nodes['Background']
    link(hazy.outputs[2], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = SKY_STRENGTH
    scene.world = w


# ---------------------------------------------------------------------------------------------
# The things that make the desk lived-in. Few, and each one made properly.
# ---------------------------------------------------------------------------------------------

def more_materials():
    M['grille'] = dots('speaker grille', (0.60, 0.605, 0.62), 0.0011)
    M['vents'] = dots('vent slots', (0.018, 0.018, 0.02), 0.004, rough=0.5, metal=0.0)
    M['post'] = pbr('post steel', (0.03, 0.03, 0.032), 0.3, 0.9)
    M['oled glass'] = pbr('oled glass', (0.004, 0.004, 0.005), 0.28)
    M['matte glass'] = pbr('matte panel', (0.006, 0.006, 0.007), 0.4)
    M['screen laptop'] = screen('laptop screen', laptop_picture(), LAPTOP_GLOW, 0.07)
    M['screen dell'] = screen('dell screen', dell_picture(), DELL_GLOW, 0.4)
    M['screen map'] = screen('map screen', None, MAP_GLOW, 0.3)
    n = Nodes('linen')
    co = n.coords()
    weave = n.node('ShaderNodeTexWave', {'Vector': co, 'Scale': 700.0, 'Distortion': 1.5}, wave_type='BANDS', bands_direction='Z').outputs['Fac']
    n.set(Base_Color=(0.40, 0.36, 0.30, 1), Roughness=0.9, Sheen_Weight=0.3)
    n.bump(weave, 0.25, 0.0004)
    thru = n.node('ShaderNodeBsdfTranslucent', {'Color': (0.50, 0.45, 0.37, 1)})
    both = n.node('ShaderNodeMixShader', {0: 0.3, 1: n.bsdf.outputs[0], 2: thru.outputs[0]})
    n.nt.links.new(both.outputs[0], n.out.inputs['Surface'])
    M['linen'] = n.mat
    M['ceiling'] = pbr('ceiling paint', (0.52, 0.50, 0.47), 0.95)
    M['skirting'] = pbr('skirting', (0.5, 0.47, 0.42), 0.5)

    # glazed stoneware with iron specks, for the mug
    n = Nodes('stoneware')
    co = n.coords()
    speck = n.math('GREATER_THAN', n.noise(co, 900.0, 2.0, 0.5), 0.70)
    cloud = n.noise(co, 30.0, 3.0, 0.6)
    n.set(Base_Color=n.mix(speck, n.ramp(cloud, [(0.3, (0.60, 0.56, 0.48)), (0.7, (0.72, 0.69, 0.62))]), (0.12, 0.08, 0.05, 1)),
          Roughness=0.22, Coat_Weight=0.5, Coat_Roughness=0.08)
    M['stoneware'] = n.mat
    M['coffee'] = pbr('coffee', (0.03, 0.014, 0.006), 0.03)
    n = Nodes('cork')
    co = n.coords()
    c = n.node('ShaderNodeTexVoronoi', {'Vector': co, 'Scale': 700.0}).outputs['Color']
    n.set(Base_Color=n.mix(0.55, (0.36, 0.23, 0.13, 1), c, 'MULTIPLY'), Roughness=0.85)
    n.bump(n.noise(co, 800.0, 2.0), 0.5, 0.0005)
    M['cork'] = n.mat
    n = Nodes('terracotta')
    co = n.coords()
    n.set(Base_Color=n.ramp(n.noise(co, 25.0, 4.0, 0.7), [(0.3, (0.36, 0.13, 0.065)), (0.75, (0.52, 0.22, 0.11))]), Roughness=0.8)
    n.bump(n.noise(co, 500.0, 2.0), 0.3, 0.0005)
    M['terracotta'] = n.mat
    M['soil'] = pbr('soil', (0.02, 0.014, 0.01), 0.95, grain=1.0, grain_scale=300)
    n = Nodes('pilea leaf')
    n.set(Base_Color=(0.04, 0.14, 0.03, 1), Roughness=0.32, Subsurface_Weight=0.0)
    thru = n.node('ShaderNodeBsdfTranslucent', {'Color': (0.20, 0.42, 0.05, 1)})
    both = n.node('ShaderNodeMixShader', {0: 0.25, 1: n.bsdf.outputs[0], 2: thru.outputs[0]})
    n.nt.links.new(both.outputs[0], n.out.inputs['Surface'])
    M['pilea'] = n.mat
    M['stem'] = pbr('plant stem', (0.10, 0.16, 0.05), 0.5)
    M['shade'] = pbr('lamp enamel', (0.50, 0.105, 0.035), 0.25, Coat_Weight=0.6, Coat_Roughness=0.06)
    M['shade inside'] = pbr('lamp inside', (0.15, 0.115, 0.08), 0.5)
    M['bulb'] = pbr('bulb', (1, 1, 1), 0.4, Emission_Color=(1.0, 0.62, 0.30), Emission_Strength=BULB_GLOW)
    # paper edges: fine lines where the pages stack
    n = Nodes('pages')
    lines = n.node('ShaderNodeTexWave', {'Vector': n.coords(), 'Scale': 900.0}, wave_type='BANDS', bands_direction='Z').outputs['Fac']
    n.set(Base_Color=n.ramp(lines, [(0.0, (0.55, 0.50, 0.40)), (1.0, (0.80, 0.76, 0.66))]), Roughness=0.8)
    M['pages'] = n.mat
    for name, c in (('book green', (0.025, 0.065, 0.05)), ('book linen', (0.50, 0.44, 0.33)), ('book red', (0.33, 0.07, 0.04)),
                    ('notebook', (0.02, 0.022, 0.03))):
        M[name] = pbr(name, c, 0.75, grain=0.6, grain_scale=1800, Sheen_Weight=0.3)
    M['chair wood'] = wood('chair wood', (0.07, 0.04, 0.022), (0.20, 0.12, 0.065), stave=0.5, rough=0.45, seed=9.0)
    M['chair cloth'] = pbr('chair cloth', (0.10, 0.11, 0.115), 0.9, grain=0.8, grain_scale=1200, Sheen_Weight=0.4)
    M['rug'] = pbr('rug', (0.20, 0.17, 0.14), 0.95, grain=1.0, grain_scale=500, Sheen_Weight=0.5)
    M['gilt'] = pbr('gilt', (0.75, 0.6, 0.3), 0.35, 1.0)
    M['ribbon'] = pbr('ribbon', (0.45, 0.06, 0.05), 0.6)
    M['phone frame'] = pbr('phone frame', (0.32, 0.32, 0.33), 0.33, 1.0)
    M['phone back'] = pbr('phone back', (0.035, 0.05, 0.075), 0.38)
    M['flash'] = pbr('flash', (0.8, 0.75, 0.5), 0.3)
    M['headphone'] = pbr('headphone shell', (0.50, 0.46, 0.40), 0.5, grain=0.15, grain_scale=2500)
    M['leather'] = pbr('ear cushion', (0.018, 0.017, 0.016), 0.6, grain=0.6, grain_scale=1500)
    M['plug'] = pbr('plug', (0.45, 0.45, 0.46), 0.4, 1.0)


def lamp():
    """A desk lamp, on: weighted base, brass stem bent over at the top, an enamel shade tipped
    toward the middle of the desk, a warm bulb inside."""
    root = empty('desk lamp', (-0.885, 0.22, TOP))
    lathe('lamp base', [(0, 0), (0.076, 0), (0.081, 0.003), (0.082, 0.011), (0.078, 0.016), (0.030, 0.019), (0.012, 0.024), (0, 0.024)],
          M['steel'], parent=root)
    tube('lamp stem', [(0, 0, 0.02), (0, 0, 0.20), (0, 0, 0.36), (0.012, 0.008, 0.425), (0.05, 0.035, 0.462), (0.095, 0.065, 0.455)],
         0.0055, M['brass'], parent=root)
    aim = Vector((0.80 * math.sin(rad(20)), 0.60 * math.sin(rad(20)), -math.cos(rad(20))))
    head = empty('lamp head', (0.105, 0.072, 0.437), Vector((0, 0, -1)).rotation_difference(aim).to_euler(), root)
    lathe('lamp shade', [(0, 0.036), (0.016, 0.036), (0.021, 0.031), (0.03, 0.012), (0.066, -0.045), (0.106, -0.086), (0.1075, -0.088)],
          M['shade'], parent=head)
    lathe('lamp shade inside', [(0.1075, -0.088), (0.105, -0.0865), (0.065, -0.046), (0.029, 0.011), (0.0, 0.02)], M['shade inside'], parent=head)
    cyl('lamp collar', 0.011, 0.02, (0, 0, 0.045), M['brass'], parent=head, bevel=0.002)
    cyl('lamp socket', 0.014, 0.03, (0, 0, 0.0), M['brass'], parent=head, bevel=0.002)
    bulb = lathe('lamp bulb', [(0, -0.062)] + [(0.024 * math.sin(rad(a)), -0.038 - 0.024 * math.cos(rad(a))) for a in range(15, 181, 15)],
                 M['bulb'], parent=head, seg=24)
    bulb.visible_shadow = False  # the light inside it must get out
    li = bpy.data.lights.new('lamp light', 'POINT')
    li.energy, li.color, li.shadow_soft_size = LAMP_W, (1.0, 0.66, 0.36), 0.024
    lo = bpy.data.objects.new('lamp light', li)
    COLL.objects.link(lo)
    lo.parent, lo.location, lo.visible_camera = head, (0, 0, -0.04), False
    # its flex, back over the edge of the desk
    tube('lamp flex', [(0.0, -0.078, 0.006), (0.01, -0.12, 0.003), (0.05, -0.17, 0.003), (0.07, -0.205, -0.01), (0.07, -0.215, -0.3), (0.2, -0.2, -0.72)],
         0.0028, M['cable'], parent=root)
    return root


def mug():
    """A stoneware mug of coffee on a cork coaster."""
    root = empty('mug', (-0.57, 0.64, TOP), (0, 0, rad(125)))
    cyl('coaster', 0.052, 0.005, (0, 0, 0.0025), M['cork'], parent=root, bevel=0.001, seg=48)
    z = 0.005
    lathe('mug body', [(0, 0.003), (0.030, 0.003), (0.032, 0.0), (0.037, 0.0), (0.040, 0.004), (0.0415, 0.02), (0.0415, 0.088), (0.0408, 0.0912),
                       (0.0393, 0.0925), (0.0378, 0.0912), (0.0372, 0.088), (0.0366, 0.014), (0.033, 0.008), (0, 0.007)],
          M['stoneware'], at=(0, 0, z), parent=root, seg=64)
    lathe('coffee', [(0, 0.074), (0.0369, 0.074)], M['coffee'], at=(0, 0, z), parent=root, seg=64)
    h = tube('mug handle', [(0.039, 0, 0.076), (0.058, 0, 0.080), (0.071, 0, 0.062), (0.069, 0, 0.038), (0.055, 0, 0.022), (0.039, 0, 0.022)],
             0.0058, M['stoneware'], parent=root)
    h.location = (0, 0, z)
    return root


def books():
    """Three cloth-bound books in a stack, spines toward the seat, not quite squared up."""
    root = empty('books', (-0.63, 0.215, TOP))
    z = 0.0
    for w, d, t, cover, turn in ((0.245, 0.172, 0.034, 'book green', 2), (0.225, 0.158, 0.026, 'book linen', -5), (0.205, 0.142, 0.021, 'book red', 6)):
        b = empty('book', (0, 0, z), (0, 0, rad(turn)), root)
        slab('book board', w, d, 0.0026, 0.002, M[cover], parent=b, rb=0.0006, rt=0.0006)
        slab('book board', w, d, 0.0026, 0.002, M[cover], at=(0, 0, t - 0.0026), parent=b, rb=0.0006, rt=0.0006)
        box('book pages', (w - 0.008, d - 0.007, t - 0.0052), (0, -0.0015, t / 2), M['pages'], parent=b)
        box('book spine', (w, 0.004, t), (0, d / 2 - 0.002, t / 2), M[cover], parent=b, bevel=0.0018)
        box('book title', (w * 0.3, 0.0004, t * 0.34), (w * 0.12, d / 2 + 0.0001, t / 2), M['gilt'], parent=b)
        z += t
    return root


def notebook():
    """A black notebook with an elastic band and a ribbon, a brass pen lying across it."""
    root = empty('notebook', (0.63, 0.645, TOP), (0, 0, rad(-11)))
    w, d = 0.148, 0.21
    slab('notebook cover', w, d, 0.0018, 0.007, M['notebook'], parent=root, rb=0.0005)
    slab('notebook pages', w - 0.004, d - 0.004, 0.0105, 0.006, M['pages'], at=(0.001, 0, 0.0018), parent=root)
    slab('notebook cover', w, d, 0.0018, 0.007, M['notebook'], at=(0, 0, 0.0123), parent=root, rt=0.0006)
    box('notebook band', (0.007, d + 0.0012, 0.0149), (-0.05, 0, 0.0072), M['leather'], parent=root, bevel=0.0004)
    box('notebook ribbon', (0.005, 0.035, 0.0004), (0.02, d / 2 + 0.012, 0.0006), M['ribbon'], rot=(0, 0, rad(8)), parent=root)
    pen = empty('pen', (0.012, -0.01, 0.0141 + 0.0048), (rad(90), 0, rad(-38)), root)
    lathe('pen barrel', [(0, 0), (0.0011, 0.0012), (0.0040, 0.018), (0.0048, 0.022), (0.0048, 0.094)], M['brass'], parent=pen, seg=24)
    lathe('pen cap', [(0.0050, 0.094), (0.0050, 0.136), (0.0042, 0.139), (0, 0.139)], M['steel'], parent=pen, seg=24)
    box('pen clip', (0.0026, 0.0012, 0.036), (0, -0.0056, 0.117), M['brass'], parent=pen, bevel=0.0004)
    return root


def phone():
    """A phone lying face down on the mat: metal band, matt glass back, the camera's three lenses."""
    root = empty('phone', (0.285, 0.70, TOP + MAT_H), (0, 0, rad(8) + math.pi))
    w, d, t = 0.0716, 0.1475, 0.0079
    slab('phone body', w, d, t, 0.0125, M['phone frame'], parent=root, rb=0.0022, rt=0.0022, seg=8)
    slab('phone back', w - 0.0036, d - 0.0036, 0.0002, 0.0108, M['phone back'], at=(0, 0, t), parent=root, seg=8)
    slab('phone camera', 0.0365, 0.0375, 0.0016, 0.0105, M['phone back'], at=(-0.0137, 0.0505, t), parent=root, rt=0.0006, seg=8)
    for x, y in ((-0.0222, 0.0595), (-0.0222, 0.0415), (-0.0062, 0.0505)):
        cyl('phone lens ring', 0.0078, 0.0036, (x, y, t + 0.0018), M['phone frame'], parent=root, bevel=0.0006)
        cyl('phone lens', 0.0058, 0.0002, (x, y, t + 0.0037), M['black glass'], parent=root)
    cyl('phone flash', 0.0026, 0.0002, (-0.0062, 0.0625, t + 0.0017), M['flash'], parent=root)
    return root


def headphones():
    """Over-ear headphones laid flat: the cups folded flat with their cushions up, the band standing on edge."""
    root = empty('headphones', (0.72, 0.37, TOP), (0, 0, rad(-110)))
    for s in (-1, 1):
        cup = empty('cup', (s * 0.085, 0, 0), (0, 0, 0), root)
        cup.scale = (1, 1.18, 1)
        lathe('headphone cup', [(0, 0), (0.033, 0), (0.040, 0.004), (0.043, 0.012), (0.043, 0.024), (0.040, 0.0285), (0, 0.0285)], M['headphone'], parent=cup)
        lathe('headphone cushion', [(0.031 + 0.0115 * math.cos(rad(a)), 0.036 + 0.0105 * math.sin(rad(a))) for a in range(-180, 181, 20)],
              M['leather'], parent=cup, sharp=180)
        lathe('headphone mesh', [(0, 0.031), (0.022, 0.031)], M['leather'], parent=cup)
        box('headphone yoke', (0.014, 0.03, 0.022), (s * 0.085, 0.052, 0.014), M['headphone'], parent=root, bevel=0.004)
        tube('headphone slider', [(s * 0.085, 0.06, 0.016), (s * 0.087, 0.095, 0.016)], 0.0035, M['chrome'], parent=root)
    tube('headphone band', [(0.087, 0.09, 0.016), (0.085, 0.13, 0.016), (0.055, 0.178, 0.016), (0, 0.195, 0.016), (-0.055, 0.178, 0.016),
                            (-0.085, 0.13, 0.016), (-0.087, 0.09, 0.016)], 0.0045, M['leather'], parent=root, extrude=0.0115)
    return root


def plant():
    """A small pilea in a terracotta pot on a saucer: round leaves on long thin stalks."""
    rng = random.Random(9)
    root = empty('plant', (0.87, 0.165, TOP))
    lathe('saucer', [(0, 0), (0.05, 0), (0.062, 0.008), (0.064, 0.012), (0.061, 0.012), (0.049, 0.004), (0, 0.004)], M['terracotta'], parent=root)
    lathe('pot', [(0, 0.004), (0.043, 0.004), (0.046, 0.007), (0.058, 0.092), (0.062, 0.093), (0.063, 0.108), (0.061, 0.11), (0.057, 0.108),
                  (0.054, 0.09), (0, 0.09)], M['terracotta'], parent=root)
    lathe('soil', [(0, 0.098), (0.055, 0.097)], M['soil'], parent=root)
    tube('pilea stalk', [(0, 0, 0.095), (0.004, 0.002, 0.14), (0.0, 0.004, 0.19)], 0.004, M['stem'], parent=root)
    for i in range(24):
        az = i * 2.4 + rng.uniform(-0.3, 0.3)
        out, top, h0 = rng.uniform(0.045, 0.125), rng.uniform(0.15, 0.31), rng.uniform(0.11, 0.18)
        d = Vector((math.cos(az), math.sin(az), 0))
        tip = d * out + Vector((0, 0, top))
        tube('pilea stem', [d * 0.003 + Vector((0, 0, h0)), d * out * 0.45 + Vector((0, 0, (h0 + top) / 2 + 0.02)), tip], 0.0012, M['stem'], parent=root, res=6)
        r = rng.uniform(0.022, 0.038)
        face = (d * rng.uniform(0.2, 0.9) + Vector((0, 0, 1)) + Vector((rng.uniform(-0.2, 0.2), rng.uniform(-0.2, 0.2), 0))).normalized()
        lathe('pilea leaf', [(0, 0), (r * 0.5, 0.0025), (r * 0.85, 0.005), (r, 0.0042)], M['pilea'], at=tip - face * 0.002,
              rot=Vector((0, 0, 1)).rotation_difference(face).to_euler(), parent=root, seg=20)
    return root


def chair():
    """The seat itself, pushed back a little: a plain wooden chair with a cloth seat. The seat view
    looks over it; the other views see it, and a wool rug under desk and chair."""
    slab('rug', 2.3, 1.7, 0.012, 0.03, M['rug'], at=(0, 1.15, 0), parent=empty('rug'), rt=0.006)
    root = empty('chair', (0.06, 1.48, 0.012), (0, 0, rad(-8)))
    W = M['chair wood']
    slab('chair seat', 0.46, 0.44, 0.035, 0.07, M['chair cloth'], at=(0, 0, 0.445), parent=root, rb=0.01, rt=0.016, n=4)
    slab('chair frame', 0.44, 0.42, 0.025, 0.06, W, at=(0, 0, 0.422), parent=root, rb=0.004)
    for sx in (-1, 1):
        tube('chair leg', [(sx * 0.19, -0.18, 0.43), (sx * 0.205, -0.20, 0.0)], 0.016, W, parent=root, res=2)
        tube('chair leg', [(sx * 0.185, 0.17, 0.43), (sx * 0.20, 0.215, 0.0)], 0.016, W, parent=root, res=2)
        tube('chair post', [(sx * 0.185, 0.17, 0.43), (sx * 0.18, 0.215, 0.66), (sx * 0.165, 0.245, 0.84)], 0.014, W, parent=root, res=6)
    bm = bmesh.new()
    rows = []
    for j, z in enumerate((0.70, 0.74, 0.80, 0.86, 0.88)):
        row = []
        for i in range(13):
            t = i / 12 - 0.5
            y = 0.225 + (z - 0.70) * 0.13 + 0.05 * (1 - (2 * t) ** 2) + (0.004 if j in (0, 4) else 0)
            row.append((t * 0.40, y, z))
        rows.append(row)
    front = [[bm.verts.new((x, y - 0.014, z)) for x, y, z in row] for row in rows]
    back = [[bm.verts.new((x, y + 0.008, z)) for x, y, z in row] for row in rows]
    for g in (front, back):
        for a, b in zip(g, g[1:]):
            for i in range(12):
                bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    for i in range(12):
        bm.faces.new((front[0][i], front[0][i + 1], back[0][i + 1], back[0][i]))
        bm.faces.new((front[-1][i], front[-1][i + 1], back[-1][i + 1], back[-1][i]))
    for j in range(4):
        bm.faces.new((front[j][0], front[j + 1][0], back[j + 1][0], back[j][0]))
        bm.faces.new((front[j][-1], front[j + 1][-1], back[j + 1][-1], back[j][-1]))
    obj_from_bm('chair back', bm, W, parent=root, sharp=60)
    return root


def usb_cables(ports):
    """The two cables that make the monitors the laptop's displays: a plug in each side of the
    laptop, a loop out across the mat, back along the desk and up to each monitor's ports."""
    root = empty('usb-c cables')
    z = FOOT + 0.0068
    for s, y, port in ((-1, 0.072, ports[0]), (1, 0.074, ports[1])):  # s: -1 the sitter's left (the picture's left), +1 right
        x0 = s * LW / 2
        box('usb-c plug', (0.019, 0.0118, 0.0062), lap((x0 + s * 0.0105, y, z)), M['plug'], parent=root, bevel=0.0028)
        cyl('usb-c relief', 0.0027, 0.012, lap((x0 + s * 0.025, y, z)), M['cable'], rot=(0, rad(90), 0), parent=root, bevel=0.001)
        k = -s  # the room's x runs the other way
        on_mat, on_desk = TOP + MAT_H + 0.0019, TOP + 0.0019
        pts = [lap((x0 + s * 0.028, y, z)), lap((x0 + s * 0.05, y - 0.001, z - 0.003)), Vector((k * 0.235, 0.515, on_mat)),
               Vector((k * 0.262, 0.465, on_mat)), Vector((k * 0.262, 0.425, on_desk + 0.001)), Vector((k * 0.245, 0.36, on_desk)),
               Vector((k * 0.25, 0.29, on_desk)), Vector((port.x - k * 0.01, port.y + 0.02, TOP + 0.02)),
               Vector((port.x, port.y - 0.012, TOP + 0.12)), port + Vector((0, -0.006, -0.03)), port]
        tube('usb-c cable', pts, 0.0019, M['cable'], parent=root)
    return root


# ---------------------------------------------------------------------------------------------
# Light, camera, finish.
# ---------------------------------------------------------------------------------------------

SKY_STRENGTH = 4.0
LAPTOP_GLOW, DELL_GLOW, MAP_GLOW = 2.2, 2.0, 1.1  # kept low: the screens must not blow out
BULB_GLOW, LAMP_W = 2.5, 16.0
WINDOW_W, FILL_W = 72.0, 8.0


def lights():
    """Dusk through the glass, and a faint warm fill so the dark side of the room still reads.
    The lamp carries its own light, and the screens light the desk and keys themselves."""
    def area(name, at, aim, size, watts, color):
        li = bpy.data.lights.new(name, 'AREA')
        li.shape, li.size, li.size_y, li.energy, li.color = 'RECTANGLE', size[0], size[1], watts, color
        o = bpy.data.objects.new(name, li)
        COLL.objects.link(o)
        o.location = at
        o.rotation_euler = (Vector(aim) - Vector(at)).to_track_quat('-Z', 'Y').to_euler()
        o.visible_camera = o.visible_glossy = False
        return o
    area('window light', (0, -0.95, 1.55), (0, 1.6, 0.9), (4.6, 3.1), WINDOW_W, (0.50, 0.66, 1.0))
    area('room fill', (0.4, 3.4, 2.3), (0, 0.6, 0.9), (2.5, 1.5), FILL_W, (1.0, 0.80, 0.62))


VIEWS = {
    # where the camera is, what it looks at, lens (mm), f-stop, what it focuses on
    'hero': ((0.0, 1.85, 1.22), (0.01, 0.2, 1.045), 25, 2.2, (0.0, 0.30, 1.05)),
    'laptop': ((0.47, 1.12, 1.08), (0.03, 0.50, 0.87), 38, 2.8, (0.0, 0.56, 0.82)),
    'arm': ((0.28, -1.2, 1.5), (0.02, 0.13, 1.06), 26, 4.0, (0.0, 0.10, 1.1)),
    'keys': ((0.0, 0.93, 1.02), (0.0, 0.60, 0.76), 60, 5.6, (0.0, 0.60, 0.76)),  # a check on the keyboard, not a deliverable
    'tree': ((0.75, 3.5, 1.35), (-0.35, -1.0, 1.72), 22, 4.0, (-0.9, -3.2, 2.0)),
}


def camera(view):
    at, aim, lens, fstop, focus = VIEWS[view]
    cam = bpy.data.cameras.new('camera')
    cam.lens, cam.sensor_width = lens, 36
    cam.clip_start, cam.clip_end = 0.05, 300
    o = bpy.data.objects.new('camera', cam)
    COLL.objects.link(o)
    o.location = at
    q = (Vector(aim) - Vector(at)).to_track_quat('-Z', 'Y')
    o.rotation_euler = q.to_euler()
    cam.dof.use_dof = True
    cam.dof.aperture_fstop = fstop
    cam.dof.aperture_blades = 7
    cam.dof.focus_distance = (Vector(focus) - Vector(at)).dot(q @ Vector((0, 0, -1)))
    scene.camera = o


def finish():
    """Render settings, and a little bloom round what is bright."""
    scene.render.engine = 'CYCLES'
    c = scene.cycles
    c.device = 'CPU'
    c.samples = SAMPLES
    c.use_adaptive_sampling = False
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.max_bounces, c.diffuse_bounces, c.glossy_bounces, c.transmission_bounces = 8, 4, 4, 8
    c.transparent_max_bounces = 16
    c.caustics_reflective = c.caustics_refractive = False
    c.sample_clamp_indirect = 6.0
    scene.render.threads_mode = 'AUTO'
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = round(WIDTH * 9 / 16)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = EXPOSURE.get(VIEW, 0.0)
    try:
        tree = bpy.data.node_groups.new('finish', 'CompositorNodeTree')
        tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
        layers = tree.nodes.new('CompositorNodeRLayers')
        layers.scene = scene
        glare = tree.nodes.new('CompositorNodeGlare')
        glare.inputs['Type'].default_value = 'Bloom'
        glare.inputs['Threshold'].default_value = 1.2
        glare.inputs['Strength'].default_value = 0.35
        glare.inputs['Size'].default_value = 0.55
        out = tree.nodes.new('NodeGroupOutput')
        tree.links.new(layers.outputs['Image'], glare.inputs['Image'])
        tree.links.new(glare.outputs['Image'], out.inputs[0])
        scene.compositing_node_group = tree
    except Exception as e:  # the bloom is a nicety: without it the render is still right
        print('no bloom:', e)


EXPOSURE = {'hero': 0.0, 'laptop': 0.0, 'arm': 0.35, 'tree': 0.0}


def stats():
    """Triangles per object group, as rendered."""
    dg = bpy.context.evaluated_depsgraph_get()
    totals = {}
    for o in scene.objects:
        if o.type not in ('MESH', 'CURVE') or o.hide_render:
            continue
        top = o
        while top.parent:
            top = top.parent
        e = o.evaluated_get(dg)
        me = e.to_mesh()
        me.calc_loop_triangles()
        totals[top.name] = totals.get(top.name, 0) + len(me.loop_triangles)
        e.to_mesh_clear()
    for k, v in sorted(totals.items(), key=lambda kv: -kv[1]):
        print(f'{k:16s} {v:9d} triangles')
    print(f'{"all":16s} {sum(totals.values()):9d} triangles')


def build():
    materials()
    more_materials()
    outdoor_materials()
    room()
    outside()
    tree()
    far_trees()
    sky()
    desk()
    macbook()
    s_root, s_mw, s_mount, s_port = samsung()
    d_root, d_mw, d_mount, d_port = dell()
    monitor_arm([(s_mw @ s_mount, s_mw @ Vector((-s_port.x, s_port.y, s_port.z)), 1),
                 (d_mw @ d_mount, d_mw @ Vector((-d_port.x, d_port.y, d_port.z)), -1)])
    usb_cables([s_mw @ s_port, d_mw @ d_port])
    lamp()
    mug()
    books()
    notebook()
    phone()
    headphones()
    plant()
    chair()
    lights()
    camera(VIEW)
    if VIEW == 'arm':
        # this view stands on the deck looking in: the glass would only show the sky's reflection
        bpy.data.objects['window glass'].hide_render = True
    finish()


build()
if STATS:
    stats()
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
