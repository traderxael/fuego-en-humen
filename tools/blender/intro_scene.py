# Cinematic intro for "Fuego en Humen" - procedural low-poly scene, no assets.
# Rendered headless with Cycles CPU, PNG sequence out (ffmpeg encodes later).
#
#   blender --background --factory-startup --python tools/blender/intro_scene.py -- \
#       <out_dir> <first_frame> <last_frame> <res_x> <res_y> <samples>

import bpy
import math
import os
import sys

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT_DIR = argv[0] if len(argv) > 0 else '/tmp/fu-eh-frames'
F_FIRST = int(argv[1]) if len(argv) > 1 else 1
F_LAST = int(argv[2]) if len(argv) > 2 else 240
RES_X = int(argv[3]) if len(argv) > 3 else 640
RES_Y = int(argv[4]) if len(argv) > 4 else 360
SAMPLES = int(argv[5]) if len(argv) > 5 else 12

os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------- scene reset
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


# ------------------------------------------------------------------- palette
M_ADOBE = mat('adobe', (0.46, 0.33, 0.19), 0.95)
M_ADOBE_D = mat('adobe_dark', (0.36, 0.25, 0.14), 0.95)
M_ROOF = mat('roof', (0.22, 0.12, 0.08), 0.9)
M_WOOD = mat('wood', (0.18, 0.10, 0.06), 0.9)
M_IRON = mat('iron', (0.07, 0.07, 0.08), 0.5, 0.7)
M_SAND = mat('sand', (0.38, 0.31, 0.22), 1.0)
M_DIRT = mat('dirt', (0.26, 0.20, 0.13), 1.0)
M_SEA = mat('sea', (0.010, 0.028, 0.050), 0.30, 0.0)
M_SAIL = mat('sail', (0.34, 0.32, 0.29), 0.95)
M_SHIP = mat('ship', (0.05, 0.04, 0.035), 0.9)
M_FLAG_BLUE = mat('flag_blue', (0.06, 0.11, 0.28), 0.9)
M_FLAG_YELLOW = mat('flag_yellow', (0.62, 0.47, 0.08), 0.9)
M_FLASH = mat('flash', (1.0, 0.72, 0.35), 0.4, 0.0, emit=(1.0, 0.70, 0.32), emit_strength=60.0)

# --------------------------------------------------------------------- world
# Dawn gradient: warm band at the horizon -> deep blue zenith.
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
# World 'Generated' is the view direction in [-1,1]: remap so the horizon
# lands on 0.5 and the gradient actually reads.
mapr = nt.nodes.new('ShaderNodeMapRange')
mapr.inputs['From Min'].default_value = -1.0
mapr.inputs['From Max'].default_value = 1.0
mapr.inputs['To Min'].default_value = 0.0
mapr.inputs['To Max'].default_value = 1.0
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
nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

# ---------------------------------------------------------------------- land
# Beach strip behind the fort only; seaward is open water.
box('sand', (320, 150, 0.6), (0, 50, -0.3), material=M_SAND)
# Packed dirt inside the fort, so the courtyard reads apart from the beach.
box('courtyard', (39, 26, 0.1), (0, 0.5, 0.02), material=M_DIRT)

# Sea: grid displaced by a noise texture so the low sun breaks on it.
bpy.ops.mesh.primitive_grid_add(x_subdivisions=44, y_subdivisions=36, size=2,
                                location=(0, -160, -0.25))
sea = bpy.context.object
sea.name = 'sea'
sea.scale = (210, 150, 1)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
noise_tex = bpy.data.textures.new('wave_noise', type='CLOUDS')
noise_tex.noise_scale = 22.0
dis = sea.modifiers.new('Displace', 'DISPLACE')
dis.texture = noise_tex
dis.strength = 0.5
dis.mid_level = 0.5
sea.data.materials.append(M_SEA)

# --------------------------------------------------------------------- fort
fort_box = None


def fb(name, size, loc, rot=(0, 0, 0), material=M_ADOBE):
    ob = box(name, size, loc, rot, material)
    return ob


# U-shaped fort opening seaward (-Y). Low seaward parapet the player fires over.
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
    x = -18 + i * 3.0
    fb('cren_n%d' % i, (1.0, 1.7, 0.42), (x, -14, 1.72))
for i in range(13):
    x = -18 + i * 3.0
    fb('cren_s%d' % i, (1.0, 1.7, 0.42), (x, 14, 5.11))

# Fort cannons, barrels pointing seaward.
CANNONS = [(-12, -10.5), (-4, -11.5), (4, -11.5), (12, -10.5)]
for i, (cx, cy) in enumerate(CANNONS):
    box('carriage%d' % i, (0.8, 1.7, 0.36), (cx, cy, 0.18), material=M_WOOD)
    cyl('barrel%d' % i, 0.15, 2.1, (cx, cy - 0.35, 0.82),
        rot=(math.radians(84), 0, 0), material=M_IRON)
    for wx in (-0.45, 0.45):
        cyl('wheel%d_%s' % (i, wx), 0.34, 0.12, (cx + wx, cy + 0.45, 0.34),
            rot=(0, math.radians(90), 0), verts=10, material=M_WOOD)

# Qing flag on the tower (yellow field, blue border).
cyl('flag_pole', 0.05, 3.4, (-18, 12, 10.4), verts=8, material=M_WOOD)
box('flag_field', (1.5, 0.04, 1.0), (-17.2, 12, 11.5), material=M_FLAG_YELLOW)
box('flag_border_top', (1.5, 0.05, 0.14), (-17.2, 12, 12.0), material=M_FLAG_BLUE)
box('flag_border_bot', (1.5, 0.05, 0.14), (-17.2, 12, 11.0), material=M_FLAG_BLUE)
box('flag_border_l', (0.14, 0.05, 1.0), (-17.95, 12, 11.5), material=M_FLAG_BLUE)
box('flag_border_r', (0.14, 0.05, 1.0), (-16.45, 12, 11.5), material=M_FLAG_BLUE)

# ------------------------------------------------------------------- fleet
# British squadron closing on the fort: hulls, masts and sails, backlit.
SHIPS = [
    (-62, -92, 2.4, 0.22), (-34, -74, 1.9, 0.08), (-8, -104, 2.7, -0.10),
    (20, -78, 2.1, 0.16), (48, -100, 2.5, -0.18), (78, -70, 1.8, 0.30),
    (-88, -128, 2.9, 0.05), (30, -140, 3.1, -0.06),
]
for i, (sx, sy, s, rotz) in enumerate(SHIPS):
    box('hull%d' % i, (3.4, 10.5, 1.2), (sx, sy, 0.5), rot=(0, 0, rotz), material=M_SHIP)
    box('deck%d' % i, (3.0, 9.6, 0.18), (sx, sy, 1.18), rot=(0, 0, rotz), material=M_WOOD)
    for m, mz, mh in ((0, -3.6, 7.0), (1, 0.6, 8.6), (2, 4.4, 6.0)):
        cyl('mast%d_%d' % (i, m), 0.09, mh, (sx, sy + mz, 1.3 + mh / 2), verts=6, material=M_WOOD)
        box('sail%d_%d' % (i, m), (2.4, 0.07, 2.1), (sx, sy + mz, 1.3 + mh * 0.62),
            rot=(0, 0, rotz), material=M_SAIL)

# ------------------------------------------------------------------- lights
# Low sun out at sea: the fleet reads as dark silhouettes against the dawn.
sun_data = bpy.data.lights.new('sun', 'SUN')
sun_data.energy = 3.6
sun_data.color = (1.0, 0.58, 0.28)
sun_data.angle = math.radians(0.7)
sun = bpy.data.objects.new('sun', sun_data)
sun.location = (-30, -90, 14)
sun.rotation_euler = (math.radians(76), 0, math.radians(-24))
scene.collection.objects.link(sun)

# The British squadron opens fire: a broadside flash out on the water, so it
# reads from inside the fort (the parapet hides the fort's own gun muzzles).
try:
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
except Exception:
    pass
flash_data = bpy.data.lights.new('flash', 'POINT')
flash_data.energy = 0.0
flash_data.color = (1.0, 0.74, 0.42)
flash_data.shadow_soft_size = 1.2
flash = bpy.data.objects.new('flash', flash_data)
flash.location = (20, -74, 3.5)
scene.collection.objects.link(flash)
for f in (228, 229, 230, 231, 232, 233):
    flash_data.energy = 40000.0
    flash_data.keyframe_insert('energy', frame=f)
for f in (227, 234):
    flash_data.energy = 0.0
    flash_data.keyframe_insert('energy', frame=f)
flash_data.energy = 0.0
flash_data.keyframe_insert('energy', frame=F_LAST)
sphere = cyl('flash_ball', 1.3, 1.3, (20, -74, 3.5), rot=(math.radians(90), 0, 0), verts=8,
             material=M_FLASH)
for f in (228, 229, 230, 231, 232):
    sphere.scale = (1.0, 1.0, 1.0)
    sphere.keyframe_insert('scale', frame=f)
for f in (227, 233):
    sphere.scale = (0.01, 0.01, 0.01)
    sphere.keyframe_insert('scale', frame=f)

# ------------------------------------------------------------------ cameras
# Three shots, hard cuts via timeline markers. Each camera tracks its own
# animated empty target.
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


# Shot 1 - from beyond the fleet, the squadron closing on the distant fort.
cam_a = make_cam('cam_a', 40.0, [
    (1, (-46, -178, 24), (-6, -60, 4)),
    (95, (-14, -150, 13), (0, -48, 4)),
])

# Shot 2 - from the parapet, the squadron dead ahead, slow push in.
cam_b = make_cam('cam_b', 40.0, [
    (96, (0, -11.5, 4.0), (2, -95, 7)),
    (170, (0, -11.0, 3.4), (-4, -99, 7)),
])

# Shot 3 - inside the fort along the gun line, the fleet beyond, flash at the end.
cam_c = make_cam('cam_c', 32.0, [
    (171, (-10, -8.5, 3.2), (16, -58, 6)),
    (240, (5, -9.5, 3.0), (30, -76, 7)),
])

for fr, cam in ((1, cam_a), (96, cam_b), (171, cam_c)):
    marker = scene.timeline_markers.new('cut%d' % fr, frame=fr)
    marker.camera = cam
scene.camera = cam_a

# ------------------------------------------------------------------- render
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 2
scene.cycles.diffuse_bounces = 1
scene.cycles.glossy_bounces = 1
scene.cycles.transmission_bounces = 1
scene.cycles.transparent_max_bounces = 2
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.06
scene.cycles.blur_glossy = 1.5
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

print('SCENE_READY frames %d-%d res %dx%d samples %d out %s'
      % (F_FIRST, F_LAST, RES_X, RES_Y, SAMPLES, OUT_DIR))

bpy.ops.render.render(animation=True)
print('RENDER_DONE')
