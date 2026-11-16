# The room for the browser: builds the scene exactly as scene.py does, then writes what a
# three.js page needs into ROOM_WEB (default /home/user/room/web):
#   backdrop.webp   the garden as the seat sees it through the glass (the room hidden from the camera)
#   room.glb        the indoor part, Draco-compressed (by glTF Transform, from ROOM_WEB's node_modules),
#                   with flat materials, the woods' colour maps and the light in vertex colours
#   lm/*.webp       the diffuse light on the big surfaces (desk top, mat, floor, rug, walls, ceiling)
#   manifest.json   the seat camera, the lamp, and how the baked pictures are encoded
# Run with Blender's Python module:
#   python tools/pond/room/export.py [backdrop] [maps] [vertices] [glb] [look] [quick]
# With no stage named, the first four run ("bake" means maps and vertices). Every run rewrites
# manifest.json; "look" alone does only that, and so refreshes the tone curve. A GLB written
# without "vertices" in the same run has no light on the small things; one written without
# "maps" reuses the woods' colour maps from the last run that baked them. "quick" is a
# low-quality pass to test the pipeline (it overwrites the real output).
#
# What is baked and what is not: all diffuse light is baked, with Cycles, and none of it is
# computed in the browser. The big surfaces get a light map (and the two woods a colour map);
# everything else carries its light in vertex colours. Reflections and highlights stay live.
# Baked values are stored as log2 of the scene-linear value (see encode), since 8 bits of sRGB
# cannot hold both the lamp's pool and the dark under the desk.
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.environ.get('ROOM_WEB', '/home/user/room/web')
ARGS = sys.argv[1:]
QUICK = 'quick' in ARGS
STAGES = [a for a in ARGS if a in ('backdrop', 'maps', 'vertices', 'glb', 'look')] or ['backdrop', 'maps', 'vertices', 'glb']
if 'bake' in ARGS:
    STAGES += ['maps', 'vertices']
WORK = os.path.join(WEB, '.work')

# scene.py builds and renders as soon as it is loaded, and reads its options from the command
# line. Load everything above its last lines (the call to build and the render) instead.
src = open(os.path.join(HERE, 'scene.py')).read()
sys.argv = ['scene.py', os.path.join(WORK, 'unused.png'), '64', '1600', 'hero']
S = {'__name__': 'scene', '__file__': os.path.join(HERE, 'scene.py')}
exec(compile(src[:src.rindex('\nbuild()\n')], 'scene.py', 'exec'), S)

import bpy  # noqa: E402  (scene.py has loaded it already)
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402

T0 = time.time()


def log(*a):
    print(f'[export {time.time() - T0:6.0f}s]', *a, flush=True)


S['build']()
scene = bpy.context.scene
bpy.context.view_layer.update()
os.makedirs(os.path.join(WEB, 'lm'), exist_ok=True)
os.makedirs(WORK, exist_ok=True)

OUTDOOR = {'outside', 'tree', 'far trees'}
# the big surfaces that get a light map: object name -> (new name, the way its seen face looks, width, height)
LIGHTMAPPED = {
    'desk top': ('desk_top', None, 2048, 1024),
    'desk mat': ('desk_mat', (0, 0, 1), 1024, 512),
    'floor': ('floor', (0, 0, 1), 1024, 1024),
    'rug.001': ('rug', (0, 0, 1), 512, 512),  # the slab; 'rug' is the point it hangs from
    'ceiling': ('ceiling', (0, 0, -1), 512, 512),
    'side wall': ('wall_right', (1, 0, 0), 512, 512),  # at -x, which the seat has on its right
    'side wall.001': ('wall_left', (-1, 0, 0), 512, 512),
    'back wall': ('wall_back', (0, -1, 0), 512, 512),
}
ALBEDO = {'desk_top': (4096, 2048), 'floor': (2048, 2048)}  # the woods: their figure baked to a colour map
# objects that stay their own mesh in the GLB, with their names there
KEPT = {'samsung picture': 'samsung_screen', 'dell picture': 'dell_screen', 'macbook picture': 'macbook_screen',
        'window glass': 'window_glass', 'lamp bulb': 'lamp_bulb'}
# how baked light is stored: value = (log2(light) - LO) / STOPS, clipped to 0..1
TEX_LO, TEX_STOPS = -8.0, 11.0  # pictures, 8 bits: 1/256 to 8
VTX_LO, VTX_STOPS = -10.0, 17.0  # vertex colours, 12 bits: 1/1024 to 128
BACKDROP_LENS, BACKDROP_SIZE, BACKDROP_DISTANCE = 18.0, (3072, 1728), 5.05  # the plane stands at the tree's trunk
SAMPLES = {'backdrop': 48, 'light': 64, 'albedo': 8, 'vertex': 1024}
if QUICK:
    SAMPLES = {'backdrop': 6, 'light': 8, 'albedo': 1, 'vertex': 8}
    BACKDROP_SIZE = (768, 432)
    LIGHTMAPPED = {k: (n, d, max(w // 4, 64), max(h // 4, 64)) for k, (n, d, w, h) in LIGHTMAPPED.items()}
    ALBEDO = {k: (w // 4, h // 4) for k, (w, h) in ALBEDO.items()}

# flat stand-ins for what the procedural materials average to (they do not export)
BASE = {
    'chair wood': (0.125, 0.075, 0.04), 'speaker grille': (0.42, 0.42, 0.43), 'vent slots': (0.012, 0.012, 0.013),
    'stoneware': (0.64, 0.60, 0.53), 'cork': (0.26, 0.165, 0.095), 'terracotta': (0.44, 0.175, 0.088),
    'pages': (0.675, 0.63, 0.53), 'linen': (0.43, 0.387, 0.321), 'pilea leaf': (0.08, 0.21, 0.035),
    'desk wood': (0.2, 0.11, 0.06), 'floor wood': (0.17, 0.115, 0.07),
}
ROUGH = {'desk wood': 0.42, 'floor wood': 0.38, 'chair wood': 0.45}


def top_of(o):
    while o.parent:
        o = o.parent
    return o


def indoor_objects():
    return [o for o in scene.objects if o.type in ('MESH', 'CURVE') and top_of(o).name not in OUTDOOR]


def select(objs, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def encode(a, lo, stops):
    return np.clip((np.log2(np.maximum(a, 2.0 ** lo)) - lo) / stops, 0.0, 1.0)


def pixels_of(img):
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def save_bytes(name, rgb, path, fmt='WEBP', quality=92, space='Non-Color'):
    """Write values in 0..1 to an 8-bit picture as they are, with no colour conversion."""
    h, w, _ = rgb.shape
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.colorspace_settings.name = space
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = rgb
    im.pixels.foreach_set(px.ravel())
    im.filepath_raw, im.file_format = path, fmt
    im.save(quality=quality)
    return im


# ---------------------------------------------------------------------------------------------
# The garden, as a picture behind the glass.
# ---------------------------------------------------------------------------------------------

def backdrop():
    """Render the outside alone from the seat, wider than the seat's own view so the camera can
    drift, with the seat lens's blur (the outside is far out of focus in the offline render)."""
    # the room stays, so the house still shades the deck and the tree; only the camera looks through it
    hidden = [o for o in indoor_objects() if o.visible_camera]
    for o in hidden:
        o.visible_camera = False
    cam = scene.camera.data
    lens, fstop = cam.lens, cam.dof.aperture_fstop
    cam.lens = BACKDROP_LENS
    cam.dof.aperture_fstop = BACKDROP_LENS / (lens / fstop)  # the same opening, so the same blur
    r = scene.render
    r.resolution_x, r.resolution_y = BACKDROP_SIZE
    scene.cycles.samples = SAMPLES['backdrop']
    group = scene.compositing_node_group
    scene.compositing_node_group = None  # the browser adds its own bloom
    r.image_settings.file_format = 'OPEN_EXR'
    r.image_settings.color_depth = '32'
    r.filepath = os.path.join(WORK, 'backdrop.exr')
    log('backdrop: rendering', BACKDROP_SIZE, SAMPLES['backdrop'], 'samples')
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(r.filepath)
    save_bytes('backdrop', encode(pixels_of(im)[..., :3], TEX_LO, TEX_STOPS), os.path.join(WEB, 'backdrop.webp'), quality=90)
    bpy.data.images.remove(im)
    cam.lens, cam.dof.aperture_fstop = lens, fstop
    scene.compositing_node_group = group
    for o in hidden:
        o.visible_camera = True
        o.update_tag()
    bpy.context.view_layer.update()
    log('backdrop: done')


# ---------------------------------------------------------------------------------------------
# Plain meshes, grouped; then UVs for the big surfaces.
# ---------------------------------------------------------------------------------------------

def to_meshes():
    """Curves become meshes and modifiers are applied; each object stands free in world space."""
    objs = indoor_objects()
    select(objs)
    bpy.ops.object.convert(target='MESH')
    cutter = bpy.data.objects['macbook cutter']  # it has cut the laptop's base by now
    bpy.data.objects.remove(cutter)
    bpy.context.view_layer.update()
    groups = {}
    for o in indoor_objects():
        groups.setdefault(top_of(o).name, []).append(o)
    for o in [o for o in scene.objects if o.parent and o.type != 'EMPTY' and top_of(o).name not in OUTDOOR]:
        mw = o.matrix_world.copy()  # the lamp's light too: it hangs from the lamp's head
        o.parent = None
        o.matrix_world = mw
    for o in [o for o in scene.objects if o.type == 'EMPTY' and o.name not in OUTDOOR and top_of(o).name not in OUTDOOR]:
        bpy.data.objects.remove(o)  # the points things hung from: their names are wanted for the meshes
    bpy.context.view_layer.update()
    return groups


def group_up(groups):
    """One mesh per thing (the laptop, the lamp, ...), but for the surfaces that are light-mapped
    and the few that the page needs by name."""
    special, props = {}, []
    for root, objs in groups.items():
        rest = []
        for o in objs:
            if o.name in LIGHTMAPPED:
                special[LIGHTMAPPED[o.name][0]] = o
            elif o.name in KEPT:
                special[KEPT[o.name]] = o
            else:
                rest.append(o)
        if rest:
            select(rest)
            bpy.ops.object.join()
            o = bpy.context.view_layer.objects.active
            o.name = o.data.name = root.replace(' ', '_').replace('-', '_')
            props.append(o)
    for name, o in special.items():
        o.name = o.data.name = name
    select(list(special.values()) + props)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return special, props


def uv_planar(o, facing, pad=0.004):
    """Lay the faces that look along `facing` flat across the whole picture; the other faces
    (backs and edges that are never seen) are folded into one corner."""
    me = o.data
    uv = me.uv_layers.new(name='UVMap')
    facing = Vector(facing)
    axes = [i for i in range(3) if abs(facing[i]) < 0.5]
    lo = [min(v.co[i] for v in me.vertices) for i in axes]
    hi = [max(v.co[i] for v in me.vertices) for i in axes]
    for p in me.polygons:
        seen = p.normal.dot(facing) > 0.3
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if seen:
                uv.data[li].uv = [pad + (1 - 2 * pad) * (co[a] - lo[k]) / (hi[k] - lo[k]) for k, a in enumerate(axes)]
            else:
                uv.data[li].uv = (pad, pad)


def uv_desk_top(o, n=20):
    """The desk top is one outline (n points) swept along x. Unroll it: u runs along the desk,
    v round the outline, with the top, the rounded front and the front face at full scale and
    the underside and back edge squeezed. The two end caps get a strip of their own."""
    me = o.data
    uv = me.uv_layers.new(name='UVMap')
    prof = [me.vertices[n + i].co for i in range(n)]  # the second ring: the full outline
    seg = [(Vector((0, prof[(i + 1) % n].y, prof[(i + 1) % n].z)) - Vector((0, prof[i].y, prof[i].z))).length for i in range(n)]
    scale = [0.5 if i < 3 else 0.08 if i == n - 1 else 1.0 for i in range(n)]
    s = [0.0]
    for i in range(n):
        s.append(s[-1] + seg[i] * scale[i])
    for p in me.polygons:
        idx = [me.loops[li].vertex_index for li in p.loop_indices]
        if len(idx) > 4:  # an end cap
            left = me.vertices[idx[0]].co.x < 0
            for li, vi in zip(p.loop_indices, idx):
                co = me.vertices[vi].co
                u = (co.y - 0.05) / 0.8 * 0.44 + (0.02 if left else 0.54)
                uv.data[li].uv = (u, 0.958 + (co.z - (0.74 - 0.04)) / 0.04 * 0.034)
            continue
        ks = [vi % n for vi in idx]
        wrap = 0 in ks and n - 1 in ks
        for li, vi, k in zip(p.loop_indices, idx, ks):
            co = me.vertices[vi].co
            v = s[n if wrap and k == 0 else k] / s[n]
            uv.data[li].uv = (0.003 + 0.994 * (co.x + 1.0) / 2.0, 0.004 + 0.944 * v)


# ---------------------------------------------------------------------------------------------
# Baking.
# ---------------------------------------------------------------------------------------------

def bake_node(mat):
    nt = mat.node_tree
    node = nt.nodes.get('bake target') or nt.nodes.new('ShaderNodeTexImage')
    node.name = 'bake target'
    for n in nt.nodes:
        n.select = False
    node.select = True
    nt.nodes.active = node
    return node


def bake_image(o, w, h, passes, samples):
    img = bpy.data.images.new('bake ' + o.name, w, h, alpha=False, float_buffer=True)
    img.colorspace_settings.name = 'Linear Rec.709'
    for slot in o.material_slots:
        bake_node(slot.material).image = img
    select([o])
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False  # baking ignores it; see denoise()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, margin=max(4, w // 256), use_clear=True, target='IMAGE_TEXTURES')
    a = pixels_of(img)[..., :3].copy()
    bpy.data.images.remove(img)
    return a


def denoise(a):
    """Clean a baked light map with the compositor's denoiser (baking itself does not denoise)."""
    h, w, _ = a.shape
    src, dst = os.path.join(WORK, 'noisy.exr'), os.path.join(WORK, 'clean.exr')
    img = bpy.data.images.new('noisy', w, h, alpha=False, float_buffer=True)
    px = np.ones((h, w, 4), dtype=np.float32)
    px[..., :3] = a
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw, img.file_format = src, 'OPEN_EXR'
    img.save()
    bpy.data.images.remove(img)
    img = bpy.data.images.load(src)
    sc = bpy.data.scenes.new('denoise')
    tree = bpy.data.node_groups.new('denoise', 'CompositorNodeTree')
    tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    picture, clean, out = tree.nodes.new('CompositorNodeImage'), tree.nodes.new('CompositorNodeDenoise'), tree.nodes.new('NodeGroupOutput')
    picture.image = img
    tree.links.new(picture.outputs['Image'], clean.inputs['Image'])
    tree.links.new(clean.outputs['Image'], out.inputs[0])
    sc.compositing_node_group = tree
    cam = bpy.data.objects.new('denoise camera', bpy.data.cameras.new('denoise camera'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    sc.render.engine = 'CYCLES'
    sc.cycles.samples, sc.cycles.device = 1, 'CPU'
    r = sc.render
    r.resolution_x, r.resolution_y, r.resolution_percentage = w, h, 100
    r.image_settings.file_format, r.image_settings.color_depth = 'OPEN_EXR', '32'
    r.filepath = dst
    bpy.ops.render.render(scene=sc.name, write_still=True)
    res = bpy.data.images.load(dst)
    b = pixels_of(res)[..., :3].copy()
    for im in (img, res):
        bpy.data.images.remove(im)
    bpy.data.objects.remove(cam)
    bpy.data.scenes.remove(sc)
    bpy.data.node_groups.remove(tree)
    return b


def unwrap(special):
    for old, (name, facing, w, h) in LIGHTMAPPED.items():
        o = special[name]
        if facing is None:
            uv_desk_top(o)
        else:
            uv_planar(o, facing)


def stored_albedo():
    """The colour maps of an earlier run, for a GLB written without baking them again."""
    paths = {name: os.path.join(WORK, name + '-albedo.png') for name in ALBEDO}
    return {name: bpy.data.images.load(p) for name, p in paths.items() if os.path.exists(p)}


def bake_textures(special):
    lit = {}
    for old, (name, facing, w, h) in LIGHTMAPPED.items():
        o = special[name]
        log('bake light:', name, w, h)
        a = denoise(bake_image(o, w, h, {'DIRECT', 'INDIRECT'}, SAMPLES['light']))
        np.save(os.path.join(WORK, name + '.npy'), a)
        save_bytes('lm ' + name, encode(a, TEX_LO, TEX_STOPS), os.path.join(WEB, 'lm', name + '.webp'), quality=92)
        lit[name] = 'lm/' + name + '.webp'
    albedo = {}
    for name, (w, h) in ALBEDO.items():
        log('bake colour:', name, w, h)
        a = np.clip(bake_image(special[name], w, h, {'COLOR'}, SAMPLES['albedo']), 0, 1)
        srgb = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)
        path = os.path.join(WORK, name + '-albedo.png')
        save_bytes('albedo ' + name, srgb, path, fmt='PNG', space='sRGB')
        albedo[name] = bpy.data.images.load(path)
    return lit, albedo


def bake_vertices(props):
    """The light on everything else, kept at the corners of its faces."""
    scene.cycles.samples = SAMPLES['vertex']
    scene.cycles.use_denoising = False
    # a metal has no diffuse light to bake; make the metals matt for this bake, so that they too
    # know how open or shut in each corner is (the page dims reflections by it)
    metals = {}
    for o in props:
        for slot in o.material_slots:
            if not slot.material:
                continue
            sock = slot.material.node_tree.nodes['Principled BSDF'].inputs['Metallic']
            if not sock.is_linked and sock.default_value > 0 and slot.material.name not in metals:
                metals[slot.material.name] = (sock, sock.default_value)
                sock.default_value = 0.0
    for o in props:
        me = o.data
        col = me.color_attributes.new('light', 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = col
        me.color_attributes.render_color_index = me.color_attributes.find('light')
        select([o])
        log('bake vertices:', o.name, len(me.loops), 'corners')
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, target='VERTEX_COLORS')
        col = me.color_attributes['light']
        n = len(me.loops)
        c = np.empty(n * 4, dtype=np.float32)
        col.data.foreach_get('color', c)
        c = c.reshape(n, 4)[:, :3]
        # corners that meet at a vertex with the same normal see the same light: average them,
        # which takes most of the noise out
        vi = np.empty(n, dtype=np.int32)
        me.loops.foreach_get('vertex_index', vi)
        nr = np.empty(n * 3, dtype=np.float32)
        me.corner_normals.foreach_get('vector', nr)
        key = np.column_stack([vi, np.round(nr.reshape(n, 3) * 6).astype(np.int32)])
        _, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.ravel()
        count = np.bincount(inv)
        mean = np.stack([np.bincount(inv, weights=c[:, k]) / count for k in range(3)], axis=1)
        # and where the mesh is fine (a mug's wall, a cushion) let each corner lean on its
        # neighbours along short, smooth edges; long edges keep the gradient across big faces
        normal = np.stack([np.bincount(inv, weights=nr.reshape(n, 3)[:, k]) / count for k in range(3)], axis=1)
        normal /= np.maximum(np.linalg.norm(normal, axis=1, keepdims=True), 1e-9)
        start, total = np.empty(len(me.polygons), dtype=np.int32), np.empty(len(me.polygons), dtype=np.int32)
        me.polygons.foreach_get('loop_start', start)
        me.polygons.foreach_get('loop_total', total)
        first = np.repeat(start, total)
        nxt = first + (np.arange(n) - first + 1) % np.repeat(total, total)
        co = np.empty(len(me.vertices) * 3, dtype=np.float32)
        me.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        a, b = inv, inv[nxt]
        near = (np.linalg.norm(co[vi] - co[vi[nxt]], axis=1) < 0.02) & ((normal[a] * normal[b]).sum(1) > 0.95) & (a != b)
        a, b = a[near], b[near]
        lg = np.log2(np.maximum(mean, 2.0 ** VTX_LO))
        for _ in range(2):
            acc, cnt = np.zeros_like(lg), np.zeros(len(lg))
            np.add.at(acc, a, lg[b])
            np.add.at(acc, b, lg[a])
            np.add.at(cnt, a, 1)
            np.add.at(cnt, b, 1)
            has = cnt > 0
            lg[has] = 0.5 * lg[has] + 0.5 * acc[has] / cnt[has, None]
        out = np.ones((n, 4), dtype=np.float32)
        out[:, :3] = encode(2.0 ** lg, VTX_LO, VTX_STOPS)[inv]
        col.data.foreach_set('color', out.ravel())
        me.update()
    for sock, value in metals.values():
        sock.default_value = value


# ---------------------------------------------------------------------------------------------
# Materials the exporter understands: flat colour, roughness, metalness; pictures where baked.
# ---------------------------------------------------------------------------------------------

def flatten(mat, albedo=None, name=None):
    name = name or mat.name
    nt = mat.node_tree
    b = nt.nodes.get('Principled BSDF')
    out = nt.nodes['Material Output']

    def unlink(sock):
        for link in list(sock.links):
            nt.links.remove(link)

    sock = b.inputs['Roughness']
    if sock.is_linked:
        src = sock.links[0].from_node
        guess = 0.5
        if src.type == 'MATH' and src.operation == 'ADD' and not src.inputs[1].is_linked:
            guess = src.inputs[1].default_value + 0.125  # pbr()'s grain: the noise averages a half
        unlink(sock)
        sock.default_value = ROUGH.get(name, guess)
    sock = b.inputs['Metallic']
    if sock.is_linked:
        unlink(sock)
        sock.default_value = 1.0
    unlink(b.inputs['Normal'])
    if name in ('desk wood', 'floor wood'):
        b.inputs['Coat Weight'].default_value = 0.0
    sock = b.inputs['Base Color']
    if sock.is_linked:
        unlink(sock)
        sock.default_value = (*BASE[name], 1)
    elif name in BASE:
        sock.default_value = (*BASE[name], 1)
    if albedo:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = albedo
        nt.links.new(tex.outputs['Color'], sock)
    sock = b.inputs['Emission Color']
    if sock.is_linked and sock.links[0].from_node.type != 'TEX_IMAGE':
        unlink(sock)  # the map's placeholder: the page paints its own
        sock.default_value = (0.012, 0.03, 0.10, 1)
    if not out.inputs['Surface'].is_linked or out.inputs['Surface'].links[0].from_node != b:
        unlink(out.inputs['Surface'])
        nt.links.new(b.outputs[0], out.inputs['Surface'])
    node = nt.nodes.get('bake target')
    if node:
        nt.nodes.remove(node)


def export_glb(special, props, albedo):
    # each albedo belongs to one object; give that object its own copy of the wood
    for name, img in albedo.items():
        o = special[name]
        src = o.material_slots[0].material
        m = src.copy()
        m.name = name + ' baked'
        o.material_slots[0].material = m
        flatten(m, img, src.name)
    done = set()
    for o in list(special.values()) + props:
        for slot in o.material_slots:
            m = slot.material
            if m and m.name not in done and not m.name.endswith(' baked'):
                done.add(m.name)
                flatten(m)
    select(list(special.values()) + props)
    path, raw = os.path.join(WEB, 'room.glb'), os.path.join(WORK, 'room-raw.glb')
    bpy.ops.export_scene.gltf(
        filepath=raw, export_format='GLB', use_selection=True, export_yup=True, export_apply=False,
        export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
        export_normals=True, export_tangents=False, export_texcoords=True, export_materials='EXPORT',
        export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True,
        export_image_format='WEBP', export_image_quality=82)
    # Blender's Python module comes without the exporter's Draco bridge, so compress afterwards
    # with glTF Transform (npm install in ROOM_WEB puts it there)
    try:
        subprocess.run(['npx', '--no-install', 'gltf-transform', 'draco', raw, path, '--quantize-position', '14',
                        '--quantize-normal', '10', '--quantize-color', '12', '--quantize-texcoord', '14'], cwd=WEB, check=True)
    except (OSError, subprocess.CalledProcessError) as e:
        log('glb: left uncompressed, glTF Transform did not run:', e)
        shutil.copyfile(raw, path)
    tris = {}
    for o in list(special.values()) + props:
        o.data.calc_loop_triangles()
        tris[o.name] = len(o.data.loop_triangles)
    log('glb:', path, os.path.getsize(path), 'bytes,', sum(tris.values()), 'triangles')
    return tris


def tone_curve(n=256):
    """The scene's view transform and look as one curve, measured rather than copied: n greys
    spread evenly over AgX's log2 range go through Blender's own colour management, and what comes
    out (display values, 0..1) is the curve. The page applies it per channel in AgX's own space,
    which is how AgX itself works; three.js's built-in AgX uses a fitted polynomial that is some
    way off this (mid grey 0.50 where Blender gives 0.46) and has no looks."""
    lo, hi = -12.47393, 4.026069  # log2 of 0.18 * 2**-10 and of 0.18 * 2**6.5
    ramp = np.ones((1, n, 4), dtype=np.float32)
    ramp[0, :, :3] = (2.0 ** np.linspace(lo, hi, n))[:, None]
    im = bpy.data.images.new('grey ramp', n, 1, alpha=False, float_buffer=True)
    im.pixels.foreach_set(ramp.ravel())
    fmt = scene.render.image_settings
    old = (fmt.file_format, fmt.color_depth)
    fmt.file_format, fmt.color_depth = 'PNG', '16'
    path = os.path.join(WORK, 'tone-curve.png')
    im.save_render(path, scene=scene)
    fmt.file_format, fmt.color_depth = old
    out = bpy.data.images.load(path)
    out.colorspace_settings.name = 'Non-Color'
    curve = [round(float(v), 5) for v in pixels_of(out)[0, :, 0]]
    for i in (im, out):
        bpy.data.images.remove(i)
    return {'log2Min': lo, 'log2Max': hi, 'curve': curve}


def manifest(lit, tris):
    at, aim, lens, fstop, focus = S['VIEWS']['hero']
    lamp = bpy.data.objects['lamp light']
    m = {
        'units': 'metres, Blender axes (z up); the GLB itself is y up: (x, y, z) -> (x, z, -y)',
        'camera': {'position': at, 'aim': aim, 'lens': lens, 'sensor': 36, 'fstop': fstop, 'focus': focus},
        'views': {k: {'position': v[0], 'aim': v[1], 'lens': v[2]} for k, v in S['VIEWS'].items()},
        'lamp': {'position': list(lamp.matrix_world.translation), 'color': list(lamp.data.color), 'watts': lamp.data.energy},
        'glow': {'laptop': S['LAPTOP_GLOW'], 'dell': S['DELL_GLOW'], 'map': S['MAP_GLOW'], 'bulb': S['BULB_GLOW']},
        'backdrop': {'file': 'backdrop.webp', 'lens': BACKDROP_LENS, 'sensor': 36, 'aspect': BACKDROP_SIZE[0] / BACKDROP_SIZE[1],
                     'distance': BACKDROP_DISTANCE, 'lo': TEX_LO, 'stops': TEX_STOPS},
        'lightmaps': {'lo': TEX_LO, 'stops': TEX_STOPS, 'files': lit},
        'vertexLight': {'lo': VTX_LO, 'stops': VTX_STOPS},
        'triangles': tris,
        'look': {'view': scene.view_settings.view_transform, 'look': scene.view_settings.look, 'exposure': scene.view_settings.exposure,
                 **tone_curve()},
    }
    old = {}
    path = os.path.join(WEB, 'manifest.json')
    if os.path.exists(path):
        old = json.load(open(path))
    if not lit and 'lightmaps' in old:
        m['lightmaps'] = old['lightmaps']
    if not tris and 'triangles' in old:
        m['triangles'] = old['triangles']
    json.dump(m, open(path, 'w'), indent=1)


if 'backdrop' in STAGES:
    backdrop()
# keep the garden's 3.7M triangles between bakes (only from here: a bake straight after a
# render that hid things from the camera would still see them hidden)
scene.render.use_persistent_data = True
lit, tris = {}, {}
if {'maps', 'vertices', 'glb'} & set(STAGES):
    groups = to_meshes()
    special, props = group_up(groups)
    unwrap(special)
    albedo = stored_albedo()
    if 'maps' in STAGES:
        lit, albedo = bake_textures(special)
    if 'vertices' in STAGES:
        bake_vertices(props)
    if 'glb' in STAGES:
        tris = export_glb(special, props, albedo)
manifest(lit, tris)
log('done')
