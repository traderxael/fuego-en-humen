# Wave intermission clips for "Fuego en Humen" - one procedural shot per wave,
# rendered headless with Cycles CPU (PNG sequence; ffmpeg encodes later).
#
#   blender --background --factory-startup --python tools/blender/wave_scene.py -- \
#       <out_dir> <first_frame> <last_frame> <res_x> <res_y> <samples> <wave 1..5>
#
# Wave 1 Chuenpi: war junks in two lines, earthen forts, a junk on fire.
# Wave 2 Bogue:   the paddle steamer Nemesis, the chain boom and rafts.
# Wave 3 Anunghoy: fort walls with unit banners, landing boats, broadside.
# Wave 4 Wangtong: boats, scaling ladders and the small earthen battery.
# Wave 5 Fall:    the fort in smoke, the British ensign over the tower.

import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_DIR = argv[0] if len(argv) > 0 else '/tmp/fu-wave'
F_FIRST = int(argv[1]) if len(argv) > 1 else 1
F_LAST = int(argv[2]) if len(argv) > 2 else 84
RES_X = int(argv[3]) if len(argv) > 3 else 640
RES_Y = int(argv[4]) if len(argv) > 4 else 360
SAMPLES = int(argv[5]) if len(argv) > 5 else 10
WAVE = int(argv[6]) if len(argv) > 6 else 1
ENGINE = (argv[7] if len(argv) > 7 else 'cycles').lower()

os.makedirs(OUT_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start = F_FIRST
scene.frame_end = F_LAST
scene.render.fps = 24


def mat(name, color, rough=0.9, metallic=0.0, emit=None, emit_strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = (emit[0], emit[1], emit[2], 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    return m


def box(name, size, loc, rot=(0, 0, 0), material=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        ob.data.materials.append(material)
    return ob


def cyl(name, radius, depth, loc, rot=(0, 0, 0), verts=12, material=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts,
                                        location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    if material:
        ob.data.materials.append(material)
    return ob


def cone(name, radius, depth, loc, rot=(0, 0, 0), verts=4, material=None):
    bpy.ops.mesh.primitive_cone_add(radius1=radius, radius2=0.0, depth=depth,
                                    vertices=verts, location=loc, rotation=rot)
    ob = bpy.context.object
    ob.name = name
    if material:
        ob.data.materials.append(material)
    return ob


def sphere(name, radius, loc, material=None, segments=12):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc,
                                         segments=segments, ring_count=max(6, segments // 2))
    ob = bpy.context.object
    ob.name = name
    if material:
        ob.data.materials.append(material)
    return ob


# ------------------------------------------------------------------- palette
M_ADOBE = mat('adobe', (0.46, 0.33, 0.19), 0.95)
M_ROOF = mat('roof', (0.22, 0.12, 0.08), 0.9)
M_WOOD = mat('wood', (0.18, 0.10, 0.06), 0.9)
M_IRON = mat('iron', (0.07, 0.07, 0.08), 0.5, 0.7)
M_SAND = mat('sand', (0.38, 0.31, 0.22), 1.0)
M_DIRT = mat('dirt', (0.26, 0.20, 0.13), 1.0)
M_SEA = mat('sea', (0.010, 0.028, 0.050), 0.30, 0.0)
M_SAIL = mat('sail', (0.34, 0.32, 0.29), 0.95)
M_JUNK_SAIL = mat('junk_sail', (0.30, 0.22, 0.12), 0.95)
M_SHIP = mat('ship', (0.05, 0.04, 0.035), 0.9)
M_STEAMER = mat('steamer', (0.06, 0.06, 0.07), 0.7, 0.2)
M_RED = mat('redcoat', (0.45, 0.07, 0.05), 0.9)
M_ENSIGN = mat('ensign', (0.72, 0.72, 0.70), 0.9)
M_BANNER = mat('banner', (0.62, 0.47, 0.08), 0.9)
M_BANNER_RED = mat('banner_red', (0.42, 0.05, 0.04), 0.9)
M_SMOKE = mat('smoke', (0.10, 0.10, 0.10), 1.0)
M_FIRE = mat('fire', (1.0, 0.55, 0.15), 0.4, 0.0, emit=(1.0, 0.45, 0.10), emit_strength=40.0)
M_FLASH = mat('flash', (1.0, 0.72, 0.35), 0.4, 0.0, emit=(1.0, 0.70, 0.32), emit_strength=60.0)

# --------------------------------------------------------------------- world
world = bpy.data.worlds.new('world')
scene.world = world
world.use_nodes = True
nt = world.node_tree
nt.nodes.clear()
out = nt.nodes.new('ShaderNodeOutputWorld')
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = 0.55
ramp = nt.nodes.new('ShaderNodeValToRGB')
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
texco = nt.nodes.new('ShaderNodeTexCoord')
mapr = nt.nodes.new('ShaderNodeMapRange')
mapr.inputs['From Min'].default_value = -1.0
mapr.inputs['From Max'].default_value = 1.0
nt.links.new(texco.outputs['Generated'], sep.inputs['Vector'])
nt.links.new(sep.outputs['Z'], mapr.inputs['Value'])
nt.links.new(mapr.outputs['Result'], ramp.inputs['Fac'])
els = ramp.color_ramp.elements
els[0].position = 0.40
els[0].color = (0.030, 0.055, 0.100, 1.0)
els[1].position = 0.60
els[1].color = (0.10, 0.20, 0.44, 1.0)
glow = ramp.color_ramp.elements.new(0.492)
glow.color = (1.15, 0.52, 0.16, 1.0)
warm = ramp.color_ramp.elements.new(0.455)
warm.color = (0.45, 0.19, 0.10, 1.0)
deep = ramp.color_ramp.elements.new(0.80)
deep.color = (0.04, 0.09, 0.26, 1.0)
if WAVE >= 5:
    glow.color = (0.85, 0.28, 0.10, 1.0)
    warm.color = (0.28, 0.10, 0.06, 1.0)
nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

# ---------------------------------------------------------------------- land
box('sand', (320, 150, 0.6), (0, 50, -0.3), material=M_SAND)
box('courtyard', (39, 26, 0.1), (0, 0.5, 0.02), material=M_DIRT)

bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=32, size=2,
                                location=(0, -150, -0.25))
sea = bpy.context.object
sea.name = 'sea'
sea.scale = (200, 140, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
noise_tex = bpy.data.textures.new('wave_noise', type='CLOUDS')
noise_tex.noise_scale = 22.0
dis = sea.modifiers.new('Displace', 'DISPLACE')
dis.texture = noise_tex
dis.strength = 0.45
dis.mid_level = 0.5
sea.data.materials.append(M_SEA)

# --------------------------------------------------------------------- fort
def fb(name, size, loc, rot=(0, 0, 0), material=M_ADOBE):
    return box(name, size, loc, rot, material)


fb('parapet', (40, 1.4, 1.3), (0, -14, 0.65))
fb('parapet_lip', (40, 1.7, 0.22), (0, -14, 1.41))
fb('arm_w', (10, 1.4, 4.0), (-23, -16, 2.0), rot=(0, 0, math.radians(60)))
fb('arm_e', (10, 1.4, 4.0), (23, -16, 2.0), rot=(0, 0, math.radians(-60)))
fb('wall_s', (40, 1.4, 5.0), (0, 14, 2.5))
fb('wall_w', (1.4, 28, 4.0), (-20, 0, 2.0))
fb('wall_e', (1.4, 28, 4.0), (20, 0, 2.0))
fb('tower', (4, 4, 7.0), (-18, 12, 3.5))
cone('tower_roof', 3.3, 2.4, (-18, 12, 8.2), rot=(0, 0, math.radians(45)), verts=4, material=M_ROOF)

for i in range(13):
    fb('cren_n%d' % i, (1.0, 1.7, 0.42), (-18 + i * 3.0, -14, 1.72))
    fb('cren_s%d' % i, (1.0, 1.7, 0.42), (-18 + i * 3.0, 14, 5.11))

CANNONS = [(-12, -10.5), (-4, -11.5), (4, -11.5), (12, -10.5)]
for i, (cx, cy) in enumerate(CANNONS):
    box('carriage%d' % i, (0.8, 1.7, 0.36), (cx, cy, 0.18), material=M_WOOD)
    cyl('barrel%d' % i, 0.15, 2.1, (cx, cy - 0.35, 0.82),
        rot=(math.radians(84), 0, 0), material=M_IRON)

# Unit banners on the walls and the tower: yellow field with a red border,
# the closest an 1841 garrison gets to a flag (no national ensign yet).
def banner(name, loc, height=1.0, material=M_BANNER, border=M_BANNER_RED):
    box(name, (1.5, 0.04, height), loc, material=material)
    box(name + '_b', (1.5, 0.05, 0.12), (loc[0], loc[1], loc[2] + height / 2), material=border)
    box(name + '_t', (1.5, 0.05, 0.12), (loc[0], loc[1], loc[2] - height / 2), material=border)


for i, x in enumerate((-14, -6, 6, 14)):
    cyl('bpole%d' % i, 0.04, 3.0, (x, -13.4, 1.5), verts=6, material=M_WOOD)
    banner('bflag%d' % i, (x + 0.78, -13.4, 2.5))
cyl('flag_pole', 0.05, 3.4, (-18, 12, 10.4), verts=8, material=M_WOOD)
banner('tower_flag', (-18.78, 12, 11.4), 1.1)

# ------------------------------------------------------------------- fleet
SHIPS = [
    (-62, -92, 2.4, 0.22), (-34, -74, 1.9, 0.08), (-8, -104, 2.7, -0.10),
    (20, -78, 2.1, 0.16), (48, -100, 2.5, -0.18), (78, -70, 1.8, 0.30),
    (-88, -128, 2.9, 0.05), (30, -140, 3.1, -0.06),
]
for i, (sx, sy, s, rotz) in enumerate(SHIPS):
    box('hull%d' % i, (3.4 * s, 10.5 * s, 1.2 * s), (sx, sy, 0.5), rot=(0, 0, rotz), material=M_SHIP)
    box('deck%d' % i, (3.0 * s, 9.6 * s, 0.18), (sx, sy, 1.18), rot=(0, 0, rotz), material=M_WOOD)
    for m, mz, mh in ((0, -3.6, 7.0), (1, 0.6, 8.6), (2, 4.4, 6.0)):
        cyl('mast%d_%d' % (i, m), 0.09, mh * s, (sx, sy + mz * s, 1.3 + mh * s / 2),
            verts=6, material=M_WOOD)
        box('sail%d_%d' % (i, m), (2.4 * s, 0.07, 2.1 * s), (sx, sy + mz * s, 1.3 + mh * s * 0.62),
            rot=(0, 0, rotz), material=M_SAIL)

# White ensign on the nearest ships (small, reads at 640x360).
for i, (sx, sy, s, rotz) in enumerate(SHIPS[:4]):
    box('ensign%d' % i, (1.2, 0.05, 0.7), (sx + 1.6 * s, sy, 9.0 * s), material=M_ENSIGN)


# ------------------------------------------------------------------ elements
def junk(name, x, y, rotz=0.0, scale=1.0, burning=False):
    box(name + '_hull', (3.0 * scale, 9.0 * scale, 1.1 * scale), (x, y, 0.55),
        rot=(0, 0, rotz), material=M_WOOD)
    box(name + '_deck', (2.6 * scale, 8.2 * scale, 0.16), (x, y, 1.1), rot=(0, 0, rotz), material=M_WOOD)
    for m, mz, mh in ((0, -2.6, 5.6), (1, 2.4, 5.0)):
        cyl(name + '_m%d' % m, 0.09, mh * scale, (x, y + mz * scale, 1.2 + mh * scale / 2),
            verts=6, material=M_WOOD)
        # Battened sail: three slats read as a junk sail at 640x360.
        for b in range(3):
            box(name + '_s%d_%d' % (m, b),
                (2.6 * scale, 0.08, 0.7 * scale),
                (x, y + mz * scale, 1.9 + b * 1.0 * scale),
                rot=(0, 0, rotz), material=M_JUNK_SAIL)
    box(name + '_pennant', (0.05, 1.4 * scale, 0.34), (x, y - 4.6 * scale, 8.4 * scale),
        material=M_BANNER_RED)
    if burning:
        for f in range(3):
            sphere(name + '_fire%d' % f, 0.7 - f * 0.15,
                   (x + 0.4 * f, y + 1.2 - f * 0.9, 3.2 + f * 1.1), material=M_FIRE, segments=10)
        for s in range(3):
            sphere(name + '_smoke%d' % s, 1.1 + s * 0.5,
                   (x + 0.6 * s, y + 1.0 - s * 1.4, 5.2 + s * 2.2), material=M_SMOKE, segments=10)


def steamer(name, x, y, rotz=0.0):
    box(name + '_hull', (3.6, 12.0, 1.3), (x, y, 0.65), rot=(0, 0, rotz), material=M_STEAMER)
    cone(name + '_bow', 1.5, 2.4, (x, y - 6.6, 0.65), rot=(math.radians(90), 0, 0),
         verts=8, material=M_STEAMER)
    box(name + '_deck', (3.2, 11.2, 0.16), (x, y, 1.3), rot=(0, 0, rotz), material=M_WOOD)
    for side in (-1, 1):
        cyl(name + '_wheelbox%d' % side, 0.85, 0.5, (x + side * 1.9, y, 1.2),
            rot=(0, math.radians(90), 0), verts=12, material=M_WOOD)
        cyl(name + '_wheel%d' % side, 0.95, 0.16, (x + side * 2.25, y, 1.2),
            rot=(0, math.radians(90), 0), verts=14, material=M_IRON)
    cyl(name + '_funnel', 0.28, 2.2, (x, y + 1.2, 2.6), verts=10, material=M_STEAMER)
    for m, mz, mh in ((0, -2.4, 6.0), (1, 3.6, 5.0)):
        cyl(name + '_mast%d' % m, 0.08, mh, (x, y + mz, 1.4 + mh / 2), verts=6, material=M_WOOD)
        box(name + '_sail%d' % m, (2.0, 0.06, 1.6), (x, y + mz, 1.4 + mh * 0.6), material=M_SAIL)
    box(name + '_ensign', (1.2, 0.05, 0.7), (x + 1.5, y + 4.2, 6.2), material=M_ENSIGN)


def chain_boom(name, y, segments=11):
    for i in range(segments):
        x = -30 + i * 6.0
        cyl(name + '_link%d' % i, 0.16, 5.2, (x + 3.0, y, 0.55),
            rot=(0, math.radians(90), 0), verts=8, material=M_IRON)
        if i % 2 == 0:
            box(name + '_raft%d' % i, (2.6, 2.2, 0.5), (x + 3.0, y - 1.6, 0.25), material=M_WOOD)


def landing_boat(name, x, y, rotz=0.0):
    box(name + '_hull', (2.2, 6.0, 0.7), (x, y, 0.35), rot=(0, 0, rotz), material=M_WOOD)
    for i in range(3):
        box(name + '_rower%d' % i, (0.5, 0.5, 0.9), (x, y - 1.6 + i * 1.2, 1.0),
            material=M_RED)
    box(name + '_ensign', (0.5, 0.04, 0.35), (x + 1.0, y + 2.4, 1.5), material=M_ENSIGN)


def earthwork(name, x, y, length=12.0, height=1.2):
    box(name, (length, 3.0, height), (x, y, height / 2), material=M_DIRT)
    for i in range(int(length // 2)):
        box(name + '_bag%d' % i, (1.2, 0.9, 0.4), (x - length / 2 + 1.0 + i * 2.0, y - 1.8, height + 0.2),
            material=M_WOOD)


if WAVE == 1:
    # Chuenpi/Taikoktow: two lines of junks and two earthen forts on the shore.
    for i in range(5):
        junk('junk_a%d' % i, -32 + i * 12.0, -52 - (i % 2) * 3.0, rotz=math.radians(8))
    for i in range(4):
        junk('junk_b%d' % i, -27 + i * 13.0, -68 - (i % 2) * 3.0, rotz=math.radians(-6))
    junk('junk_burn', 12, -46, rotz=math.radians(12), burning=True)
    earthwork('fort_e', -26, -30, 14)
    earthwork('fort_w', 26, -30, 14)
    for i in range(6):
        cyl('gun%d' % i, 0.16, 1.6, (-32 + i * 2.4, -31.6, 1.1),
            rot=(math.radians(80), 0, 0), material=M_IRON)
    steamer('nemesis', 44, -88, rotz=math.radians(-8))
elif WAVE == 2:
    steamer('nemesis', -6, -46, rotz=math.radians(4))
    chain_boom('boom', -36)
    for i in range(3):
        junk('junk%d' % i, -30 + i * 18.0, -58 - (i % 2) * 4.0, rotz=math.radians(6))
elif WAVE == 3:
    for i in range(5):
        landing_boat('boat%d' % i, -18 + i * 9.0, -34 - (i % 2) * 3.0, rotz=math.radians(4))
    steamer('nemesis', 34, -52, rotz=math.radians(-6))
    for i in range(4):
        junk('junk%d' % i, -34 + i * 17.0, -60, rotz=math.radians(-4))
elif WAVE == 4:
    earthwork('wangtong', 18, -26, 16, 1.4)
    for i in range(4):
        landing_boat('boat%d' % i, -20 + i * 8.0, -22 - (i % 2) * 2.5, rotz=math.radians(6))
    chain_boom('boom', -34, segments=9)
    for i in range(4):
        # Scaling ladders against the seaward parapet.
        box('ladder%d' % i, (0.16, 0.16, 4.2), (-6 + i * 4.0, -15.2, 2.1),
            rot=(math.radians(-18), 0, 0), material=M_WOOD)
    steamer('nemesis', -38, -56, rotz=math.radians(5))
else:
    # The fall: the fort under smoke, the ensign over the tower.
    box('ensign_tower', (1.6, 0.06, 1.0), (-18.9, 12, 11.6), material=M_ENSIGN)
    for i in range(10):
        sphere('smoke%d' % i, 1.4 + (i % 3) * 0.5,
               (-16 + i * 3.6, -10 + (i % 2) * 4.0, 5.0 + (i % 4) * 1.4),
               material=M_SMOKE, segments=10)
    for i in range(4):
        sphere('fire%d' % i, 0.7, (-12 + i * 8.0, -13.5, 2.2), material=M_FIRE, segments=10)
    steamer('nemesis', 8, -38, rotz=math.radians(-2))
    for i in range(3):
        junk('junk%d' % i, -28 + i * 20.0, -52, rotz=math.radians(8), burning=(i == 1))

# ------------------------------------------------------------------- lights
sun_data = bpy.data.lights.new('sun', 'SUN')
sun_data.energy = 3.2 if WAVE < 5 else 2.4
sun_data.color = (1.0, 0.58, 0.28) if WAVE < 5 else (1.0, 0.45, 0.22)
sun_data.angle = math.radians(0.7)
sun = bpy.data.objects.new('sun', sun_data)
sun.location = (-30, -90, 14)
sun.rotation_euler = (math.radians(76), 0, math.radians(-24))
scene.collection.objects.link(sun)

try:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
except Exception:
    pass

# Muzzle flashes per wave (small emissive balls that pop in and out).
def flash(name, loc, frames):
    ball = sphere(name, 0.7, loc, material=M_FLASH, segments=8)
    for f in frames:
        ball.scale = (1.0, 1.0, 1.0)
        ball.keyframe_insert('scale', frame=f)
    for f in (min(frames) - 2, max(frames) + 2):
        ball.scale = (0.01, 0.01, 0.01)
        ball.keyframe_insert('scale', frame=f)


if WAVE == 3:
    flash('muzzle_a', (14, -48, 2.6), range(30, 40, 2))
    flash('muzzle_b', (-22, -50, 2.6), range(52, 62, 2))
elif WAVE == 5:
    flash('muzzle_a', (4, -36, 2.0), range(20, 34, 3))


# ------------------------------------------------------------------ cameras
def make_cam(name, lens, keys):
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = lens
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    tgt = bpy.data.objects.new(name + '_target', None)
    scene.collection.objects.link(tgt)
    for fr, loc, tloc in keys:
        cam.location = loc
        cam.keyframe_insert('location', frame=fr)
        tgt.location = tloc
        tgt.keyframe_insert('location', frame=fr)
    con = cam.constraints.new('TRACK_TO')
    con.target = tgt
    con.track_axis = 'TRACK_NEGATIVE_Z'
    con.up_axis = 'UP_Y'
    return cam


SHOTS = {
    1: [(1, (-4, -92, 7.0), (2, -46, 4)), (F_LAST, (2, -74, 5.2), (10, -44, 3))],
    2: [(1, (-34, -82, 6.5), (-6, -40, 3)), (F_LAST, (-20, -62, 4.6), (-4, -38, 2.6))],
    3: [(1, (-24, -60, 7.5), (0, -20, 3)), (F_LAST, (-8, -40, 5.0), (6, -18, 2.4))],
    4: [(1, (-28, -50, 6.0), (-2, -20, 2)), (F_LAST, (-12, -32, 4.4), (8, -20, 1.8))],
    5: [(1, (0, -48, 12.0), (-6, -4, 6)), (F_LAST, (0, -30, 8.5), (-10, 2, 5))],
}
cam = make_cam('cam_wave', 38.0 if WAVE != 1 else 44.0, SHOTS[WAVE])
scene.camera = cam

# ------------------------------------------------------------------- render
if ENGINE == 'eevee':
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = SAMPLES
else:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = SAMPLES
if ENGINE != 'eevee':
    scene.cycles.use_denoising = True
scene.cycles.max_bounces = 2
scene.cycles.diffuse_bounces = 1
scene.cycles.glossy_bounces = 1
scene.cycles.transmission_bounces = 1
scene.cycles.transparent_max_bounces = 2
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.08
scene.cycles.sample_clamp_indirect = 3.0
scene.render.use_persistent_data = True
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.filepath = os.path.join(OUT_DIR, 'frame_')
scene.render.use_overwrite = True

try:
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
scene.view_settings.exposure = 0.0

print('WAVE_SCENE_READY engine %s wave %d frames %d-%d res %dx%d samples %d out %s'
      % (ENGINE, WAVE, F_FIRST, F_LAST, RES_X, RES_Y, SAMPLES, OUT_DIR))

bpy.ops.render.render(animation=True)
print('WAVE_RENDER_DONE %d' % WAVE)
