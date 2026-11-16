# The room under the pond, first pass: blocks at true sizes, to judge the layout and the view by.
# Run with Blender's Python module (`pip install bpy` in a virtual environment; Cycles on the CPU):
#   python tools/pond/room/greybox.py out.png [samples]
import math
import sys

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'


def mat(name, color, rough=0.6, metal=0.0, emit=None, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = strength
    return m


def box(name, size, at, m, rot=(0, 0, 0), bevel=0.0, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
    o.data.materials.append(m)
    if parent:
        o.parent = parent
    return o


def cyl(name, r, h, at, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=at, rotation=rot, vertices=48)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


WALL = mat('wall', (0.78, 0.74, 0.68), 0.9)
FLOOR = mat('floor', (0.23, 0.16, 0.11), 0.5)
DESK = mat('desk', (0.36, 0.22, 0.13), 0.45)
SILVER = mat('silver', (0.72, 0.73, 0.75), 0.3, 1.0)
DARK = mat('dark', (0.03, 0.03, 0.035), 0.4)
ALU = mat('alu', (0.55, 0.56, 0.58), 0.35, 1.0)
MAP = mat('map', (0.02, 0.03, 0.05), 0.2, emit=(0.10, 0.22, 0.42), strength=1.1)
SCREEN = mat('screen', (0.02, 0.02, 0.03), 0.2, emit=(0.30, 0.26, 0.22), strength=0.7)
LAPTOP = mat('laptop screen', (0.02, 0.02, 0.03), 0.2, emit=(0.22, 0.24, 0.3), strength=0.8)
SHADE = mat('shade', (0.75, 0.3, 0.16), 0.6)
MUG = mat('mug', (0.85, 0.83, 0.78), 0.35)
LEAF = mat('leaf', (0.1, 0.28, 0.12), 0.5)
POT = mat('pot', (0.55, 0.3, 0.2), 0.7)
SKY = mat('sky', (0, 0, 0), 1, emit=(0.16, 0.2, 0.34), strength=2.2)
FRAME = mat('frame', (0.6, 0.55, 0.48), 0.6)

# the room: behind the desk, glass from floor to ceiling in three panes; a side wall; the floor.
# Outside, close to the glass, one big tree (stand-ins: a trunk, boughs, masses of leaves) and the sky.
GLASS = bpy.data.materials.new('glass')
GLASS.use_nodes = True
g = GLASS.node_tree.nodes['Principled BSDF']
g.inputs['Base Color'].default_value = (0.9, 0.95, 1, 1)
g.inputs['Roughness'].default_value = 0.02
g.inputs['Transmission Weight'].default_value = 1.0
g.inputs['IOR'].default_value = 1.45
BARK = mat('bark', (0.12, 0.08, 0.06), 0.9)
LEAVES = mat('leaves', (0.07, 0.2, 0.08), 0.7)
box('floor', (5, 5, 0.05), (0, 1.5, -0.025), FLOOR)
box('ceiling', (5, 5, 0.05), (0, 1.5, 2.725), WALL)
box('side wall', (0.1, 5, 2.7), (2.3, 2.4, 1.35), WALL)
box('side wall', (0.1, 5, 2.7), (-2.3, 2.4, 1.35), WALL)
box('glass', (4.6, 0.012, 2.7), (0, -0.05, 1.35), GLASS)
for x in (-2.28, -0.77, 0.77, 2.28):
    box('window post', (0.06, 0.1, 2.7), (x, -0.05, 1.35), DARK)
for z in (0.03, 2.67):
    box('window rail', (4.6, 0.1, 0.06), (0, -0.05, z), DARK)
box('ground outside', (30, 30, 0.05), (0, -15, -0.5), mat('ground', (0.05, 0.08, 0.04), 0.9))
box('sky', (60, 0.1, 30), (0, -25, 8), SKY)
cyl('trunk', 0.32, 6, (-0.9, -3.2, 2.5), BARK)
import random
random.seed(4)
for k in range(16):
    at = (-0.9 + random.uniform(-2.6, 2.6), -3.2 + random.uniform(-1.6, 1.4), 3.2 + random.uniform(-1.0, 2.6))
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.7, 1.3), subdivisions=2, location=at)
    bpy.context.object.data.materials.append(LEAVES)

# the desk: 2.0 m by 0.8 m, its top 0.74 m up
TOP = 0.74
box('desk top', (2.0, 0.8, 0.04), (0, 0.45, TOP - 0.02), DESK, bevel=0.004)
for x in (-0.94, 0.94):
    for y in (0.1, 0.8):
        box('desk leg', (0.05, 0.05, TOP - 0.04), (x, y, (TOP - 0.04) / 2), DARK)


ARM = mat('arm', (0.045, 0.045, 0.05), 0.45, 0.6)


def beam(name, a, b, thick, m):
    """A bar from a to b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
    o = bpy.context.object
    o.name = name
    o.scale = (thick[0], thick[1], d.length)
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new('bevel', 'BEVEL')
    mod.width = 0.004
    mod.segments = 3
    o.data.materials.append(m)
    return o


def monitor(name, x, w, h, depth, shell, screen, yaw, lift):
    """A monitor on an arm: its panel w by h (the lit part a little inside); returns where its mount is."""
    y = 0.26
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = (x, y, TOP)
    root.rotation_euler = (0, 0, yaw)
    zc = lift + h / 2
    box(name + ' panel', (w, depth, h), (0, 0, zc), shell, bevel=0.004, parent=root)
    box(name + ' screen', (w - 0.016, 0.004, h - 0.016), (0, depth / 2, zc), screen, parent=root)
    box(name + ' vesa', (0.12, 0.012, 0.12), (0, -depth / 2 - 0.006, zc), ARM, bevel=0.002, parent=root)
    return Vector((x, y - depth / 2 - 0.02, TOP + zc))


# The two monitors side by side on a dual arm (North Bayou's kind): a clamp on the desk's back edge, one
# post, and for each monitor a level arm out from the post and a sprung arm up to its mount.
# (the view looks back at the wall, so what is at +x is on the left of the picture)
# Samsung Odyssey OLED G8 (G80SD), on the left: 32 in, 714 by 412 mm, thin and silver
left = monitor('samsung g80sd', 0.37, 0.714, 0.412, 0.022, SILVER, MAP, math.radians(-7), 0.198)
# Dell 27, on the right: 612 by 356 mm, dark
right = monitor('dell 27', -0.335, 0.612, 0.356, 0.04, DARK, SCREEN, math.radians(7), 0.198)
POST = Vector((0.0, 0.07, TOP))
box('arm clamp', (0.11, 0.1, 0.02), POST + Vector((0, 0, 0.01)), ARM, bevel=0.003)
box('arm clamp jaw', (0.09, 0.03, 0.09), POST + Vector((0, -0.045, -0.035)), ARM, bevel=0.003)
cyl('arm post', 0.0175, 0.44, POST + Vector((0, 0, 0.24)), ARM)
for n, (mount, side) in enumerate(((left, 1), (right, -1))):
    collar = POST + Vector((0, 0, 0.28 + n * 0.05))
    elbow = Vector((mount.x * 0.5, 0.045, collar.z))
    cyl('arm collar', 0.028, 0.045, collar, ARM)
    beam('arm lower', collar, elbow, (0.05, 0.03), ARM)
    cyl('arm elbow', 0.024, 0.06, elbow, ARM)
    beam('arm sprung', elbow + Vector((0, 0, 0.02)), mount, (0.055, 0.04), ARM)
    cyl('arm head', 0.022, 0.05, mount, ARM, rot=(math.radians(90), 0, 0))

# MacBook Pro 14: 312.6 by 221.2 by 15.5 mm, open, square in front of whoever sits here: the two
# monitors are its extended displays, and there is no other keyboard or mouse
mb = bpy.data.objects.new('macbook', None)
bpy.context.collection.objects.link(mb)
mb.location = (0.0, 0.6, TOP)
mb.rotation_euler = (0, 0, 0)
box('macbook base', (0.3126, 0.2212, 0.011), (0, 0, 0.0055), ALU, bevel=0.003, parent=mb)
box('macbook keys', (0.27, 0.105, 0.001), (0, -0.03, 0.0115), DARK, parent=mb)
lid = bpy.data.objects.new('macbook lid', None)
bpy.context.collection.objects.link(lid)
lid.parent = mb
lid.location = (0, -0.1106, 0.011)
lid.rotation_euler = (math.radians(-20), 0, 0)
box('macbook lid shell', (0.3126, 0.005, 0.2212), (0, -0.0025, 0.1106), ALU, bevel=0.002, parent=lid)
box('macbook display', (0.3, 0.001, 0.2), (0, 0.0006, 0.1106), LAPTOP, parent=lid)

# what is in front of the monitors, and about the desk (stand-ins)
box('desk mat', (0.8, 0.36, 0.003), (0, 0.62, TOP + 0.0015), mat('desk mat', (0.07, 0.07, 0.08), 0.8))
cyl('mug', 0.04, 0.09, (-0.62, 0.62, TOP + 0.045), MUG)
cyl('lamp base', 0.08, 0.015, (-0.82, 0.25, TOP + 0.0075), DARK)
cyl('lamp arm', 0.008, 0.42, (-0.82, 0.25, TOP + 0.21), DARK)
bpy.ops.mesh.primitive_cone_add(radius1=0.11, radius2=0.04, depth=0.13, location=(-0.78, 0.3, TOP + 0.42), rotation=(math.radians(25), 0, 0), vertices=48)
bpy.context.object.data.materials.append(SHADE)
bpy.ops.object.shade_smooth()
cyl('pot', 0.07, 0.11, (0.86, 0.17, TOP + 0.055), POT)
bpy.ops.mesh.primitive_ico_sphere_add(radius=0.13, subdivisions=2, location=(0.86, 0.17, TOP + 0.24))
bpy.context.object.data.materials.append(LEAF)
for i, (w, c) in enumerate([(0.24, (0.5, 0.12, 0.1)), (0.22, (0.1, 0.2, 0.4)), (0.2, (0.7, 0.6, 0.3))]):
    box('book', (w, 0.16, 0.03), (-0.6, 0.2, TOP + 0.015 + i * 0.03), mat(f'book {i}', c, 0.7), rot=(0, 0, 0.1 * i))

# the light: a warm lamp, the cool of the window, a faint fill; the screens light the desk themselves
bpy.ops.object.light_add(type='POINT', location=(-0.77, 0.33, TOP + 0.36))
lamp = bpy.context.object.data
lamp.energy = 28
lamp.color = (1.0, 0.72, 0.45)
lamp.shadow_soft_size = 0.04
bpy.ops.object.light_add(type='AREA', location=(0, -1.2, 2.2), rotation=(math.radians(-70), 0, 0))
win = bpy.context.object.data
win.energy = 260
win.color = (0.6, 0.72, 1.0)
win.size = 4
bpy.ops.object.light_add(type='AREA', location=(0.3, 2.6, 2.3), rotation=(math.radians(50), 0, 0))
fill = bpy.context.object.data
fill.energy = 22
fill.color = (1.0, 0.85, 0.7)
fill.size = 2

world = bpy.data.worlds.new('world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.012, 0.02, 1)
scene.world = world

# the view: seated at the desk, a little to the left of its middle
cam = bpy.data.cameras.new('camera')
cam.lens = 25
cam.sensor_width = 36
co = bpy.data.objects.new('camera', cam)
bpy.context.collection.objects.link(co)
co.location = (0.0, 1.85, 1.22)
aim = Vector((0.02, 0.2, 0.96))
co.rotation_euler = (aim - co.location).to_track_quat('-Z', 'Y').to_euler()
scene.camera = co

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = int(sys.argv[2]) if len(sys.argv) > 2 else 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.filepath = sys.argv[1]
bpy.ops.render.render(write_still=True)
