import argparse
import json
import math
import sys

import bpy
from mathutils import Matrix, Vector

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--kind', choices=['cannon', 'qing'], required=True)
parser.add_argument('--yaw-deg', type=float)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=args.input)
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not meshes:
    raise ValueError('Input has no mesh')

# Blender +Y exports as glTF -Z; the Meshy cannon muzzle faces -X.
yaw = args.yaw_deg if args.yaw_deg is not None else (-90 if args.kind == 'cannon' else 180)
rotation = Matrix.Rotation(math.radians(yaw), 4, 'Z')
for obj in meshes:
    transform = rotation @ obj.matrix_world
    obj.parent = None
    obj.data.transform(transform)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()

points = [v.co for obj in meshes for v in obj.data.vertices]
low = Vector(tuple(min(v[i] for v in points) for i in range(3)))
high = Vector(tuple(max(v[i] for v in points) for i in range(3)))
size = high - low
axis = 1 if args.kind == 'cannon' else 2
target = 2.2 if args.kind == 'cannon' else 1.75
if size[axis] <= 0:
    raise ValueError('Degenerate model bounds')
scale = target / size[axis]
center = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
transform = Matrix.Scale(scale, 4) @ Matrix.Translation(-center)
for obj in meshes:
    obj.data.transform(transform)
    obj.data.calc_loop_triangles()

budget = 8000 if args.kind == 'cannon' else 12000
total = sum(len(obj.data.loop_triangles) for obj in meshes)
if total > budget:
    for obj in meshes:
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new('Budget', 'DECIMATE')
        modifier.ratio = budget / total
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)

for image in bpy.data.images:
    width, height = image.size
    if max(width, height) > 1024:
        ratio = 1024 / max(width, height)
        image.scale(max(1, round(width * ratio)), max(1, round(height * ratio)))
        image.pack()
for material in bpy.data.materials:
    material.use_backface_culling = True

bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=args.output,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_draco_mesh_compression_enable=False,
    export_image_format='AUTO',
)
with open(args.output, 'rb') as file:
    data = file.read()
metadata = json.loads(data[20:20 + int.from_bytes(data[12:16], 'little')])
if 'KHR_draco_mesh_compression' in metadata.get('extensionsUsed', []):
    raise ValueError('Export still contains Draco')
print('GLB_OK', json.dumps({'kind': args.kind, 'bytes': len(data), 'yaw': yaw,
                          'source_triangles': total, 'scale': scale,
                          'textures': [list(image.size) for image in bpy.data.images]}))
