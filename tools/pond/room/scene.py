# The room under the pond, detailed: the agreed greybox (greybox.py) built out into real objects,
# materials and light, all from code. Run with Blender's Python module (Cycles on the CPU):
#   [SEASON=spring|summer|autumn|winter] python tools/pond/room/scene.py out.png [samples] [width] [view] [stats] [outside]
# view is one of hero (the seat, the default), laptop, arm, tree (and keys, plush, mug, keepsakes, plushback, kplush, kfigurine and kmug, which are checks).
# "stats" prints triangles per object group; "outside" hides the room from the camera, to look at
# the season alone. The screens' pictures are painted into ROOM_TEX.
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
OUTSIDE = 'outside' in sys.argv  # only what is beyond the glass, as the seat sees it: a quick check on a season
SEASON = os.environ.get('SEASON', 'summer')  # spring, summer, autumn or winter: what the outside looks like (SEASONS)
TEX = os.environ.get('ROOM_TEX', '/home/user/room/tex')  # where the generated screen pictures go
# the face the mug's lettering is set in: Protest Revolution (SIL Open Font License), which is not kept in the repository
FONT = os.environ.get('ROOM_FONT', '/home/user/room/fonts/ProtestRevolution-Regular.ttf')
# and the script the word on the plush is set in: Kaushan Script (SIL Open Font License), likewise not kept here
SCRIPT = os.environ.get('ROOM_SCRIPT', '/home/user/room/fonts/KaushanScript-Regular.ttf')

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


def obj_from_bm(name, bm, mat=None, at=(0, 0, 0), rot=(0, 0, 0), parent=None, sharp=50, smooth=True, outward=None):
    """Turn a bmesh into an object. Faces are smooth, edges sharper than `sharp` degrees stay
    crisp, and normals are weighted by face area so large flat faces stay flat beside their bevels.
    A solid's faces are turned to look out of it. A thin sheet laid on something has no inside
    to tell by: give `outward`, a point its faces look away from (the light baked into its
    corners is the light on the side its faces look to)."""
    me = bpy.data.meshes.new(name)
    if outward is None:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    else:
        bm.normal_update()
        for f in bm.faces:
            if f.normal.dot(f.calc_center_median() - Vector(outward)) < 0:
                f.normal_flip()
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
    # the desk top: a pale, warm oak with a fine straight grain and a satin finish
    M['desk'] = wood('desk wood', (0.33, 0.205, 0.105), (0.56, 0.375, 0.20), stave=0.26, rough=0.46)
    # the floor: short-pile beige carpet
    n = Nodes('carpet')
    pile = n.noise(n.coords(), 900.0, 2.0, 0.7)
    n.set(Base_Color=n.mix(n.math('MULTIPLY', n.noise(n.coords(), 3.0, 3.0, 0.6), 0.5), (0.40, 0.345, 0.27, 1), (0.33, 0.285, 0.225, 1)),
          Roughness=0.95, Sheen_Weight=0.25, Sheen_Roughness=0.6, Specular_IOR_Level=0.1)
    n.bump(pile, 0.8, 0.002)
    M['floor'] = n.mat
    M['steel'] = pbr('black steel', (0.012, 0.012, 0.013), 0.48, 0.0, grain=0.25, grain_scale=900)
    M['arm'] = pbr('arm powder coat', (0.016, 0.016, 0.018), 0.42, 0.0, grain=0.3, grain_scale=1200)
    M['arm plastic'] = pbr('arm plastic', (0.02, 0.02, 0.021), 0.55)
    M['chrome'] = pbr('bolt steel', (0.55, 0.55, 0.56), 0.22, 1.0)
    # the laptop's body: dark anodised aluminium, a grey near black
    M['alu'] = pbr('aluminium', (0.085, 0.087, 0.092), 0.36, 1.0, grain=0.05, grain_scale=3000)
    M['alu pad'] = pbr('trackpad glass', (0.070, 0.072, 0.077), 0.26, 1.0)
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
# turned to face the seat: the two stand side by side in one plane, square to the desk. Each
# returns where its arm must reach.
# ---------------------------------------------------------------------------------------------

UP = (rad(-90), 0, 0)
LIFT = 0.198  # the monitors' lower edges above the desk: on the laptop lid's upper edge, seen from the seat


def monitor_root(name, x):
    at = Vector((x, 0.26, TOP))
    root = empty(name, at, (0, 0, math.pi))
    return root, Matrix.Translation(at) @ Matrix.Rotation(math.pi, 4, 'Z')


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
    root, mw = monitor_root('samsung g80sd', 0.37)
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
    root, mw = monitor_root('dell 27', -0.335)
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
# Outside. The room is on an upper floor: past the glass a narrow balcony (artificial turf
# edged with white pebbles, a waist-high parapet of lap siding under a white cap, the house's
# own wall on the right), and beyond it, at eye level, the crowns of trees. Nearest, in a row
# below the parapet, junipers of the twisted kind; behind them left of centre a taller tree
# with long pinnate leaves, taken for a walnut; further back on the right a big weeping pepper
# tree. Lower on the left a neighbour's steep gable roof, and a yellow building behind it.
#
# The climate is mild and it does not snow: the evergreens look the same all year, and the
# seasons show in the walnut, in the sky, in what lies on the balcony (dry leaves in autumn,
# rain water in winter) and in the pepper tree's berries. The hour does not change: it is
# always the same dusk. SEASON picks the season; SEASONS, and each species' own table, say
# what it changes.
# ---------------------------------------------------------------------------------------------

OUTDOOR = ('outside', 'trees')  # the things everything beyond the glass hangs from
GROUND = -3.3  # the garden's level, a storey below the room's floor
DECK = -0.06  # the top of the balcony's turf
PARAPET_Y, PARAPET_T, PARAPET_TOP = -1.31, 0.14, 0.88  # its inner face, its thickness, where its cap sits
WALL_X = -2.3  # the inner face of the house's wall at the balcony's right end (the seat's right is -x)
CLEAR = PARAPET_Y - PARAPET_T - 0.25  # no branch comes nearer the house than this
LOW = 0.15  # foliage below this height is hidden by the parapet from anywhere in the room, and is not made

# What each season changes apart from the trees (which have their own tables, in SPECIES).
# `fallen` is how many dry leaflets lie on the balcony and `wet` whether rain has darkened
# and glossed what is out in it; `sky` is the dusk itself: the colours from below the horizon
# to overhead, the afterglow, the cloud (from which noise value it starts, where it is full,
# its colour, how much it is stretched level) and the sky's strength beside summer's.
SEASONS = {
    'spring': {
        'fallen': 0.0, 'wet': False,
        'sky': {'ramp': [(0.40, (0.02, 0.025, 0.035)), (0.497, (0.60, 0.40, 0.30)), (0.54, (0.50, 0.40, 0.48)), (0.60, (0.30, 0.36, 0.58)),
                         (0.74, (0.13, 0.21, 0.45)), (1.0, (0.04, 0.08, 0.24))],
                'glow': (0.50, 0.24, 0.10), 'cloud': (0.62, 0.85, (0.46, 0.36, 0.40), 9.0), 'strength': 1.05},
    },
    'summer': {
        'fallen': 0.0, 'wet': False,
        'sky': {'ramp': [(0.40, (0.02, 0.025, 0.035)), (0.497, (0.60, 0.33, 0.22)), (0.54, (0.50, 0.36, 0.42)), (0.60, (0.26, 0.29, 0.50)),
                         (0.74, (0.10, 0.16, 0.38)), (1.0, (0.03, 0.06, 0.20))],
                'glow': (0.75, 0.30, 0.08), 'cloud': (0.52, 0.75, (0.42, 0.30, 0.34), 9.0), 'strength': 1.0},
    },
    'autumn': {
        'fallen': 1.0, 'wet': False,
        'sky': {'ramp': [(0.40, (0.025, 0.022, 0.03)), (0.497, (0.80, 0.42, 0.17)), (0.54, (0.62, 0.38, 0.30)), (0.60, (0.32, 0.29, 0.44)),
                         (0.74, (0.11, 0.15, 0.34)), (1.0, (0.035, 0.055, 0.19))],
                'glow': (1.0, 0.42, 0.09), 'cloud': (0.50, 0.74, (0.55, 0.34, 0.24), 9.0), 'strength': 0.97},
    },
    'winter': {
        'fallen': 0.22, 'wet': True,
        'sky': {'ramp': [(0.40, (0.03, 0.035, 0.045)), (0.497, (0.27, 0.27, 0.30)), (0.54, (0.23, 0.245, 0.30)), (0.60, (0.185, 0.21, 0.28)),
                         (0.74, (0.14, 0.165, 0.24)), (1.0, (0.10, 0.12, 0.18))],
                'glow': (0.08, 0.06, 0.05), 'cloud': (0.30, 0.80, (0.24, 0.265, 0.33), 2.5), 'strength': 0.85},
    },
}
if SEASON not in SEASONS:
    raise SystemExit(f'SEASON is one of {", ".join(SEASONS)}, not {SEASON!r}')
NOW = SEASONS[SEASON]


def axes_euler(x, y, z):
    """The turn that carries the x, y and z axes onto three given directions, as Euler angles."""
    return tuple(Matrix((x, y, z)).transposed().to_euler())


def source(name, bm, mat, parent):
    """A small mesh that is never rendered where it lies: scatter() stands copies of it elsewhere."""
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    COLL.objects.link(o)
    o.parent = parent
    o.hide_render = True
    return o


def scatter(name, sources, P, R, S, parent):
    """Many copies of a few small meshes, as instances (the mesh is stored once): a point for
    each copy, with how it is turned (R, Euler angles) and its size (S), and a geometry-nodes
    modifier that stands a source on every point. The sources are taken in turn. Each copy has
    its own random number in the material (Object Info), which is what colours leaf from leaf."""
    made = []
    for k, src in enumerate(sources):
        p, r, s = P[k::len(sources)], R[k::len(sources)], S[k::len(sources)]
        if not p:
            continue
        me = bpy.data.meshes.new(name)
        me.vertices.add(len(p))
        me.vertices.foreach_set('co', np.array([tuple(v) for v in p], dtype=np.float32).reshape(-1))
        me.attributes.new('rot', 'FLOAT_VECTOR', 'POINT').data.foreach_set('vector', np.array(r, dtype=np.float32).reshape(-1))
        me.attributes.new('scale', 'FLOAT', 'POINT').data.foreach_set('value', np.array(s, dtype=np.float32))
        o = bpy.data.objects.new(name, me)
        COLL.objects.link(o)
        o.parent = parent
        g = bpy.data.node_groups.new('scatter ' + src.name, 'GeometryNodeTree')
        g.interface.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
        g.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
        new = g.nodes.new
        gin, gout, info, inst = new('NodeGroupInput'), new('NodeGroupOutput'), new('GeometryNodeObjectInfo'), new('GeometryNodeInstanceOnPoints')
        info.inputs['Object'].default_value = src
        info.inputs['As Instance'].default_value = True
        rot, size = new('GeometryNodeInputNamedAttribute'), new('GeometryNodeInputNamedAttribute')
        rot.data_type, size.data_type = 'FLOAT_VECTOR', 'FLOAT'
        rot.inputs['Name'].default_value, size.inputs['Name'].default_value = 'rot', 'scale'
        g.links.new(gin.outputs[0], inst.inputs['Points'])
        g.links.new(info.outputs['Geometry'], inst.inputs['Instance'])
        g.links.new(rot.outputs['Attribute'], inst.inputs['Rotation'])
        g.links.new(size.outputs['Attribute'], inst.inputs['Scale'])
        g.links.new(inst.outputs['Instances'], gout.inputs[0])
        o.modifiers.new('scatter', 'NODES').node_group = g
        made.append(o)
    return made


def leaflet_into(bm, uv, base, along, side, up, length, width, rnd, fold=0.07):
    """One oval leaflet, folded a little along its midrib and bowed at the tip: 8 points, 6 faces.
    Its texture coordinate carries a random number (u) and how far along the leaflet (v)."""
    shape = ((0, 0, 0), (0.33, 0, 0), (0.68, 0, -0.02), (1, 0, -0.08), (0.30, 1, fold), (0.66, 0.83, fold * 0.7), (0.30, -1, fold), (0.66, -0.83, fold * 0.7))
    vs = [bm.verts.new(base + along * (length * x) + side * (width / 2 * y) + up * (length * z)) for x, y, z in shape]
    for f in ((0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (0, 6, 1), (1, 6, 7, 2), (2, 7, 3)):
        face = bm.faces.new([vs[i] for i in f])
        for loop, i in zip(face.loops, f):
            loop[uv].uv = (rnd, shape[i][0])


def strip_into(bm, uv, a, b, wa, wb, va, vb, rnd, flat=Vector((0, 0, 1))):
    """A flat tapering strip from a to b, wa wide at a and wb at b, lying square to `flat`."""
    s = flat.cross(b - a).normalized()
    face = bm.faces.new([bm.verts.new(p) for p in (a - s * wa / 2, a + s * wa / 2, b + s * wb / 2, b - s * wb / 2)])
    for loop, v in zip(face.loops, (va, va, vb, vb)):
        loop[uv].uv = (rnd, v)


def compound_leaf(name, pairs, rng, mat, parent, leaflet=0.2, width=0.095, droop=(0.10, 0.24), start=0.2):
    """One pinnate leaf: a stalk (the rachis) one unit long along +x, bare at its foot, then
    leaflets in opposite pairs and one at the tip. It bows under its own weight. `leaflet` and
    `width` are a leaflet's length and breadth beside the whole leaf's length."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    droop, sway, ph = rng.uniform(*droop), rng.uniform(0.01, 0.04), rng.uniform(0, 6.28)

    def spine(t):
        return Vector((t, sway * math.sin(3 * t + ph), -droop * t * t))

    for i in range(6):
        strip_into(bm, uv, spine(i / 6), spine((i + 1) / 6), 0.014, 0.010, 0.25, 0.25, 0.5)
    for k in range(pairs):
        t = start + (0.92 - start) * k / (pairs - 1)
        p = spine(t)
        tang = (spine(t + 0.01) - p).normalized()
        for s in (1, -1):
            a = rad(rng.uniform(55, 78))
            along = tang * math.cos(a) + Vector((0, s, 0)) * math.sin(a) + Vector((0, 0, -rng.uniform(0.0, 0.3)))
            along.normalize()
            side = Vector((0, 0, 1)).cross(along).normalized()
            leaflet_into(bm, uv, p, along, side, along.cross(side), leaflet * rng.uniform(0.85, 1.1) * (1 - 0.25 * abs(2 * t - 1.1)), width, rng.random())
    p = spine(0.97)
    tang = (p - spine(0.94)).normalized()
    side = Vector((0, 0, 1)).cross(tang).normalized()
    leaflet_into(bm, uv, p, tang, side, tang.cross(side), leaflet, width, rng.random())
    return source(name, bm, mat, parent)


def tuft(name, rng, mat, parent):
    """One tuft of a juniper's scale foliage, one unit long along +x: a rib with branchlets to
    all sides by turns, each with shorter lobes of its own, all narrow flattened strips. The
    texture coordinate's v runs from the foot (inside the plant) to the tips."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rnd = rng.random()

    def rib(t):
        return Vector((t, 0.03 * math.sin(4 * t + rnd * 6), 0.05 * math.sin(3 * t + rnd * 9)))

    for i in range(5):
        strip_into(bm, uv, rib(i / 5), rib((i + 1) / 5), 0.05 - 0.004 * i, 0.046 - 0.004 * i, i / 5, (i + 1) / 5, rnd)
    for i in range(14):
        t = 0.06 + 0.86 * i / 13
        a, roll = rad(38 + rng.uniform(-8, 8)), i * 2.2 + rng.uniform(-0.4, 0.4)
        length = (0.42 * (1 - 0.75 * t) + 0.10) * rng.uniform(0.85, 1.15)
        d = Vector((math.cos(a), math.sin(a) * math.cos(roll), math.sin(a) * math.sin(roll)))
        flat = d.cross(Vector((1, 0, 0))).normalized()
        p, r2 = rib(t), rng.random()
        strip_into(bm, uv, p, p + d * length, 0.065, 0.03, t, min(1.0, t + length), r2, flat)
        for j in range(3):
            q = p + d * (length * (0.25 + 0.25 * j))
            d2 = (Matrix.Rotation((1 if j % 2 else -1) * rad(36), 3, flat) @ d + Vector((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1)))).normalized()
            strip_into(bm, uv, q, q + d2 * (length * 0.42 * (1 - 0.2 * j)), 0.05, 0.022, min(1.0, t + 0.3), 1.0, r2, flat)
    return source(name, bm, mat, parent)


def streamer(name, rng, mat, parent):
    """One hanging branchlet of a pepper tree, one unit long along +x (which scatter() points
    down): a thread of a stem that sways, and along it fine pinnate leaves that hang with it,
    each a stalk with many narrow leaflets."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    ph = [rng.uniform(0, 6.28) for _ in range(2)]

    def stem(t):
        return Vector((t, 0.05 * math.sin(4 * t + ph[0]) * t, 0.05 * math.sin(3 * t + ph[1]) * t))

    for i in range(6):
        strip_into(bm, uv, stem(i / 6), stem((i + 1) / 6), 0.006, 0.004, 0.2, 0.2, 0.5, Vector((0, 0, 1)))
    for i in range(13):
        t = 0.05 + 0.93 * i / 12
        roll = i * 2.4 + rng.uniform(-0.5, 0.5)
        out = Vector((0, math.cos(roll), math.sin(roll)))
        d = (Vector((1, 0, 0)) * rng.uniform(0.9, 1.6) + out).normalized()  # the leaf hangs along the branchlet, a little out from it
        flat = d.cross(out).normalized()
        length, rnd = rng.uniform(0.16, 0.24), rng.random()
        p = stem(t)
        strip_into(bm, uv, p, p + d * length, 0.004, 0.003, 0.2, 0.2, rnd, flat)
        for k in range(11):
            q = p + d * (length * (0.12 + 0.86 * k / 10))
            for s in (1, -1):
                e = (d * 0.55 + flat.cross(d) * s).normalized()
                strip_into(bm, uv, q, q + e * 0.042 * rng.uniform(0.8, 1.2), 0.012, 0.004, 0.3, 1.0, rnd, flat)
    return source(name, bm, mat, parent)


def cluster(name, rng, mat, parent, n=22, spread=0.3, bead=0.09):
    """A hanging bunch one unit long along +x: small beads on threads (the pepper tree's
    berries), or with long narrow ones close to the stalk a catkin."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    strip_into(bm, uv, Vector((0, 0, 0)), Vector((1, 0, 0)), 0.012, 0.008, 0, 0, 0.5)
    for i in range(n):
        t = 0.15 + 0.85 * i / (n - 1)
        a = i * 2.4 + rng.uniform(-0.4, 0.4)
        c = Vector((t, math.cos(a) * spread * (1 - 0.6 * t) * rng.uniform(0.4, 1), math.sin(a) * spread * (1 - 0.6 * t) * rng.uniform(0.4, 1)))
        r = bead * rng.uniform(0.8, 1.2) / 2
        vs = [bm.verts.new(c + Vector(d) * r) for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
        for f in ((0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)):
            face = bm.faces.new([vs[k] for k in f])
            for loop in face.loops:
                loop[uv].uv = (rng.random(), t)
    return source(name, bm, mat, parent)


def lump(name, rng, parent, mat, squash=0.5, rough=0.18, cuts=2):
    """A rounded lump one unit across (a pebble). Flattened, never quite round."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=cuts, radius=0.5)
    ph = [rng.uniform(0, 6.28) for _ in range(6)]
    for v in bm.verts:
        c = v.co
        k = 1 + rough * (math.sin(3.1 * c.x + ph[0]) * math.sin(2.7 * c.y + ph[1]) + 0.6 * math.sin(4.3 * c.z + ph[2] + 2 * c.x))
        v.co = Vector((c.x * k * (1 + 0.25 * math.sin(ph[3])), c.y * k * (0.8 + 0.15 * math.sin(ph[4])), c.z * k * squash))
    return source(name, bm, mat, parent)


def lap_wall(name, length, z0, z1, mat, at, turn=0.0, parent=None, board=0.15, proud=0.014):
    """A wall face clad in lap siding: boards lying level, each one's lower edge standing proud
    of the board below. The face runs `length` along its own x and looks toward its own +y."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = max(1, round((z1 - z0) / board))
    h = (z1 - z0) / rows
    for k in range(rows):
        za, zb = z0 + k * h, z0 + (k + 1) * h
        # the board's face, then the narrow underside of the board above
        for quad in (((0, proud, za), (length, proud, za), (length, 0.002, zb), (0, 0.002, zb)),
                     ((0, 0.002, zb), (length, 0.002, zb), (length, proud, zb), (0, proud, zb))):
            face = bm.faces.new([bm.verts.new(p) for p in quad])
            for loop in face.loops:
                loop[uv].uv = (loop.vert.co.x, loop.vert.co.z + k * 0.37)  # metres; each board its own grain
    return obj_from_bm(name, bm, mat, at=at, rot=(0, 0, turn), parent=parent, smooth=False)


def lap_wall(name, length, z0, z1, mat, at, turn=0.0, parent=None, board=0.15, proud=0.014):
    """A wall face clad in lap siding: boards lying level, each one's lower edge standing proud
    of the board below. The face runs `length` along its own x and looks toward its own +y."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rows = max(1, round((z1 - z0) / board))
    h = (z1 - z0) / rows
    for k in range(rows):
        za, zb = z0 + k * h, z0 + (k + 1) * h
        # the board's face, then the narrow underside of the board above
        for quad in (((0, proud, za), (length, proud, za), (length, 0.002, zb), (0, 0.002, zb)),
                     ((0, 0.002, zb), (length, 0.002, zb), (length, proud, zb), (0, proud, zb))):
            face = bm.faces.new([bm.verts.new(p) for p in quad])
            for loop in face.loops:
                loop[uv].uv = (loop.vert.co.x, loop.vert.co.z + k * 0.37)  # metres; each board its own grain
    return obj_from_bm(name, bm, mat, at=at, rot=(0, 0, turn), parent=parent, smooth=False)


def balcony():
    root = empty('outside')
    rng = random.Random(21)
    x0, x1 = WALL_X, 2.3  # the turf runs from the house's wall to the parapet's return on the left
    y0, y1 = PARAPET_Y, -0.11
    box('balcony slab', (x1 - x0 + 0.4, y1 - y0 + 0.3, 0.22), ((x0 + x1) / 2, (y0 + y1) / 2 - 0.05, DECK - 0.115), M['trim'], parent=root)
    box('turf', (x1 - x0, y1 - y0, 0.012), ((x0 + x1) / 2, (y0 + y1) / 2, DECK - 0.006), M['turf'], parent=root)
    # the parapet: siding inside, a white board under the cap, the cap itself, and plain outside
    yo = PARAPET_Y - PARAPET_T
    box('parapet', (x1 - x0 + 0.3, PARAPET_T - 0.02, PARAPET_TOP - DECK + 0.2), ((x0 + x1) / 2 + 0.15, PARAPET_Y - PARAPET_T / 2 - 0.01, (PARAPET_TOP + DECK - 0.2) / 2), M['siding'], parent=root)
    lap_wall('parapet siding', x1 - x0, DECK, PARAPET_TOP - 0.09, M['siding'], (x1, PARAPET_Y, 0), rad(180), root)
    box('parapet fascia', (x1 - x0, 0.02, 0.09), ((x0 + x1) / 2, PARAPET_Y + 0.008, PARAPET_TOP - 0.045), M['trim'], parent=root, bevel=0.003)
    box('parapet cap', (x1 - x0 + 0.42, PARAPET_T + 0.07, 0.045), ((x0 + x1) / 2 + 0.2, PARAPET_Y - PARAPET_T / 2, PARAPET_TOP + 0.0225), M['cap'], parent=root, bevel=0.006)
    # its return on the left, back to the house
    box('parapet return', (PARAPET_T - 0.02, y1 - yo, PARAPET_TOP - DECK + 0.2), (x1 + PARAPET_T / 2 + 0.01, (y1 + yo) / 2, (PARAPET_TOP + DECK - 0.2) / 2), M['siding'], parent=root)
    lap_wall('return siding', y1 - y0, DECK, PARAPET_TOP - 0.09, M['siding'], (x1, y1, 0), rad(90), root)
    box('return fascia', (0.02, y1 - y0, 0.09), (x1 - 0.008, (y0 + y1) / 2, PARAPET_TOP - 0.045), M['trim'], parent=root, bevel=0.003)
    box('return cap', (PARAPET_T + 0.07, y1 - y0 + 0.1, 0.045), (x1 + PARAPET_T / 2, (y0 + y1) / 2 + 0.05, PARAPET_TOP + 0.0225), M['cap'], parent=root, bevel=0.006)
    # the house's own wall on the right, in the same siding, with a white board down its outer corner
    box('house wall', (0.3, y1 - yo + 0.1, 3.6 - GROUND), (x0 - 0.16, (y1 + yo) / 2 - 0.05, (3.6 + GROUND) / 2), M['siding'], parent=root)
    lap_wall('house siding', y1 - yo, DECK, 3.6, M['siding'], (x0, yo, 0), rad(-90), root)
    box('corner board', (0.03, 0.11, 3.6 - DECK), (x0 + 0.012, yo - 0.02, (3.6 + DECK) / 2), M['trim'], parent=root, bevel=0.003)

    # the pebbles: a band along the foot of the parapet and of both ends, two deep in places
    stones = [lump('pebble', rng, root, M['pebble'], squash=rng.uniform(0.45, 0.7), rough=0.1) for _ in range(4)]
    band = 0.17
    box('pebble bed', (x1 - x0, band + 0.02, 0.004), ((x0 + x1) / 2, y0 + band / 2 + 0.01, DECK + 0.002), M['soil'], parent=root)
    P, R, S = [], [], []

    def pebbles(n, place):
        for _ in range(n):
            x, y = place()
            size = rng.uniform(0.032, 0.062)
            lift = rng.random() < 0.3
            P.append(Vector((x, y, DECK + size * 0.27 + (size * 0.4 if lift else 0))))
            R.append((rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), rng.uniform(0, 6.28)))
            S.append(size)

    pebbles(1500, lambda: (rng.uniform(x0 + 0.02, x1 - 0.02), y0 + 0.02 + band * rng.random() ** 1.3))
    pebbles(330, lambda: (x0 + 0.02 + band * rng.random() ** 1.3, rng.uniform(y0, y1 - 0.03)))
    pebbles(330, lambda: (x1 - 0.02 - band * rng.random() ** 1.3, rng.uniform(y0, y1 - 0.03)))
    scatter('pebbles', stones, P, R, S, root)

    if NOW['fallen']:
        # dry leaflets the walnut has dropped: thick against the parapet and in the corners, a few
        # out on the turf, some caught among the pebbles and a few on the cap
        dry = []
        for i in range(3):
            bm = bmesh.new()
            uv = bm.loops.layers.uv.new('UVMap')
            leaflet_into(bm, uv, Vector((-0.5, 0, 0)), Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), 1.0, 0.36 + 0.07 * i, 0.5, fold=0.05 + 0.07 * i)
            dry.append(source('dry leaflet', bm, M['dry leaf'], root))
        P, R, S = [], [], []
        for _ in range(round(620 * NOW['fallen'])):
            y = y0 + 0.03 + (y1 - y0 - 0.06) * rng.random() ** 2.2
            x = rng.uniform(x0 + 0.03, x1 - 0.03)
            on_stones = y < y0 + band or x < x0 + band or x > x1 - band
            P.append(Vector((x, y, DECK + (rng.uniform(0.03, 0.06) if on_stones else 0.006))))
            tilt = 0.5 if on_stones else 0.12
            R.append((rng.uniform(-tilt, tilt), rng.uniform(-tilt, tilt), rng.uniform(0, 6.28)))
            S.append(rng.uniform(0.05, 0.095))
        for _ in range(round(16 * NOW['fallen'])):
            P.append(Vector((rng.uniform(-1.9, 1.9), PARAPET_Y - PARAPET_T / 2 + rng.uniform(-0.07, 0.07), PARAPET_TOP + 0.049)))
            R.append((rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1), rng.uniform(0, 6.28)))
            S.append(rng.uniform(0.05, 0.09))
        scatter('fallen leaves', dry, P, R, S, root)
    return root


def neighbours(root):
    """A neighbour's house, lower on the left: only its steep roof and the gable under it reach
    the view, the gable shingled, with one small attic window (lit on a winter evening). Behind
    it a plain yellow building; along the end of the garden below, a board fence."""
    lit = SEASON == 'winter'
    # the house in its own frame: the ridge runs along y, the gable seen is at +y; then turned and put in place
    w, length, eave, apex = 5.2, 9.0, -0.5, 2.85
    turn = rad(53)
    peak = Vector((5.3, -8.2, 0))  # under the near gable's apex
    house = empty('neighbour', at=peak - Matrix.Rotation(turn, 3, 'Z') @ Vector((0, length / 2, 0)), rot=(0, 0, turn), parent=root)
    hy, over = length / 2, 0.35
    slope = Vector((w / 2, 0, eave - apex)).normalized()  # down the +x slope
    for s in (1, -1):
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('UVMap')
        run = Vector((s * slope.x, 0, slope.z))
        top, foot = Vector((0, 0, apex + 0.02)), Vector((0, 0, apex + 0.02)) + run * ((w / 2 + over) / slope.x)
        quad = [top + Vector((0, -hy - over, 0)), top + Vector((0, hy + over, 0)), foot + Vector((0, hy + over, 0)), foot + Vector((0, -hy - over, 0))]
        face = bm.faces.new([bm.verts.new(p) for p in quad])
        for loop, c in zip(face.loops, ((0, 0), (length + 2 * over, 0), (length + 2 * over, (foot - top).length), (0, (foot - top).length))):
            loop[uv].uv = c
        obj_from_bm('roof slope', bm, M['shingle'], parent=house, smooth=False)
        # the white board along the gable's rake
        beam('rake board', top + Vector((0, hy + over, -0.07)), foot + Vector((0, hy + over, -0.07)), (0.03, 0.10), M['trim'], parent=house)
    # the gable wall and the wall under it, shingled
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    pts = [(-w / 2, hy, GROUND), (w / 2, hy, GROUND), (w / 2, hy, eave), (0, hy, apex), (-w / 2, hy, eave)]
    face = bm.faces.new([bm.verts.new(p) for p in pts])
    for loop in face.loops:
        loop[uv].uv = (loop.vert.co.x, loop.vert.co.z)
    obj_from_bm('gable wall', bm, M['gable'], parent=house, smooth=False)
    box('house body', (w - 0.02, length - 0.02, eave - GROUND), (0, 0, (eave + GROUND) / 2), M['gable'], parent=house)
    # the attic window: tall and narrow, in a white frame
    wz = apex - 1.25
    box('attic frame', (0.62, 0.05, 1.0), (0, hy + 0.02, wz), M['trim'], parent=house, bevel=0.004)
    box('attic pane', (0.46, 0.02, 0.84), (0, hy + 0.045, wz), M['window lit' if lit else 'window dark'], parent=house)
    box('attic bar', (0.46, 0.03, 0.035), (0, hy + 0.05, wz), M['trim'], parent=house)
    # the yellow building behind: flat-roofed, a row of windows under its eaves, one or two lit
    bx, by, bw, bh = 9.5, -30.0, 12.0, 4.6
    box('yellow building', (bw, 8, bh - GROUND), (bx, by, (bh + GROUND) / 2), M['yellow'], parent=root)
    box('yellow eaves', (bw + 0.5, 8.5, 0.22), (bx, by, bh + 0.11), M['trim'], parent=root)
    for k in range(10):
        wx = bx - bw / 2 + (k + 0.5) * bw / 10
        box('yellow window frame', (0.62, 0.06, 0.86), (wx, by + 4.02, bh - 0.85), M['trim'], parent=root)
        box('yellow window', (0.5, 0.04, 0.74), (wx, by + 4.05, bh - 0.85), M['window lit' if k in ((2, 3, 7) if lit else (7,)) else 'window dark'], parent=root)
    # the fence at the end of the garden: weathered grey boards, one stretch newer
    box('fence', (16, 0.04, 1.8), (-2.0, -11.5, GROUND + 0.9), M['fence'], parent=root)
    box('fence, new boards', (4.5, 0.045, 1.85), (-1.0, -11.48, GROUND + 0.925), M['fence new'], parent=root)


# ---------------------------------------------------------------------------------------------
# The trees. Each species is a habit (a function that grows one plant) and a table of what it
# looks like in each season; SPECIES lists them and PLANTED says where each plant stands. To
# change a tree for another, write its habit and its table and name it in PLANTED.
# ---------------------------------------------------------------------------------------------

KITS = {}  # what a species' plants share (its materials, the small meshes they are clothed in), made once


def kit_of(name, make):
    if name not in KITS:
        KITS[name] = make()
    return KITS[name]


def foliage(name, col, through=0.3, rough=0.5):
    """A leaf's surface: `col` is its colour (a socket of the Nodes `name` wraps), and some of
    the light that falls on it passes through."""
    n = name
    n.set(Base_Color=col, Roughness=rough, Specular_IOR_Level=0.35)
    thru = n.node('ShaderNodeBsdfTranslucent', {'Color': col})
    both = n.node('ShaderNodeMixShader', {0: through, 1: n.bsdf.outputs[0], 2: thru.outputs[0]})
    n.nt.links.new(both.outputs[0], n.out.inputs['Surface'])
    return n.mat


def bark(name, dark, light, scale=(9, 9, 1.6)):
    """Furrowed bark, darker when the rain has wet it."""
    n = Nodes(name)
    ridges = n.noise(n.mapping(n.coords(), scale), 1.0, 5.0, 0.65, 1.5)
    k = 0.6 if NOW['wet'] else 1.0
    n.set(Base_Color=n.ramp(ridges, [(0.3, tuple(c * k for c in dark)), (0.7, tuple(c * k for c in light))]), Roughness=0.55 if NOW['wet'] else 0.9)
    n.bump(ridges, 1.0, 0.02)
    return n.mat


def grow_wood(rng, base, lean, r0, LEN, BEND, RISE, boughs, twig_level=4, split=(18, 38)):
    """A tree's wood, grown branch by branch: a trunk, the boughs that leave it (each: how far
    up the trunk, compass direction from +x, lean from upright, thickness), and each branch
    forking again and again down to twigs. LEN, BEND and RISE give, for each level of
    branching, a branch's length, how much it wanders and whether it reaches up or hangs.
    Returns the wood as a bmesh and the centre lines of its twigs, where the leaves go."""
    bm = bmesh.new()
    twigs = []
    last = len(LEN) - 1

    def gauss3():
        return Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))

    def fork(d, degrees):
        axis = Matrix.Rotation(rng.uniform(0, 2 * math.pi), 3, d) @ d.orthogonal().normalized()
        return (Matrix.Rotation(rad(degrees), 3, axis) @ d).normalized()

    def skin(path):
        """Wrap a tube round a branch's centre line."""
        r_first = path[0][1]
        sides = 14 if r_first > 0.12 else 9 if r_first > 0.05 else 6 if r_first > 0.02 else 4
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
        path = [(pos.copy(), r * (1.5 if level == 0 else 1.0))]
        r_end = r * 0.7
        for i in range(n):
            d = (d + gauss3() * BEND[level] + Vector((0, 0, RISE[level]))).normalized()
            if pos.y > CLEAR - 0.65:  # the house is in the way: wood near it turns aside, as a pruned tree's does
                d = (d + Vector((0, -0.5 * (pos.y - CLEAR + 0.65) - 0.15, 0))).normalized()
            pos = pos + d * (L / n)
            if pos.y > CLEAR:
                break
            rr = r + (r_end - r) * (i + 1) / n
            if level == 0 and i == 0:
                rr = r * 1.15  # the flare at the root
            path.append((pos.copy(), rr))
            if 1 <= level < last and 1 <= i < n - 1 and rr > 0.011 and rng.random() < 0.5:
                grow(pos, fork(d, rng.uniform(40, 75)), rr * rng.uniform(0.45, 0.6), level + 1)
        skin(path)
        if level >= twig_level:
            twigs.append(path)
        if not forks:
            return path
        if r_end < 0.010 or level >= last:
            if level < twig_level:
                twigs.append(path)
            return path
        k = 2 if rng.random() < 0.7 else 3
        for _ in range(k):
            grow(pos, fork(d, rng.uniform(*split)), r_end * (0.8 if k == 2 else 0.7), level + 1)
        return path

    trunk = grow(base.copy(), Vector(lean).normalized(), r0, 0, forks=False)
    for frac, az, tip, r in boughs:
        i = min(int(frac * (len(trunk) - 1)), len(trunk) - 1)
        d = Vector((math.cos(rad(az)) * math.sin(rad(tip)), math.sin(rad(az)) * math.sin(rad(tip)), math.cos(rad(tip))))
        grow(trunk[i][0].copy(), d, r, 1)
    return bm, twigs


def hang(d, rng):
    """How a thing that hangs along `d` is turned: its length along d, turned about d at random."""
    side = d.orthogonal().normalized()
    side = (Matrix.Rotation(rng.uniform(0, 6.28), 3, d) @ side).normalized()
    return axes_euler(d, side, d.cross(side))


def juniper(name, state, at, parent, seed=1, top=2.2, leaders=5, spread=1.0):
    """A juniper of the twisted kind (as Juniperus chinensis 'Torulosa'): several leaders from
    one foot, each leaning its own way and turning as it climbs, clothed in dense tufts that
    wind round it, bright at their tips and dark within, thinning to a whip at the top; the
    reddish stem shows where the tufts leave it bare."""
    def make():
        n = Nodes(name + ' foliage')
        uv = n.node('ShaderNodeSeparateXYZ', {0: n.coords('UV')})
        rnd = n.node('ShaderNodeObjectInfo').outputs['Random']
        inner = n.ramp(n.math('ADD', n.math('MULTIPLY', rnd, 0.8), n.math('MULTIPLY', uv.outputs[0], 0.2)),
                       [(0.0, (0.04, 0.10, 0.03)), (0.6, (0.09, 0.20, 0.05)), (1.0, (0.15, 0.29, 0.07))])
        tip_col, reach = state['tips']
        col = n.mix(n.math('MULTIPLY', n.math('POWER', uv.outputs[1], 1.6), reach), inner, rgba(tip_col))
        rng = random.Random(3)
        return {'tufts': [tuft(name + ' tuft', rng, foliage(n, col, 0.4, 0.55), parent) for _ in range(4)],
                'stem': bark(name + ' bark', (0.05, 0.02, 0.012), (0.20, 0.085, 0.045), (14, 14, 2.5)),
                'core': pbr(name + ' shade', (0.006, 0.013, 0.006), 0.95)}
    kit = kit_of(name, make)
    rng = random.Random(seed)
    stems, core = bmesh.new(), bmesh.new()
    P, R, S = [], [], []
    z0 = 0.5  # where the leaders part, above the foot

    def spire(start, out, h, lean, fat, stem_r, low):
        """One leader, or one of the arms that leave it: a line that leans along `out`, winds as
        it climbs h metres, and is clothed from `low` (a share of its length) up."""
        turns, wob, ph = rng.uniform(0.8, 1.7) * rng.choice((-1, 1)), rng.uniform(0.10, 0.26) * min(1.0, h / 3), rng.uniform(0, 6.28)
        bands, ph2 = rng.uniform(1.2, 2.2) * h, rng.uniform(0, 6.28)

        def path(t):
            a = ph + 2 * math.pi * turns * t
            return start + out * (lean * h * t * (1 - 0.35 * t)) + Vector((math.cos(a) - math.cos(ph), math.sin(a) - math.sin(ph), 0)) * (wob * t) + Vector((0, 0, h * t))

        def girth(t):
            """How far the tufts stand from the stem: full low down, in bulges, a whip at the tip."""
            return max(0.03, fat * (1 - t) ** 0.55 * (0.6 + 0.4 * math.sin(2 * math.pi * bands * t / 4 + ph2)))

        if path(1.0).y > CLEAR or path(0.5).y > CLEAR:
            return path
        for _ in range(round(1500 * 2 * math.pi * fat * 0.55 * h * (1 - low))):
            t = low + (1 - low) * rng.random()
            g = girth(t)
            if rng.random() > g / fat + 0.1:
                continue
            a = rng.uniform(0, 6.28)
            radial = Vector((math.cos(a), math.sin(a), 0))
            if radial.y < -0.45:
                continue  # the far side, which the room never sees
            tang = (path(min(1.0, t + 0.02)) - path(max(0.0, t - 0.02))).normalized()
            p = path(t) + radial * (g * rng.uniform(0.35, 0.9))
            if p.y > CLEAR + 0.1 or p.z < LOW:
                continue
            # a tuft reaches up along the leader and out from it, and round it the way the leader turns
            ax = (tang * rng.uniform(0.6, 1.0) + radial * rng.uniform(0.4, 0.9) + tang.cross(radial) * (0.4 * (1 if turns > 0 else -1))
                  + Vector((rng.gauss(0, 0.2), rng.gauss(0, 0.2), rng.gauss(0, 0.2)))).normalized()
            P.append(p), R.append(hang(ax, rng)), S.append(rng.uniform(0.15, 0.25) * (0.55 + 0.45 * g / fat))
        rings_s, rings_c = [], []
        for i in range(25):
            t = i / 24
            c = path(t)
            rs, rc = stem_r * (1 - 0.85 * t) + 0.005, max(0.0, girth(t) * 0.62 - 0.07)
            rings_s.append([stems.verts.new(c + Vector((math.cos(2 * math.pi * j / 7), math.sin(2 * math.pi * j / 7), 0)) * rs) for j in range(7)])
            if t >= low * 0.8 and rc > 0.01:
                rings_c.append([core.verts.new(c + Vector((math.cos(2 * math.pi * j / 8), math.sin(2 * math.pi * j / 8), 0)) * rc) for j in range(8)])
        for rings, bm, m in ((rings_s, stems, 7), (rings_c, core, 8)):
            for a, b in zip(rings, rings[1:]):
                for j in range(m):
                    bm.faces.new((a[j], a[(j + 1) % m], b[(j + 1) % m], b[j]))
        return path

    for k in range(leaders):
        az = 2 * math.pi * k / leaders + rng.uniform(-0.5, 0.5)
        out = Vector((math.cos(az), math.sin(az), 0))
        h = (top if k == 0 else top - rng.uniform(0.25, 1.5)) - at.z - z0
        lean = math.tan(rad(rng.uniform(4, 20) * spread)) * (0.4 if k == 0 else 1.0)
        low = max(0.0, (LOW - at.z - z0) / h)
        path = spire(at + out * 0.12 + Vector((0, 0, z0)), out, h, lean, rng.uniform(0.28, 0.40), 0.05, low)
        # the arms: short spires that leave the leader, lean out and turn up like flames
        for _ in range(rng.randint(2, 4)):
            t = rng.uniform(max(low, 0.3), 0.85)
            a = rng.uniform(0, 6.28)
            spire(path(t), Vector((math.cos(a), math.sin(a), 0)), rng.uniform(0.5, 1.1) * (1.15 - t), rng.uniform(0.5, 1.1), rng.uniform(0.16, 0.24), 0.02, 0.0)
    obj_from_bm(name + ' stems', stems, kit['stem'], parent=parent, sharp=80)
    obj_from_bm(name + ' shade', core, kit['core'], parent=parent, sharp=180)
    scatter(name + ' tufts', kit['tufts'], P, R, S, parent)
    return len(P)


def walnut(name, state, at, parent, seed=7):
    """The deciduous tree, taken for a walnut: a tall trunk, an open crown of rising boughs and
    coarse twigs, and on the twigs long pinnate leaves as the season has them: `leaves` is the
    share that are out, `bare_above` the height over which the upper crown has already dropped
    its own, `catkins` whether the spring's hang from it."""
    def make():
        n = Nodes(name + ' leaf')
        uv = n.node('ShaderNodeSeparateXYZ', {0: n.coords('UV')})
        rnd = n.node('ShaderNodeObjectInfo').outputs['Random']
        which = n.math('ADD', n.math('MULTIPLY', rnd, 0.78), n.math('MULTIPLY', uv.outputs[0], 0.22))
        leaf = foliage(n, n.ramp(which, state['leaf']), 0.42, 0.45)
        rng = random.Random(5)
        n = Nodes(name + ' catkin')
        cat = foliage(n, (0.20, 0.26, 0.05, 1), 0.2, 0.6)
        return {'leaves': [compound_leaf(name + ' leaf', pairs, rng, leaf, parent, leaflet=0.17, width=0.062, droop=(0.15, 0.35), start=0.14) for pairs in (6, 7, 8, 9)],
                'catkins': [cluster(name + ' catkin', rng, cat, parent, n=26, spread=0.05, bead=0.07) for _ in range(2)],
                'bark': bark(name + ' bark', (0.022, 0.018, 0.015), (0.10, 0.085, 0.07))}
    kit = kit_of(name, make)
    rng = random.Random(seed)
    bm, twigs = grow_wood(rng, at, (0.03, 0.04, 1), 0.21,
                          LEN=[5.6, 2.6, 1.9, 1.35, 0.95, 0.65], BEND=[0.02, 0.09, 0.13, 0.17, 0.2, 0.24], RISE=[0.0, 0.14, 0.09, 0.05, 0.0, -0.05],
                          boughs=((0.72, 200, 58, 0.10), (0.80, 40, 52, 0.105), (0.88, 110, 46, 0.10), (0.94, 300, 44, 0.105), (1.0, 170, 26, 0.115), (1.0, 20, 18, 0.125)))
    obj_from_bm(name + ' wood', bm, kit['bark'], parent=parent, sharp=80)
    P, R, S, CP, CR, CS = [], [], [], [], [], []
    lo, hi = state.get('bare_above', (99, 100))
    for path in twigs:
        for (a, _), (b, rb) in zip(path, path[1:]):
            along = (b - a).normalized()
            for _ in range(3 if rb < 0.012 else 2):
                p = a.lerp(b, rng.random())
                if p.y > CLEAR:
                    continue
                if rng.random() < state['leaves'] * min(1.0, max(0.0, (hi - p.z) / (hi - lo))):
                    d = (along * 0.6 + Vector((rng.gauss(0, 0.6), rng.gauss(0, 0.6), rng.gauss(0, 0.6))) + Vector((0, 0, -0.25))).normalized()
                    up = (Vector((rng.gauss(0, 0.4), rng.gauss(0, 0.4), 1))).normalized()
                    side = up.cross(d).normalized()
                    P.append(p), R.append(axes_euler(d, side, d.cross(side))), S.append(rng.uniform(0.28, 0.42) * state['leaf_size'])
                if state.get('catkins') and rng.random() < 0.3:
                    d = (Vector((0, 0, -1)) + Vector((rng.gauss(0, 0.15), rng.gauss(0, 0.15), 0))).normalized()
                    CP.append(p), CR.append(hang(d, rng)), CS.append(rng.uniform(0.07, 0.12))
    scatter(name + ' leaves', kit['leaves'], P, R, S, parent)
    scatter(name + ' catkins', kit['catkins'], CP, CR, CS, parent)
    return len(P)


def pepper(name, state, at, parent, seed=11):
    """A pepper tree (as Schinus molle): a thick gnarled trunk and heavy limbs that twist and
    spread, and from every twig long branchlets of fine feathery leaves that hang straight
    down in curtains, as a willow's do. `berries` is how much of it carries hanging bunches of
    small pink-red berries."""
    def make():
        n = Nodes(name + ' leaf')
        uv = n.node('ShaderNodeSeparateXYZ', {0: n.coords('UV')})
        rnd = n.node('ShaderNodeObjectInfo').outputs['Random']
        col = n.ramp(n.math('ADD', n.math('MULTIPLY', rnd, 0.7), n.math('MULTIPLY', uv.outputs[0], 0.3)),
                     [(0.0, (0.045, 0.085, 0.048)), (0.6, (0.085, 0.15, 0.08)), (1.0, (0.15, 0.22, 0.11))])
        leaf = foliage(n, col, 0.3, 0.5)
        n = Nodes(name + ' berry')
        n.set(Base_Color=n.ramp(n.node('ShaderNodeObjectInfo').outputs['Random'], [(0.0, (0.40, 0.07, 0.07)), (1.0, (0.55, 0.16, 0.14))]), Roughness=0.4)
        rng = random.Random(9)
        return {'streamers': [streamer(name + ' branchlet', rng, leaf, parent) for _ in range(4)],
                'berries': [cluster(name + ' berries', rng, n.mat, parent) for _ in range(2)],
                'bark': bark(name + ' bark', (0.012, 0.010, 0.009), (0.065, 0.05, 0.04), (5, 5, 1.2))}
    kit = kit_of(name, make)
    rng = random.Random(seed)
    bm, twigs = grow_wood(rng, at, (-0.06, 0.08, 1), 0.42,
                          LEN=[3.6, 2.8, 2.1, 1.4, 0.9], BEND=[0.05, 0.2, 0.26, 0.3, 0.32], RISE=[0.0, 0.10, 0.03, -0.04, -0.14],
                          boughs=((0.62, 30, 66, 0.19), (0.75, 160, 62, 0.20), (0.85, 265, 60, 0.17), (0.93, 95, 50, 0.19), (1.0, 330, 38, 0.2), (1.0, 205, 30, 0.22)),
                          twig_level=3, split=(25, 50))
    obj_from_bm(name + ' wood', bm, kit['bark'], parent=parent, sharp=80)
    P, R, S, BP, BR, BS = [], [], [], [], [], []
    for path in twigs:
        for (a, _), (b, rb) in zip(path, path[1:]):
            for _ in range(3):
                p = a.lerp(b, rng.random())
                if p.z < LOW + 0.5:
                    continue
                d = (Vector((0, 0, -1)) + Vector((rng.gauss(0, 0.08), rng.gauss(0, 0.08), 0))).normalized()
                P.append(p), R.append(hang(d, rng)), S.append(rng.uniform(0.9, 2.1))
                if rng.random() < state['berries']:
                    q = p + d * rng.uniform(0.1, 0.9)
                    BP.append(q), BR.append(hang(d, rng)), BS.append(rng.uniform(0.12, 0.2))
    scatter(name + ' branchlets', kit['streamers'], P, R, S, parent)
    scatter(name + ' berries', kit['berries'], BP, BR, BS, parent)
    return len(P)


# The species: how each grows, whether it keeps its leaves, and its state in each season (what
# the habit reads from `state`).
YELLOWING = [(0.0, (0.07, 0.15, 0.02)), (0.3, (0.20, 0.26, 0.03)), (0.65, (0.46, 0.40, 0.045)), (0.9, (0.56, 0.42, 0.04)), (1.0, (0.42, 0.24, 0.04))]
SPECIES = {
    'juniper': {'habit': juniper, 'evergreen': True, 'seasons': {
        'spring': {'tips': ((0.50, 0.72, 0.14), 0.95)},  # the new growth is at its brightest
        'summer': {'tips': ((0.36, 0.55, 0.11), 0.85)},
        'autumn': {'tips': ((0.34, 0.52, 0.10), 0.8)},
        'winter': {'tips': ((0.30, 0.47, 0.10), 0.75)},
    }},
    'walnut': {'habit': walnut, 'evergreen': False, 'seasons': {
        # late into leaf: in spring the leaves are small and few, with the catkins still hanging
        'spring': {'leaves': 0.8, 'leaf_size': 0.62, 'catkins': True,
                   'leaf': [(0.0, (0.10, 0.22, 0.03)), (0.6, (0.16, 0.30, 0.045)), (1.0, (0.27, 0.36, 0.07))]},
        'summer': {'leaves': 1.0, 'leaf_size': 1.0,
                   'leaf': [(0.0, (0.025, 0.07, 0.014)), (0.55, (0.05, 0.12, 0.02)), (0.9, (0.09, 0.16, 0.026)), (1.0, (0.16, 0.19, 0.035))]},
        # it turns a clear yellow and drops early, from the top down
        'autumn': {'leaves': 0.6, 'leaf_size': 0.95, 'bare_above': (2.4, 4.6), 'leaf': YELLOWING},
        'winter': {'leaves': 0.012, 'leaf_size': 0.8, 'leaf': [(0.0, (0.30, 0.20, 0.05)), (1.0, (0.16, 0.09, 0.04))]},
    }},
    'pepper': {'habit': pepper, 'evergreen': True, 'seasons': {
        'spring': {'berries': 0.0}, 'summer': {'berries': 0.04}, 'autumn': {'berries': 0.5}, 'winter': {'berries': 0.4},
    }},
}
# Where each plant stands (its foot, on the ground below), and what is its own.
PLANTED = (
    ('walnut', (1.3, -6.0), {}),
    ('pepper', (-4.6, -10.5), {}),
    ('juniper', (1.9, -3.3), {'seed': 1, 'top': 1.75, 'leaders': 4}),
    ('juniper', (0.9, -2.8), {'seed': 2, 'top': 2.5, 'leaders': 5}),
    ('juniper', (-0.2, -3.2), {'seed': 3, 'top': 2.05, 'leaders': 5}),
    ('juniper', (-1.2, -2.9), {'seed': 4, 'top': 2.9, 'leaders': 6}),
    ('juniper', (-2.3, -3.3), {'seed': 5, 'top': 2.2, 'leaders': 5}),
    ('juniper', (-3.3, -2.9), {'seed': 6, 'top': 2.6, 'leaders': 5, 'spread': 1.5}),
    ('juniper', (-4.4, -3.4), {'seed': 7, 'top': 3.1, 'leaders': 6}),
)


def trees():
    root = empty('trees')
    for name, (x, y), own in PLANTED:
        species = SPECIES[name]
        n = species['habit'](name, species['seasons'][SEASON], Vector((x, y, GROUND)), root, **own)
        print(f'{name} at ({x}, {y}): {n} pieces of foliage')
    return root


def outdoor_materials():
    wet = NOW['wet']
    dim = 0.72 if wet else 1.0  # rain darkens what it soaks

    # a dry fallen leaflet: tan to brown, a few still yellow
    n = Nodes('dry leaf')
    rnd = n.node('ShaderNodeObjectInfo').outputs['Random']
    n.set(Base_Color=n.ramp(rnd, [(0.0, (0.45 * dim, 0.36 * dim, 0.06)), (0.2, (0.36 * dim, 0.22 * dim, 0.09)), (0.6, (0.25 * dim, 0.14 * dim, 0.07)), (1.0, (0.12, 0.07, 0.04))]),
          Roughness=0.35 if wet else 0.7)
    M['dry leaf'] = n.mat

    # artificial turf: short dark blades, a pile that leans this way and that
    n = Nodes('turf')
    co = n.coords()
    pile = n.noise(co, 2.5, 3.0, 0.6)
    blades = n.noise(n.mapping(co, (900, 300, 300)), 1.0, 2.0, 0.7)
    n.set(Base_Color=n.mix(n.math('MULTIPLY', blades, 0.6), n.ramp(pile, [(0.3, (0.010 * dim, 0.030 * dim, 0.012 * dim)), (0.7, (0.022 * dim, 0.055 * dim, 0.020 * dim))]),
                           (0.045 * dim, 0.085 * dim, 0.03 * dim, 1)),
          Roughness=n.ramp(pile, [(0.35, (0.22,) * 3), (0.6, (0.6,) * 3)]) if wet else 0.8, Sheen_Weight=0.4, Sheen_Roughness=0.6, Specular_IOR_Level=0.5 if wet else 0.2)
    n.bump(blades, 1.0, 0.004)
    M['turf'] = n.mat

    # fibre-cement lap siding, painted beige: a faint embossed grain along each board
    n = Nodes('siding')
    uv = n.coords('UV')
    grain = n.noise(n.mapping(uv, (3, 220, 1)), 1.0, 3.0, 0.6)
    weather = n.noise(uv, 1.3, 3.0, 0.6)
    n.set(Base_Color=n.mix(n.math('MULTIPLY', weather, 0.35), (0.36 * dim, 0.28 * dim, 0.185 * dim, 1), (0.27 * dim, 0.21 * dim, 0.14 * dim, 1)), Roughness=0.5 if wet else 0.75)
    n.bump(grain, 0.35, 0.0015)
    M['siding'] = n.mat
    M['trim'] = pbr('white trim', (0.70, 0.70, 0.68), 0.55, grain=0.1, grain_scale=300)
    # the cap's top lies open to the sky: after rain it holds a film of water, in patches
    n = Nodes('cap paint')
    film = n.noise(n.coords(), 5.0, 3.0, 0.6)
    n.set(Base_Color=(0.70 * dim, 0.70 * dim, 0.68 * dim, 1), Roughness=n.ramp(film, [(0.4, (0.06,) * 3), (0.62, (0.4,) * 3)]) if wet else 0.55)
    n.bump(n.noise(n.coords(), 300.0, 2.0, 0.6), 0.1, 0.0003)
    M['cap'] = n.mat
    M['soil'] = pbr('pebble bed', (0.03, 0.022, 0.016), 0.3 if wet else 0.95)

    # river pebbles: white, some cream or grey, smooth; glossy and a shade darker when wet
    n = Nodes('pebble')
    rnd = n.node('ShaderNodeObjectInfo').outputs['Random']
    n.set(Base_Color=n.ramp(rnd, [(0.0, (0.52 * dim, 0.47 * dim, 0.40 * dim)), (0.25, (0.74 * dim, 0.72 * dim, 0.68 * dim)), (0.8, (0.80 * dim, 0.79 * dim, 0.76 * dim)),
                                  (1.0, (0.56 * dim, 0.56 * dim, 0.57 * dim))]), Roughness=0.12 if wet else 0.5)
    n.bump(n.noise(n.coords(), 60.0, 2.0, 0.6), 0.15, 0.002)
    M['pebble'] = n.mat

    def shingles(name, light, dark):
        """Courses of shingles (the texture coordinates are metres along and up the surface)."""
        n = Nodes(name)
        uv = n.coords('UV')
        tiles = n.node('ShaderNodeTexBrick', {'Vector': uv, 'Color1': rgba(tuple(c * dim for c in light)), 'Color2': rgba(tuple(c * dim for c in dark)),
                                              'Mortar': rgba(tuple(c * 0.35 for c in dark)), 'Scale': 1.0, 'Mortar Size': 0.006, 'Bias': 0.0, 'Brick Width': 0.24, 'Row Height': 0.15})
        worn = n.noise(uv, 1.1, 4.0, 0.65)
        n.set(Base_Color=n.mix(n.math('MULTIPLY', worn, 0.5), tiles.outputs['Color'], rgba(tuple(c * 0.55 * dim for c in dark))),
              Roughness=n.ramp(worn, [(0.3, (0.2,) * 3), (0.7, (0.5,) * 3)]) if wet else 0.85)
        n.bump(tiles.outputs['Fac'], 0.6, 0.004)
        return n.mat

    M['shingle'] = shingles('roof shingles', (0.085, 0.09, 0.10), (0.05, 0.055, 0.065))
    M['gable'] = shingles('gable shingles', (0.10, 0.115, 0.14), (0.07, 0.08, 0.10))
    M['yellow'] = pbr('yellow wall', (0.40 * dim, 0.27 * dim, 0.07), 0.85, grain=0.1, grain_scale=40)
    M['fence'] = pbr('fence boards', (0.16 * dim, 0.15 * dim, 0.14 * dim), 0.9)
    M['fence new'] = pbr('new fence boards', (0.42 * dim, 0.22 * dim, 0.09 * dim), 0.8)
    M['window lit'] = pbr('lit window', (0.1, 0.08, 0.05), 0.5, Emission_Color=(1.0, 0.62, 0.28), Emission_Strength=3.0)
    M['window dark'] = pbr('dark window', (0.01, 0.012, 0.016), 0.1)


def sky():
    """Dusk, a little after sunset, as the season has it: a band of colour low down where the sun
    went (to the left of where the seat looks, behind the neighbour's roof), the sky deepening
    above it, and cloud: thin level streaks most of the year, a low grey lid in the rainy winter."""
    spec = NOW['sky']
    w = bpy.data.worlds.new('dusk')
    w.use_nodes = True
    nt = w.node_tree
    new, link = nt.nodes.new, nt.links.new
    co = new('ShaderNodeTexCoord')
    sep = new('ShaderNodeSeparateXYZ')
    link(co.outputs['Generated'], sep.inputs[0])
    ramp = new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    stops = spec['ramp']
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
    dot.inputs[1].default_value = Vector((0.52, -0.85, 0.04)).normalized()
    link(co.outputs['Generated'], dot.inputs[0])
    glow = new('ShaderNodeMath')
    glow.operation = 'POWER'
    glow.use_clamp = True
    glow.inputs[1].default_value = 5.0
    link(dot.outputs['Value'], glow.inputs[0])
    warm = new('ShaderNodeMix')
    warm.data_type, warm.blend_type = 'RGBA', 'ADD'
    warm.inputs[7].default_value = (*spec['glow'], 1)
    link(glow.outputs[0], warm.inputs[0])
    link(ramp.outputs['Color'], warm.inputs[6])
    # the cloud: stretched level into streaks, or left as it is for an overcast
    lo, hi, colour, stretch = spec['cloud']
    mp = new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1.2, 1.2, stretch)
    link(co.outputs['Generated'], mp.inputs['Vector'])
    noise = new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value, noise.inputs['Detail'].default_value = 2.2, 5.0
    link(mp.outputs[0], noise.inputs['Vector'])
    cloud = new('ShaderNodeValToRGB')
    cloud.color_ramp.elements[0].position, cloud.color_ramp.elements[1].position = lo, hi
    cloud.color_ramp.elements[1].color = (0.35, 0.35, 0.35, 1) if stretch > 5 else (0.8, 0.8, 0.8, 1)
    link(noise.outputs['Fac'], cloud.inputs['Fac'])
    hazy = new('ShaderNodeMix')
    hazy.data_type = 'RGBA'
    hazy.inputs[7].default_value = (*colour, 1)
    link(cloud.outputs['Color'], hazy.inputs[0])
    link(warm.outputs[2], hazy.inputs[6])
    bg = nt.nodes['Background']
    link(hazy.outputs[2], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = SKY_STRENGTH * spec['strength']
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

    M['coffee'] = pbr('coffee', (0.03, 0.014, 0.006), 0.03)
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


def ball(name, size, at, mat, parent, rot=(0, 0, 0), cuts=3, lumps=0.0, seed=0):
    """A rounded form `size` across in x, y and z: a head, a paw, a bead. `lumps` makes it
    uneven, as stuffing does."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=cuts, radius=0.5)
    rng = random.Random(seed)
    ph = [rng.uniform(0, 6.28) for _ in range(3)]
    for v in bm.verts:
        c = v.co
        k = 1 + lumps * (math.sin(5 * c.x + ph[0]) * math.sin(4 * c.y + ph[1]) + 0.6 * math.sin(6 * c.z + ph[2]))
        v.co = Vector((c.x * k * size[0], c.y * k * size[1], c.z * k * size[2]))
    return obj_from_bm(name, bm, mat, at=at, rot=rot, parent=parent, sharp=180)


def flat_shape(name, outline, thick, mat, at=(0, 0, 0), rot=(0, 0, 0), parent=None):
    """A piece cut from a sheet: `outline` (x, y points, anticlockwise) raised `thick` along z."""
    bm = bmesh.new()
    lower = [bm.verts.new((x, y, 0)) for x, y in outline]
    upper = [bm.verts.new((x, y, thick)) for x, y in outline]
    n = len(outline)
    for i in range(n):
        bm.faces.new((lower[i], lower[(i + 1) % n], upper[(i + 1) % n], upper[i]))
    bm.faces.new(list(reversed(lower)))
    bm.faces.new(upper)
    return obj_from_bm(name, bm, mat, at=at, rot=rot, parent=parent, smooth=False)


def lettering(lines, font_path, squeeze=1.0, shear=0.0, edge=0.006, fatten=0.0, weld=0.00012):
    """Words as a flat mesh in the xy plane, from a font's own outlines (Blender's sans when the
    font file is missing). `lines` are (words, size, x, y, tilt); `fatten` thickens every
    stroke by that share of the size; long edges are cut so the mesh can afterwards be bent
    onto a curved surface; `weld` is how close two points of an outline may lie before they are made one."""
    font = bpy.data.fonts.load(font_path) if os.path.exists(font_path) else None
    bm = bmesh.new()
    for words, size, x, y, tilt in lines:
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body, cu.size, cu.align_x, cu.align_y, cu.shear = words, size, 'CENTER', 'CENTER', shear
        cu.resolution_u = 2  # few points to a curve: the letters are small
        cu.offset = fatten
        if font:
            cu.font = font
        o = bpy.data.objects.new('t', cu)
        COLL.objects.link(o)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
        me.transform(Matrix.Translation((x, y, 0)) @ Matrix.Rotation(tilt, 4, 'Z') @ Matrix.Diagonal((squeeze, 1, 1, 1)))
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        bpy.data.objects.remove(o)
        bpy.data.curves.remove(cu)
    # a rough face's outline has far more points than letters this small can show: weld the
    # closest and drop those that hardly turn the outline, then cut into triangles
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    bmesh.ops.dissolve_limit(bm, angle_limit=rad(14), verts=bm.verts, edges=bm.edges, delimit=set())
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.subdivide_edges(bm, edges=[e for e in bm.edges if e.calc_length() > edge], cuts=1)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def rounded(points, rounds=2):
    """A closed outline with its corners cut round (each round cuts every corner once)."""
    for _ in range(rounds):
        cut = []
        for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
            cut += [(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25), (ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75)]
        points = cut
    return points


def ring(name, across, thick, at, rot, mat, parent, seg=36, sides=6):
    """A ring `across` wide (to the middle of its cord) of a cord `thick` wide, lying in its own xy plane."""
    bm = bmesh.new()
    loops = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        loops.append([bm.verts.new(((across / 2 + thick / 2 * math.cos(2 * math.pi * k / sides)) * math.cos(a),
                                    (across / 2 + thick / 2 * math.cos(2 * math.pi * k / sides)) * math.sin(a), thick / 2 * math.sin(2 * math.pi * k / sides))) for k in range(sides)])
    for i in range(seg):
        a, b = loops[i], loops[(i + 1) % seg]
        for k in range(sides):
            bm.faces.new((a[k], b[k], b[(k + 1) % sides], a[(k + 1) % sides]))
    return obj_from_bm(name, bm, mat, at=at, rot=rot, parent=parent, sharp=180)


def facing_turn(at):
    """The turn about the upright that makes a thing at `at` on the desk, whose front is its +y, face who looks at it."""
    return math.atan2(-(LOOKER[0] - at[0]), LOOKER[1] - at[1])


def mug():
    """A keepsake: a glossy mid-blue mug, nine and a half centimetres tall. Its wall is nearly
    straight for the upper two thirds, opening a little to the rim; below a pinch it swells
    into a round bulge, the widest part, and draws in to the foot. The handle is one thick
    round bar bent at a corner: from just under the rim out and down, then back in to the top
    of the bulge. On the front, with the handle to its left, white lettering in two lines that
    lean forward and climb a little: rough brush capitals. The lettering is a font's outlines
    laid on the glaze (ROOM_FONT, a rough brush face): a stand-in until the real wrap is
    painted. The side turned away is plain."""
    blue = pbr('mug glaze', (0.08, 0.16, 0.60), 0.05, Coat_Weight=0.8, Coat_Roughness=0.02)
    seat = math.atan2(LOOKER[1] - MUG_AT[1], LOOKER[0] - MUG_AT[0])  # the way to who looks at it, from +x
    root = empty('mug', (*MUG_AT, TOP), (0, 0, seat - rad(90)))  # so the lettering, a quarter turn from the handle, faces them
    h = 0.095
    # the outside, as (height, radius): the foot, the bulge, the pinch above it, the nearly straight wall, the rim
    shape = [(0.0, 0.0295), (0.003, 0.0318), (0.007, 0.0352), (0.012, 0.0368), (0.018, 0.0358), (0.024, 0.0334), (0.029, 0.0322), (0.036, 0.0323),
             (0.055, 0.0328), (0.078, 0.0333), (0.090, 0.0337), (h, 0.0339)]

    def wall(zz):
        """The outside radius at a height."""
        for (za, ra), (zb, rb) in zip(shape, shape[1:]):
            if zz <= zb:
                t = (zz - za) / (zb - za)
                return ra + (rb - ra) * t * t * (3 - 2 * t)
        return shape[-1][1]

    outer = [(wall(h * i / 40), h * i / 40) for i in range(41)]
    lathe('mug body', [(0, 0.003), (0.0265, 0.003), (0.0282, 0.0)] + outer
          + [(wall(h) - 0.0013, h + 0.0014), (wall(h) - 0.0030, h + 0.0002)] + [(wall(zz) - 0.0045, zz) for zz in (0.085, 0.06, 0.04, 0.022)] + [(0.028, 0.011), (0, 0.010)],
          blue, parent=root, seg=56)
    lathe('coffee', [(0, 0.078), (wall(0.078) - 0.0046, 0.078)], M['coffee'], parent=root, seg=48)
    # the handle: one round bar through three points, its corner eased
    pts = [Vector((wall(0.083) - 0.004, 0, 0.083)), Vector((0.0610, 0, 0.049)), Vector((wall(0.024) - 0.004, 0, 0.024))]
    for a, b in zip(pts, pts[1:]):
        beam('mug handle', a, b, (0.0135, 0.0098), blue, parent=root, bevel=0.0042)
    cyl('mug handle', 0.0049, 0.0135, pts[1], blue, rot=(rad(90), 0, 0), parent=root, bevel=0.0042, seg=16)
    # the lettering, bent round the wall
    bm = lettering((('ON THE ROAD', 0.0300, 0.001, 0.0525, rad(2.5)), ('HAPPY ANNIVERSARY', 0.0098, 0.001, 0.0385, rad(2.5))), FONT, squeeze=0.86, shear=0.22)
    for v in bm.verts:
        x, zz = v.co.x, v.co.y
        r = wall(zz) + 0.00025
        v.co = Vector((r * math.cos(rad(90) + x / r), r * math.sin(rad(90) + x / r), zz))
    obj_from_bm('mug lettering', bm, pbr('mug lettering', (0.82, 0.82, 0.80), 0.3), parent=root, sharp=180, outward=(0, 0, 0.05))
    return root


def figurine():
    """A keepsake: a small matt vinyl baby figure, four and a half centimetres tall, more than
    half of it head. A wide tan face, smooth, with huge tall eyes (a dark-brown iris filling
    most of each, a small white star in it) that look up and to its left, thin short brows
    high up, a button of a nose, a small smile, and on each cheek a round orange blush with a
    dark squiggle on it. A yellow hood, its skin finely pebbled like a citrus peel, wraps the
    face closely and rises to a point that leans to its right and ends in a dark-brown bow
    with a tiny yellow star above it; a bib of the hood hangs over the chest. The body is one
    flat rounded star, its points the stubby arms and legs, quartered in yellow and dark
    brown. It sits leaning back a little."""
    skin = pbr('figurine skin', (0.80, 0.45, 0.24), 0.45)
    yellow = pbr('figurine yellow', (0.80, 0.56, 0.20), 0.6, grain=1.0, grain_scale=900)
    brown = pbr('figurine brown', (0.075, 0.04, 0.03), 0.5)
    white = pbr('figurine eye white', (0.84, 0.84, 0.82), 0.2)
    iris = pbr('figurine iris', (0.03, 0.011, 0.006), 0.1, Coat_Weight=0.6)
    blush = pbr('figurine blush', (0.78, 0.20, 0.06), 0.5)
    line = pbr('figurine line', (0.03, 0.012, 0.008), 0.5)
    # it looks toward +y; what is on its right (the looker's left) is at +x
    root = empty('figurine', (*FIGURINE_AT, TOP), (rad(-9), 0, facing_turn(FIGURINE_AT)))
    # the body: a rounded star in the upright plane, a point for each limb: (which way, seen from the front, and how long)
    limbs = ((rad(150), 0.0042), (rad(8), 0.0062), (rad(192), 0.0070), (rad(-58), 0.0072))

    def reach(a):
        r = 0.0066
        for way, length in limbs:
            d = (a - way + math.pi) % (2 * math.pi) - math.pi
            r += length * math.exp(-(d / 0.36) ** 2)
        return r

    bz, around, across = 0.0118, 44, 8
    bm = bmesh.new()
    rings = []
    for j in range(1, across):
        lat = math.pi * (j / across - 0.5)
        rings.append([bm.verts.new((-reach(2 * math.pi * i / around) * math.cos(lat) ** 0.55 * math.cos(2 * math.pi * i / around), 0.0046 * math.sin(lat),
                                    reach(2 * math.pi * i / around) * math.cos(lat) ** 0.55 * math.sin(2 * math.pi * i / around))) for i in range(around)])
    back, front = bm.verts.new((0, -0.0046, 0)), bm.verts.new((0, 0.0046, 0))

    def quarter(face):
        """Upper and lower, its right and its left: brown and yellow by turns."""
        c = face.calc_center_median()
        face.material_index = int((c.x > 0) == (c.z > 0))

    for a, b in zip(rings, rings[1:]):
        for i in range(around):
            quarter(bm.faces.new((a[i], a[(i + 1) % around], b[(i + 1) % around], b[i])))
    for i in range(around):
        quarter(bm.faces.new((back, rings[0][(i + 1) % around], rings[0][i])))
        quarter(bm.faces.new((front, rings[-1][i], rings[-1][(i + 1) % around])))
    body = obj_from_bm('figurine body', bm, yellow, at=(0, 0, bz), parent=root, sharp=180)
    body.data.materials.append(brown)
    # the bib: a pointed flap of the hood over the chest
    flat_shape('figurine bib', rounded([(0.0030, 0.0070), (0.0036, 0.0034), (0.0018, 0.0004), (-0.0006, -0.0014), (-0.0030, 0.0002), (-0.0052, 0.0030), (-0.0048, 0.0070)], 1),
               0.0010, yellow, at=(0, 0.0052, bz), rot=(rad(90), 0, 0), parent=root)
    # the head: a wide oval, fuller at the cheeks
    hz = 0.0262
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.5)
    for v in bm.verts:
        full = 1 + 0.10 * max(0.0, -2 * v.co.z) * (1 - abs(2 * v.co.z)) * 4 * 0.5
        v.co = Vector((v.co.x * 0.0198 * full, v.co.y * 0.0184, v.co.z * 0.0196))
    obj_from_bm('figurine head', bm, skin, at=(0, 0.0008, hz), parent=root, sharp=180)
    # the hood round it: close round the face, rising to a point that leans over to its right
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=3, radius=0.5)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.12 and math.hypot(v.co.x * 0.92, v.co.z + 0.05) < 0.44], context='VERTS')
    up = Vector((0.42, -0.06, 0.90)).normalized()
    for v in bm.verts:
        d = max(0.0, v.co.normalized().dot(up) - 0.72) / 0.28
        v.co = v.co + up * (0.22 * d ** 2.0) + Vector((0.06 * d ** 4, 0, 0))
        v.co = Vector((v.co.x * 0.0216, v.co.y * 0.0204, v.co.z * 0.0214))
    hood_at = Vector((0, -0.0002, hz + 0.0006))
    hood = obj_from_bm('figurine hood', bm, yellow, at=hood_at, parent=root, sharp=180)
    hood.modifiers.new('thickness', 'SOLIDIFY').thickness = 0.0011
    tip = hood_at + Vector(((up.x * 0.70 + 0.06) * 0.0216, up.y * 0.70 * 0.0204, up.z * 0.70 * 0.0214))
    # the bow: two dark lobes across the tip; the star stands above it
    cross = Vector((up.z, 0, -up.x))
    for k in (1, -1):
        ball('figurine bow', (0.0044, 0.0028, 0.0030), tip + cross * (k * 0.0020), brown, root, rot=(0, math.atan2(-cross.z, cross.x), 0), cuts=2)
    ball('figurine bow knot', (0.0020, 0.0022, 0.0024), tip, brown, root, cuts=1)
    star = [((0.0027 if i % 2 == 0 else 0.0015) * math.sin(math.pi * i / 5), (0.0027 if i % 2 == 0 else 0.0015) * math.cos(math.pi * i / 5)) for i in range(10)]
    flat_shape('figurine star', rounded(star, 1), 0.0016, pbr('figurine star', (0.84, 0.60, 0.16), 0.5), at=tip + up * 0.0036 + Vector((0.0006, 0.0008, 0)), rot=(rad(-90), 0, rad(20)), parent=root)
    # the face
    def on_face(x, z):
        return Vector((x, 0.0008 + 0.0092 * math.sqrt(max(0.0, 1 - (x / 0.0099) ** 2 - (z / 0.0098) ** 2)), hz + z))

    spark = rounded([((0.00050 if i % 2 == 0 else 0.00016) * math.sin(math.pi * i / 4), (0.00075 if i % 2 == 0 else 0.00022) * math.cos(math.pi * i / 4)) for i in range(8)], 0)
    for sx in (1, -1):
        e = on_face(sx * 0.0039, 0.0002)
        turn = (0, 0, sx * rad(-20))
        ball('figurine eye', (0.0047, 0.0024, 0.0060), e, white, root, rot=turn)
        ball('figurine iris', (0.0039, 0.0019, 0.0046), e + Vector((-0.0006, 0.0008, 0.0005)), iris, root, rot=turn, cuts=2)
        flat_shape('figurine spark', spark, 0.0002, white, at=e + Vector((-0.0009, 0.0019, 0.0013)), rot=(rad(-90), 0, 0), parent=root)
        tube('figurine brow', [on_face(sx * 0.0030, 0.0066) + Vector((0, 0.0002, 0)), on_face(sx * 0.0041, 0.0071) + Vector((0, 0.0002, 0)), on_face(sx * 0.0052, 0.0066) + Vector((0, 0.0002, 0))],
             0.00014, line, parent=root, res=4)
    for x, z in ((0.0066, -0.0054), (-0.0075, -0.0042)):
        c = on_face(x * 0.86, z)
        out = Vector((x * 0.9, 0.0055, z * 0.5)).normalized()
        ball('figurine cheek', (0.0050, 0.0050, 0.0010), c - out * 0.0002, blush, root, rot=Vector((0, 0, 1)).rotation_difference(out).to_euler(), cuts=2)
        side = Vector((0, 0, 1)).cross(out).normalized()
        tube('figurine squiggle', [c + out * 0.0005 + side * (0.0016 * k) + Vector((0, 0, 0.0002 + 0.0006 * (1 if i % 2 else -1))) for i, k in enumerate((-1.0, -0.5, 0.0, 0.5, 1.0))],
             0.00017, line, parent=root, res=4)
    ball('figurine nose', (0.0014, 0.0010, 0.0010), on_face(0, -0.0030), skin, root, cuts=1)
    tube('figurine smile', [on_face(x, z) + Vector((0, 0.0002, 0)) for x, z in ((0.0010, -0.0055), (0.0005, -0.0060), (0, -0.0057), (-0.0005, -0.0060), (-0.0010, -0.0055))], 0.00013, line, parent=root, res=3)
    return root


def plush():
    """A keepsake: a plush black cat standing on two thick legs, sixteen centimetres to the tips
    of its ears. The head is far bigger than the body: a rounded box, wider than tall, flat in
    front and deep. Broad rounded ears stand at its upper corners, each lined with a large
    triangle of gold thread. The eyes are very large rounds of white terry with a raised
    stitched rim, the pupils set toward the nose: its right one stitched, with a faint ring,
    its left one a plain glossy disc. A small orange-brown nose lies between the eyes' lower
    edges. Two thick black cords hang from each cheek in loose bends, knotted at the end.
    Sunglasses cut from one piece of red felt lie on the forehead, leaning back with it, their
    lower edge just above the eyes and their ends over the ears' feet: two lenses of black
    cloth, a notch between them, a white stitch curved across each lens, white felt showing
    under the edge. A flat collar of green felt cut in points lies on the shoulders. The small
    body is yellow, printed like a pineapple with orange lines crossing and a dot in every
    diamond, all the way round; short black arms hang at its sides; a short pointed tail and a
    plain white tag are at the back. Across the back of the head a word is stitched in white
    script (ROOM_SCRIPT, a brush script face): a stand-in until the real embroidery is drawn.
    The cloth has a nap: a strong soft sheen at grazing angles and a fine uneven pile."""
    def cloth(name, color, sheen=1.0, tint=(1, 1, 1)):
        n = Nodes(name)
        co = n.coords()
        pile = n.math('ADD', n.math('MULTIPLY', n.noise(co, 2600.0, 2.0, 0.7), 0.6), n.math('MULTIPLY', n.noise(co, 420.0, 3.0, 0.6), 0.4))
        n.set(Base_Color=rgba(color), Roughness=1.0, Sheen_Weight=sheen, Sheen_Roughness=0.32, Sheen_Tint=rgba(tint), Specular_IOR_Level=0.1)
        n.bump(pile, 0.9, 0.0007)
        return n.mat
    black, terry = cloth('plush black', (0.008, 0.008, 0.010), 0.8, (0.55, 0.57, 0.62)), cloth('plush eye terry', (0.74, 0.74, 0.74), 0.4)
    thread = pbr('plush thread', (0.82, 0.82, 0.82), 0.5)
    yellow, orange = cloth('plush yellow', (0.88, 0.60, 0.10), 0.8, (1.0, 0.9, 0.6)), pbr('plush print', (0.84, 0.27, 0.03), 0.9)
    gold = pbr('plush gold', (0.60, 0.50, 0.06), 0.4, 0.7, grain=0.8, grain_scale=1000)
    red, green = cloth('plush red felt', (0.74, 0.045, 0.02), 0.5), cloth('plush green felt', (0.09, 0.52, 0.05), 0.5)
    white_felt = cloth('plush white felt', (0.78, 0.76, 0.74), 0.3)
    nose = pbr('plush nose', (0.36, 0.125, 0.045), 0.6, grain=0.6, grain_scale=1500)
    stitched = pbr('plush pupil thread', (0.016, 0.016, 0.018), 0.55, grain=0.8, grain_scale=1500)
    glossy = pbr('plush pupil disc', (0.005, 0.005, 0.006), 0.2)
    root = empty('plush', (*PLUSH_AT, TOP), (0, 0, facing_turn(PLUSH_AT) + (math.pi if VIEW == 'plushback' else 0)))  # its front is its +y
    # two thick legs, flat underfoot
    for sx in (1, -1):
        leg = lathe('plush leg', [(0, 0.0), (0.0125, 0.0), (0.0142, 0.0022), (0.0144, 0.020), (0.0125, 0.027), (0.007, 0.031), (0, 0.032)], black, at=(sx * 0.0170, 0.001, 0), parent=root, seg=20)
        leg.scale = (1.0, 1.05, 1.0)
    # the body, and its print: lines in two crossing spirals with a dot in every diamond, lying flat on the cloth
    bz, bw, bd, bh = 0.045, 0.063, 0.056, 0.050
    ball('plush body', (bw, bd, bh), (0, 0, bz), yellow, root, cuts=4, lumps=0.02, seed=1)

    def on_body(a, t, lift):
        r = math.sqrt(max(0.0, 0.25 - (t - 0.5) ** 2))
        return Vector((r * bw * math.cos(a), r * bd * math.sin(a), (t - 0.5) * bh)) * lift

    lines, twist = 9, 1.15
    bm = bmesh.new()
    for turn in (1, -1):
        for k in range(lines):
            prev = None
            for i in range(19):
                t = 0.1 + 0.8 * i / 18
                p = on_body(2 * math.pi * k / lines + turn * twist * t, t, 1.005)
                if prev:
                    s = p.normalized().cross(p - prev).normalized() * 0.0007
                    bm.faces.new([bm.verts.new(q) for q in (prev - s, prev + s, p + s, p - s)])
                prev = p
    obj_from_bm('plush print', bm, orange, at=(0, 0, bz), parent=root, sharp=180, outward=(0, 0, 0))
    step = math.pi / (lines * twist)  # from one row of crossings to the next
    for j in range(1, 5):
        for k in range(lines):
            n = on_body(2 * math.pi * k / lines + twist * j * step + math.pi / lines, j * step, 1.004)
            ball('plush dot', (0.0060, 0.0060, 0.0006), Vector((0, 0, bz)) + n, orange, root, rot=Vector((0, 0, 1)).rotation_difference(n.normalized()).to_euler(), cuts=1)
    # short arms hanging at the sides; the tail, short and pointed, low at the back; the tag beside it
    for sx in (1, -1):
        ball('plush arm', (0.0185, 0.0175, 0.031), (sx * 0.0375, 0.0, 0.0455), black, root, rot=(0, sx * rad(-20), 0), lumps=0.03, seed=3)
    lathe('plush tail', [(0.0075, 0.0), (0.0065, 0.010), (0.004, 0.019), (0.0012, 0.026), (0, 0.027)], black, at=(0, -0.024, 0.036), rot=(rad(128), 0, 0), parent=root, seg=12)
    box('plush tag', (0.011, 0.0006, 0.016), (0.013, -0.0262, 0.024), pbr('plush tag', (0.78, 0.78, 0.76), 0.6), rot=(rad(-10), 0, rad(8)), parent=root)
    # the collar: flat green felt cut in points, lying on the shoulders
    points, steps = 12, 4
    bm = bmesh.new()
    n = points * steps
    inner = [bm.verts.new((0.013 * math.cos(2 * math.pi * k / n), 0.013 * math.sin(2 * math.pi * k / n), 0.0015)) for k in range(n)]
    outer = []
    for k in range(n):
        tooth = 1 - abs((k % steps) / steps * 2 - 1)  # up to a point and back down
        r = 0.0300 + 0.0100 * tooth ** 0.8
        outer.append(bm.verts.new((r * math.cos(2 * math.pi * k / n), r * 0.95 * math.sin(2 * math.pi * k / n), -0.003 - 0.0055 * tooth)))
    for k in range(n):
        bm.faces.new((inner[k], outer[k], outer[(k + 1) % n], inner[(k + 1) % n]))
    collar = obj_from_bm('plush collar', bm, green, at=(0, 0, 0.0665), parent=root, smooth=False)
    collar.modifiers.new('thickness', 'SOLIDIFY').thickness = 0.001
    # the head: a rounded box (the exponent says how square), wider than tall, and deep
    hz, hw, hd, hh, square = 0.1045, 0.111, 0.098, 0.085, 2.7
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    rng = random.Random(4)
    ph = [rng.uniform(0, 6.28) for _ in range(3)]
    for v in bm.verts:
        c = v.co
        k = (abs(c.x) ** square + abs(c.y) ** square + abs(c.z) ** square) ** (-1 / square)
        k *= 1 + 0.010 * (math.sin(5 * c.x + ph[0]) * math.sin(4 * c.y + ph[1]) + 0.6 * math.sin(6 * c.z + ph[2]))
        v.co = Vector((c.x * k * hw / 2, c.y * k * hd / 2, c.z * k * hh / 2))
    obj_from_bm('plush head', bm, black, at=(0, 0, hz), parent=root, sharp=180)

    def on_head(x, z, back=False):
        """The point of the head's front (or back) at (x, z) from its middle, and the way the cloth faces there."""
        u, w = abs(2 * x / hw), abs(2 * z / hh)
        v = max(0.0, 1 - u ** square - w ** square) ** (1 / square)
        y = hd / 2 * v * (-1 if back else 1)
        n = Vector((math.copysign(u ** (square - 1), x) / hw, math.copysign(v ** (square - 1), y) / hd, math.copysign(w ** (square - 1), z) / hh))
        return Vector((x, y, hz + z)), n.normalized()

    def facing(n):
        return Vector((0, 0, 1)).rotation_difference(n).to_euler()

    eye_z = -0.0035
    for sx in (1, -1):
        # an ear: a broad rounded triangle, thin, standing at the head's upper corner and leaning out, its front lined with gold
        ear = empty('plush ear', (sx * 0.0440, -0.006, hz + 0.0255), (rad(-4), sx * rad(27), 0), root)
        e = lathe('plush ear', [(0.0225, 0.0), (0.0215, 0.009), (0.0170, 0.022), (0.0100, 0.032), (0.0045, 0.0370), (0, 0.0382)], black, parent=ear, seg=24)
        e.scale = (1.0, 0.32, 1.0)
        flat_shape('plush ear lining', rounded([(-0.0165, 0.0030), (0.0165, 0.0030), (0.0, 0.0320)], 2), 0.0005, gold, at=(0, 0.0060, 0.0012), rot=(rad(80), 0, 0), parent=ear)
        # an eye: a big round of white terry, a raised stitched rim round it, the pupil set toward the nose
        p, n = on_head(sx * 0.0290, eye_z)
        ball('plush eye', (0.0282, 0.0282, 0.0026), p, terry, root, rot=facing(n), cuts=3)
        ring('plush eye rim', 0.0282, 0.0020, p + n * 0.0006, facing(n), thread, root)
        p, n = on_head(sx * 0.0242, eye_z + (0.0 if sx > 0 else 0.0008))
        if sx > 0:  # its right eye (the looker's left): stitched, a shade larger, with a faint ring in the stitching
            ball('plush pupil', (0.0122, 0.0122, 0.0032), p + n * 0.0012, stitched, root, rot=facing(n), cuts=3)
            ring('plush pupil ring', 0.0072, 0.0007, p + n * 0.0028, facing(n), pbr('plush pupil ring', (0.05, 0.05, 0.055), 0.6), root, seg=24, sides=4)
        else:
            ball('plush pupil', (0.0112, 0.0112, 0.0032), p + n * 0.0012, glossy, root, rot=facing(n), cuts=3)
        # whiskers: two thick cords from the cheek, hanging in loose bends, a knot at the end
        for k in range(2):
            a = Vector((sx * (hw / 2 - 0.003), 0.012, hz - 0.006 - 0.012 * k))
            path = [a, a + Vector((sx * 0.006, 0.003, -0.003 - 0.004 * k)), a + Vector((sx * (0.008 - 0.004 * k), 0.006, -0.020)), a + Vector((sx * (0.003 + 0.005 * k), 0.003, -0.036)),
                    a + Vector((sx * (0.007 - 0.003 * k), 0.002, -0.050 + 0.012 * k))]
            tube('plush whisker', path, 0.0008, black, parent=root, res=6)
            ball('plush whisker knot', (0.0030, 0.0030, 0.0030), path[-1], black, root, cuts=1)
    p, n = on_head(0, eye_z - 0.0142)
    ball('plush nose', (0.0105, 0.0078, 0.0026), p, nose, root, rot=facing(n), cuts=2)
    # the sunglasses: one flat piece. Half its outline, from the notch between the lenses round
    # the lower rim to the point at the outer end and back along the top; the other half mirrors it
    half = [(0.0, 0.0085), (0.0050, -0.0040), (0.0110, -0.0130), (0.0230, -0.0165), (0.0360, -0.0155), (0.0450, -0.0095), (0.0475, -0.0010), (0.0525, 0.0040),
            (0.0480, 0.0105), (0.0410, 0.0150), (0.0250, 0.0165), (0.0, 0.0150)]
    outline = rounded(half + [(-x, y) for x, y in reversed(half[1:-1])], 2)
    lens = rounded([(0.0070, 0.0062), (0.0090, -0.0062), (0.0150, -0.0128), (0.0245, -0.0142), (0.0355, -0.0130), (0.0428, -0.0070), (0.0448, 0.0030), (0.0410, 0.0118), (0.0260, 0.0140), (0.0105, 0.0132)], 2)
    lean = rad(24)
    # (the piece is cut in its own xy plane; stood up, its y is up the forehead and its +z looks out and a little up, so its x runs to the cat's left)
    glasses = empty('plush sunglasses', (0, hd / 2 - 0.0035, hz + 0.0265), axes_euler(Vector((-1, 0, 0)), Vector((0, -math.sin(lean), math.cos(lean))), Vector((0, math.cos(lean), math.sin(lean)))), root)
    glasses.rotation_euler.rotate_axis('Z', rad(-3))
    glasses.scale = (0.87, 0.87, 1.0)
    flat_shape('plush glasses underlay', [(x * 1.035, y * 1.07) for x, y in outline], 0.0008, white_felt, at=(0, 0, -0.0008), parent=glasses)
    flat_shape('plush frame', outline, 0.0014, red, parent=glasses)
    dark = cloth('plush lens', (0.009, 0.008, 0.010), 0.5, (0.5, 0.5, 0.55))
    for sx in (1, -1):
        flat_shape('plush lens', lens if sx > 0 else [(-x, y) for x, y in reversed(lens)], 0.0006, dark, at=(0, 0, 0.0012), parent=glasses)
        # the white stitch: an arc near the lens's top that hooks down at one end
        tube('plush glint', [(sx * 0.0260 - 0.0080, 0.0062, 0.0021), (sx * 0.0260 - 0.0020, 0.0086, 0.0021), (sx * 0.0260 + 0.0050, 0.0080, 0.0021), (sx * 0.0260 + 0.0076, 0.0040, 0.0021)],
             0.0004, thread, parent=glasses, res=5)
    # the word across the back of the head, stitched in white script, climbing
    bm = lettering((('Hawaii', 0.032, 0.0, 0.004, rad(11)),), SCRIPT, squeeze=1.25, edge=0.004)
    for v in bm.verts:
        p, n = on_head(v.co.x, v.co.y, back=True)  # read from behind, where the cat's own +x is at the reader's right
        v.co = p + n * 0.0006
    obj_from_bm('plush embroidery', bm, thread, parent=root, sharp=180, outward=(0, 0, hz))
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
    looks over it; the other views see it."""
    root = empty('chair', (0.06, 1.48, 0.0), (0, 0, rad(-8)))
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
# where the keepsakes stand on the desk: the mug on the right, the plush between the notebook and
# the mat with the figurine in front of it; for the "keepsakes" view, all three in a row
MUG_AT, PLUSH_AT, FIGURINE_AT = (-0.57, 0.64), (0.50, 0.465), (0.455, 0.625)
LOOKER = (0.0, 1.85)  # who the keepsakes are turned to: the seat
# the views that check the keepsakes stand the three in a row, turned to the camera
KEEPSAKE_VIEWS = ('keepsakes', 'plushback', 'kplush', 'kfigurine', 'kmug')
if VIEW in KEEPSAKE_VIEWS:
    MUG_AT, PLUSH_AT, FIGURINE_AT = (0.49, 0.52), (0.36, 0.52), (0.60, 0.54)
    LOOKER = {'kplush': (0.36, 0.95), 'plushback': (0.36, 0.95), 'kfigurine': (0.60, 0.80), 'kmug': (0.49, 0.95)}.get(VIEW, (0.48, 1.03))
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
    # checks on the keepsakes, not deliverables. "keepsakes" stands the mug between the other two
    # for the picture, as they lay in the photograph they were made from (KEEPSAKES_AT)
    'keepsakes': ((0.48, 1.03, 0.90), (0.468, 0.52, 0.815), 47, 11.0, (0.48, 0.52, 0.82)),
    'plushback': ((0.36, 0.95, 0.86), (0.36, 0.52, 0.826), 62, 11.0, (0.36, 0.52, 0.83)),  # the plush is turned round for this one
    'kplush': ((0.36, 0.95, 0.86), (0.36, 0.52, 0.826), 62, 11.0, (0.36, 0.52, 0.83)),
    'kfigurine': ((0.60, 0.84, 0.80), (0.60, 0.54, 0.764), 135, 16.0, (0.60, 0.54, 0.765)),
    'kmug': ((0.49, 0.95, 0.85), (0.50, 0.52, 0.79), 72, 11.0, (0.49, 0.52, 0.79)),
    'plush': ((0.40, 0.98, 0.93), (0.485, 0.52, 0.80), 62, 8.0, (0.50, 0.47, 0.82)),
    'mug': ((-0.40, 1.02, 0.93), (-0.57, 0.64, 0.79), 75, 8.0, (-0.57, 0.64, 0.79)),
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


EXPOSURE = {'hero': 0.0, 'laptop': 0.0, 'arm': 0.35, 'tree': 0.0, 'keepsakes': 1.2, 'plushback': 1.2, 'kplush': 1.2, 'kfigurine': 1.2, 'kmug': 1.0, 'plush': 1.0, 'mug': 0.6}


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
    neighbours(balcony())
    trees()
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
    figurine()
    plush()
    books()
    if VIEW not in KEEPSAKE_VIEWS:  # they lie where those views line the keepsakes up
        notebook()
        phone()
        headphones()
    plant()
    chair()
    lights()
    camera(VIEW)
    if VIEW == 'arm':
        # this view stands outside looking in: the glass would only show the sky's reflection
        bpy.data.objects['window glass'].hide_render = True
    if OUTSIDE:
        for o in scene.objects:
            top = o
            while top.parent:
                top = top.parent
            if top.name not in OUTDOOR:
                o.visible_camera = False
    finish()


build()
if STATS:
    stats()
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
