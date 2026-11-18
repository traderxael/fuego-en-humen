"""
Build rich 3D glTF (.glb) cinematic sets for Fuego en Humen using Blender 5.3.

Usage:
  blender -b -noaudio --factory-startup --python scripts/build_cinematic_models.py

Outputs (in assets/models/cinematics/):
  - humen-1839-opium.glb
  - humen-squadron-bogue.glb
  - humen-assault-breach.glb
  - humen-fall-memorial.glb
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_DIR = os.path.join(ROOT_DIR, "assets", "models", "cinematics")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0


def ensure_collection(name="Cinematics"):
    scene = bpy.context.scene
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        scene.collection.children.link(col)
    return col


def to_bl(tx, ty, tz):
    """Convert Three.js (+Y up, +Z toward viewer) to Blender (+Z up, +Y north)."""
    return Vector((tx, -tz, ty))


def make_empty(name, location=(0.0, 0.0, 0.0), parent=None, three_space=True):
    loc = to_bl(*location) if three_space else Vector(location)
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.25
    obj.location = loc
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def make_mat(name, base_color, roughness=0.75, metallic=0.0, emission=None, emission_strength=0.0):
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    mat = bpy.data.materials.new(name=name)
    if getattr(mat, "node_tree", None) is None and hasattr(mat, "use_nodes"):
        mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None:
        nt.nodes.clear()
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    rgba = (base_color[0], base_color[1], base_color[2], base_color[3] if len(base_color) > 3 else 1.0)
    bsdf.inputs["Base Color"].default_value = rgba
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = float(roughness)
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = float(metallic)
    if emission is not None and "Emission Color" in bsdf.inputs:
        em_rgba = (emission[0], emission[1], emission[2], 1.0)
        bsdf.inputs["Emission Color"].default_value = em_rgba
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = float(emission_strength)
    return mat


def _set_smooth_and_uv(obj, uv_scale=1.0):
    mesh = obj.data
    if not hasattr(mesh, "polygons"):
        return
    for poly in mesh.polygons:
        poly.use_smooth = True
    # Generate simple box-projected UVs in bmesh so glTF exports valid TEXCOORD_0.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    uv_layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        n = face.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            co = loop.vert.co * uv_scale
            if az >= ax and az >= ay:
                loop[uv_layer].uv = (co.x, co.y)
            elif ax >= ay and ax >= az:
                loop[uv_layer].uv = (co.y, co.z)
            else:
                loop[uv_layer].uv = (co.x, co.z)
    bm.to_mesh(mesh)
    bm.free()


def build_mesh_obj(name, bm, material, location=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0),
                   parent=None, three_space=True, bevel_width=0.0, bevel_segments=1, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = to_bl(*location) if three_space else Vector(location)
    obj.rotation_euler = Euler(rotation, "XYZ")
    if parent is not None:
        obj.parent = parent

    if material is not None:
        if isinstance(material, list):
            for m in material:
                mesh.materials.append(m)
        else:
            mesh.materials.append(material)

    if bevel_width > 0.0:
        mod = obj.modifiers.new(name="Bevel", type="BEVEL")
        mod.width = bevel_width
        mod.segments = bevel_segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(32.0)

    if smooth:
        _set_smooth_and_uv(obj)
    return obj


def bm_box(sx, sy, sz, center=(0, 0, 0), bm=None, mat_idx=0):
    own = bm is None
    if own:
        bm = bmesh.new()
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    mat_xf = Matrix.Translation(Vector(center)) @ Matrix.Diagonal(Vector((sx, sy, sz, 1.0)))
    bmesh.ops.transform(bm, matrix=mat_xf, verts=verts)
    if mat_idx > 0:
        vset = set(verts)
        for f in bm.faces:
            if all(v in vset for v in f.verts):
                f.material_index = mat_idx
    return bm


def bm_cyl(r1, r2, depth, segs=16, center=(0, 0, 0), rot=(0, 0, 0), bm=None, mat_idx=0):
    own = bm is None
    if own:
        bm = bmesh.new()
    res = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segs,
        radius1=r1,
        radius2=r2,
        depth=depth,
    )
    verts = res["verts"]
    xf = Matrix.Translation(Vector(center)) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=xf, verts=verts)
    if mat_idx > 0:
        vset = set(verts)
        for f in bm.faces:
            if all(v in vset for v in f.verts):
                f.material_index = mat_idx
    return bm


def bm_sphere(radius, segs=14, rings=10, scale=(1, 1, 1), center=(0, 0, 0), bm=None, mat_idx=0):
    own = bm is None
    if own:
        bm = bmesh.new()
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    verts = res["verts"]
    xf = Matrix.Translation(Vector(center)) @ Matrix.Diagonal(Vector((scale[0], scale[1], scale[2], 1.0)))
    bmesh.ops.transform(bm, matrix=xf, verts=verts)
    if mat_idx > 0:
        vset = set(verts)
        for f in bm.faces:
            if all(v in vset for v in f.verts):
                f.material_index = mat_idx
    return bm


def bm_lathe(profile_rz, segs=24, center=(0, 0, 0), rot=(0, 0, 0), bm=None, mat_idx=0):
    """Revolve a list of (radius, z) points around local Z axis."""
    own = bm is None
    if own:
        bm = bmesh.new()
    rings = []
    created_faces = []
    xf = Matrix.Translation(Vector(center)) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    for r, z in profile_rz:
        if r <= 1e-5:
            v = bm.verts.new(xf @ Vector((0.0, 0.0, z)))
            rings.append([v])
        else:
            ring = []
            for s in range(segs):
                a = 2.0 * math.pi * s / segs
                p = xf @ Vector((r * math.cos(a), r * math.sin(a), z))
                ring.append(bm.verts.new(p))
            rings.append(ring)

    for i in range(len(rings) - 1):
        r0 = rings[i]
        r1 = rings[i + 1]
        if len(r0) == 1 and len(r1) > 1:
            c = r0[0]
            for s in range(segs):
                f = bm.faces.new((c, r1[s], r1[(s + 1) % segs]))
                created_faces.append(f)
        elif len(r0) > 1 and len(r1) == 1:
            c = r1[0]
            for s in range(segs):
                f = bm.faces.new((r0[s], c, r0[(s + 1) % segs]))
                created_faces.append(f)
        elif len(r0) > 1 and len(r1) > 1:
            for s in range(segs):
                sn = (s + 1) % segs
                f = bm.faces.new((r0[s], r0[sn], r1[sn], r1[s]))
                created_faces.append(f)

    if mat_idx > 0:
        for f in created_faces:
            f.material_index = mat_idx
    return bm


def bm_torus(major_r, minor_r, major_segs=18, minor_segs=10, center=(0, 0, 0), rot=(0, 0, 0), bm=None, mat_idx=0):
    own = bm is None
    if own:
        bm = bmesh.new()
    xf = Matrix.Translation(Vector(center)) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    grid = []
    for i in range(major_segs):
        theta = 2.0 * math.pi * i / major_segs
        ct, st = math.cos(theta), math.sin(theta)
        ring = []
        for j in range(minor_segs):
            phi = 2.0 * math.pi * j / minor_segs
            r = major_r + minor_r * math.cos(phi)
            p = xf @ Vector((r * ct, r * st, minor_r * math.sin(phi)))
            ring.append(bm.verts.new(p))
        grid.append(ring)

    created = []
    for i in range(major_segs):
        inext = (i + 1) % major_segs
        for j in range(minor_segs):
            jnext = (j + 1) % minor_segs
            f = bm.faces.new((grid[i][j], grid[inext][j], grid[inext][jnext], grid[i][jnext]))
            created.append(f)
    if mat_idx > 0:
        for f in created:
            f.material_index = mat_idx
    return bm


def export_glb(filename):
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, filename)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    size_kb = os.path.getsize(out_path) / 1024.0
    print(f"EXPORTED {filename} ({size_kb:.1f} KB)")
    return out_path


# ==============================================================================
# SCENE 1: Humen Beach, 3 June 1839 — Opium Destruction (humem-1839-opium.glb)
# ==============================================================================
def build_opium_destruction_glb():
    reset_scene()

    m_granite = make_mat("Granite", (0.56, 0.50, 0.43), roughness=0.88)
    m_granite_dark = make_mat("GraniteDark", (0.35, 0.31, 0.27), roughness=0.92)
    m_crimson = make_mat("CrimsonLacquer", (0.54, 0.08, 0.06), roughness=0.35, metallic=0.05)
    m_gold = make_mat("ImperialGold", (0.85, 0.66, 0.16), roughness=0.25, metallic=0.88)
    m_roof_tile = make_mat("RoofGlazed", (0.14, 0.26, 0.28), roughness=0.40, metallic=0.1)
    m_wood = make_mat("AgedWood", (0.36, 0.22, 0.12), roughness=0.82)
    m_bamboo = make_mat("Bamboo", (0.58, 0.49, 0.27), roughness=0.72)
    m_lime_water = make_mat("LimeWaterMat", (0.64, 0.68, 0.56), roughness=0.22, metallic=0.08)
    m_opium = make_mat("RawOpium", (0.13, 0.08, 0.04), roughness=0.65)
    m_lime_sack = make_mat("LimeSack", (0.84, 0.81, 0.72), roughness=0.95)
    m_navy_silk = make_mat("NavySilk", (0.09, 0.16, 0.34), roughness=0.45)
    m_skin = make_mat("SkinTone", (0.82, 0.63, 0.46), roughness=0.62)
    m_jade_hat = make_mat("MandarinHat", (0.12, 0.10, 0.09), roughness=0.55)
    m_ruby = make_mat("RubyFinial", (0.78, 0.06, 0.08), roughness=0.15, metallic=0.2)

    # 1. Imperial Viewing Pavilion (seated overlooking pit on south-east shore)
    pav = make_empty("Pavilion", (0.0, 0.0, -3.5))
    # Stone terrace + 3 steps
    bm_pav = bm_box(7.8, 6.2, 0.75, (0, 0, 0.375), mat_idx=0)
    bm_box(8.3, 6.7, 0.22, (0, 0, 0.11), bm=bm_pav, mat_idx=1)
    for st in range(3):
        bm_box(3.4, 0.45, 0.20, (0, -3.3 - st * 0.42, 0.58 - st * 0.20), bm=bm_pav, mat_idx=1)
    # 4 corner columns + plinths
    for cx in (-2.9, 2.9):
        for cy in (-2.2, 2.2):
            bm_cyl(0.28, 0.32, 0.26, 12, (cx, cy, 0.88), bm=bm_pav, mat_idx=0)
            bm_cyl(0.16, 0.18, 2.95, 14, (cx, cy, 2.45), bm=bm_pav, mat_idx=2)
    # Carved wooden balustrade rails
    for bx in (-2.9, 2.9):
        bm_box(0.14, 4.3, 0.72, (bx, 0, 1.12), bm=bm_pav, mat_idx=2)
    bm_box(5.7, 0.14, 0.72, (0, 2.2, 1.12), bm=bm_pav, mat_idx=2)
    bm_box(1.5, 0.14, 0.72, (-2.15, -2.2, 1.12), bm=bm_pav, mat_idx=2)
    bm_box(1.5, 0.14, 0.72, (2.15, -2.2, 1.12), bm=bm_pav, mat_idx=2)
    # Inspection table inside pavilion
    bm_box(2.0, 0.9, 0.78, (0, -0.5, 1.14), bm=bm_pav, mat_idx=3)
    bm_cyl(0.06, 0.06, 0.48, 10, (-0.3, -0.5, 1.59), rot=(0, math.pi / 2, 0.2), bm=bm_pav, mat_idx=4)
    # Double-eave upturned hip roof
    bm_box(7.8, 6.2, 0.24, (0, 0, 3.96), bm=bm_pav, mat_idx=2)
    # Lower eave hipped tiers
    for tier, (w, d, z0, dz) in enumerate([(8.8, 7.2, 4.18, 0.62), (6.6, 5.2, 4.85, 0.85)]):
        # Build stepped flared roof frustum
        rings = [
            (w * 0.50, d * 0.50, z0 - 0.08),
            (w * 0.46, d * 0.46, z0 + 0.12),
            (w * 0.34, d * 0.34, z0 + dz * 0.65),
            (w * 0.18, d * 0.14, z0 + dz),
        ]
        mesh_rings = []
        for rx, ry, rz in rings:
            # 8 points around perimeter to give upturned corners!
            pts = [
                (rx, -ry, rz + (0.28 if rz == rings[0][2] else 0.0)),
                (0, -ry * 0.94, rz),
                (-rx, -ry, rz + (0.28 if rz == rings[0][2] else 0.0)),
                (-rx * 0.94, 0, rz),
                (-rx, ry, rz + (0.28 if rz == rings[0][2] else 0.0)),
                (0, ry * 0.94, rz),
                (rx, ry, rz + (0.28 if rz == rings[0][2] else 0.0)),
                (rx * 0.94, 0, rz),
            ]
            mesh_rings.append([bm_pav.verts.new(Vector(p)) for p in pts])
        for ri in range(len(mesh_rings) - 1):
            a, b = mesh_rings[ri], mesh_rings[ri + 1]
            for s in range(8):
                sn = (s + 1) % 8
                f = bm_pav.faces.new((a[s], a[sn], b[sn], b[s]))
                f.material_index = 5
    # Roof ridge & golden finials
    bm_box(2.8, 0.24, 0.26, (0, 0, 5.76), bm=bm_pav, mat_idx=5)
    bm_cyl(0.08, 0.02, 0.55, 10, (0, 0, 6.08), bm=bm_pav, mat_idx=4)
    build_mesh_obj(
        "Pavilion_Structure",
        bm_pav,
        [m_granite, m_granite_dark, m_crimson, m_wood, m_gold, m_roof_tile],
        three_space=False,
        parent=pav,
        bevel_width=0.02,
    )

    # 2. Lin Zexu standing on Pavilion front overlook watching dissolution pit
    lin = make_empty("LinZexu", (0.0, 0.78, -5.2))
    bm_lin = bmesh.new()
    # Long Mandarin court robe (lathe silhouette)
    bm_lathe(
        [
            (0.0, 0.0), (0.29, 0.0), (0.27, 0.45), (0.22, 0.95),
            (0.24, 1.32), (0.14, 1.44), (0.08, 1.50), (0.0, 1.50),
        ],
        segs=18,
        bm=bm_lin,
        mat_idx=0,
    )
    # Sleeves folded formally in front
    bm_cyl(0.11, 0.14, 0.56, 12, (-0.19, 0.14, 1.24), rot=(0.55, 0.4, 0), bm=bm_lin, mat_idx=0)
    bm_cyl(0.11, 0.14, 0.56, 12, (0.19, 0.14, 1.24), rot=(0.55, -0.4, 0), bm=bm_lin, mat_idx=0)
    # Rank badge (Buzi) + court beads
    bm_box(0.20, 0.03, 0.20, (0, 0.225, 1.25), bm=bm_lin, mat_idx=1)
    bm_torus(0.14, 0.018, 18, 8, (0, 0.16, 1.32), rot=(0.9, 0, 0), bm=bm_lin, mat_idx=1)
    # Head & face
    bm_sphere(0.135, 14, 10, (1, 0.95, 1.1), (0, 0.01, 1.62), bm=bm_lin, mat_idx=2)
    # Conical Mandarin hat + ruby button + red fringe + peacock plume
    bm_cyl(0.28, 0.12, 0.14, 18, (0, 0.0, 1.73), bm=bm_lin, mat_idx=3)
    bm_sphere(0.035, 10, 8, (1, 1, 1), (0, 0, 1.82), bm=bm_lin, mat_idx=4)
    bm_cyl(0.015, 0.01, 0.36, 8, (0, -0.18, 1.75), rot=(1.2, 0, 0), bm=bm_lin, mat_idx=5)
    build_mesh_obj(
        "LinZexu_Figure",
        bm_lin,
        [m_navy_silk, m_gold, m_skin, m_jade_hat, m_ruby, m_roof_tile],
        three_space=False,
        parent=lin,
    )

    # 3. Opium Dissolution Pit (North of pavilion, opening toward the sea -Z in Three / +Y in Blender)
    pit = make_empty("OpiumPit", (0.0, 0.0, -13.5))
    bm_pit = bmesh.new()
    # Floor slab + 4 beveled granite retaining walls with sluice gap on sea side
    bm_box(16.4, 9.6, 0.32, (0, 0, 0.16), bm=bm_pit, mat_idx=1)
    bm_box(16.6, 0.85, 1.35, (0, -4.6, 0.675), bm=bm_pit, mat_idx=0)  # South wall
    bm_box(0.85, 9.4, 1.35, (-8.0, 0, 0.675), bm=bm_pit, mat_idx=0)   # West wall
    bm_box(0.85, 9.4, 1.35, (8.0, 0, 0.675), bm=bm_pit, mat_idx=0)    # East wall
    # North wall split around 2.6m sluice channel
    bm_box(6.6, 0.85, 1.35, (-4.9, 4.6, 0.675), bm=bm_pit, mat_idx=0)
    bm_box(6.6, 0.85, 1.35, (4.9, 4.6, 0.675), bm=bm_pit, mat_idx=0)
    # Stone coping piers beside sluice
    bm_box(0.95, 1.15, 1.85, (-1.6, 4.6, 0.925), bm=bm_pit, mat_idx=1)
    bm_box(0.95, 1.15, 1.85, (1.6, 4.6, 0.925), bm=bm_pit, mat_idx=1)
    build_mesh_obj(
        "OpiumPit_StoneWalls",
        bm_pit,
        [m_granite, m_granite_dark],
        three_space=False,
        parent=pit,
        bevel_width=0.04,
    )

    # SluiceGate (animated vertical timber floodgate)
    bm_gate = bm_box(2.5, 0.22, 1.35, (0, 4.6, 0.68), mat_idx=0)
    bm_box(2.65, 0.28, 0.18, (0, 4.6, 1.42), bm=bm_gate, mat_idx=1)
    build_mesh_obj("SluiceGate", bm_gate, [m_wood, m_granite_dark], three_space=False, parent=pit)

    # LimeWater (subdivided wavy pool mesh inside the pit)
    bm_water = bmesh.new()
    nx, ny = 24, 16
    w_grid = []
    for iy in range(ny + 1):
        row = []
        for ix in range(nx + 1):
            wx = -7.5 + 15.0 * (ix / nx)
            wy = -4.1 + 8.2 * (iy / ny)
            wz = 0.68 + 0.07 * math.sin(wx * 1.1) * math.cos(wy * 1.3)
            row.append(bm_water.verts.new(Vector((wx, wy, wz))))
        w_grid.append(row)
    for iy in range(ny):
        for ix in range(nx):
            bm_water.faces.new((w_grid[iy][ix], w_grid[iy][ix + 1], w_grid[iy + 1][ix + 1], w_grid[iy + 1][ix]))
    build_mesh_obj("LimeWater", bm_water, m_lime_water, three_space=False, parent=pit)

    # OpiumChests stacked along pit rim + white lime sacks
    bm_chests = bmesh.new()
    chest_coords = [
        (-9.6, -2.5, 0.42, 0.12), (-9.8, -0.4, 0.42, -0.08), (-9.7, -1.5, 1.24, 0.05),
        (9.5, -2.2, 0.42, -0.2), (9.7, 0.1, 0.42, 0.15), (9.5, -1.1, 1.24, -0.1),
        (-5.5, -5.8, 0.42, 0.04), (-3.4, -5.8, 0.42, -0.06), (4.8, -5.9, 0.42, 0.09),
    ]
    for cx, cy, cz, yaw in chest_coords:
        tmp = bm_box(1.55, 1.05, 0.84, (0, 0, 0), mat_idx=0)
        # Iron corner straps
        bm_box(1.58, 1.08, 0.10, (0, 0, 0.34), bm=tmp, mat_idx=1)
        bm_box(1.58, 1.08, 0.10, (0, 0, -0.34), bm=tmp, mat_idx=1)
        xf = Matrix.Translation(Vector((cx, cy, cz))) @ Euler((0, 0, yaw), "XYZ").to_matrix().to_4x4()
        bmesh.ops.transform(tmp, matrix=xf, verts=tmp.verts)
        # Merge into bm_chests
        mesh_tmp = bpy.data.meshes.new("_tmp_c")
        tmp.to_mesh(mesh_tmp)
        tmp.free()
        bm_chests.from_mesh(mesh_tmp)
        bpy.data.meshes.remove(mesh_tmp)
    # Lime sacks
    for sx, sy, rotz in [(-6.8, -6.2, 0.4), (6.4, -6.1, -0.5), (7.6, -5.5, 0.2)]:
        bm_sphere(0.45, 10, 8, (1.25, 0.85, 0.7), (sx, sy, 0.32), bm=bm_chests, mat_idx=2)
    build_mesh_obj(
        "OpiumChests",
        bm_chests,
        [m_wood, m_granite_dark, m_lime_sack],
        three_space=False,
        parent=pit,
        bevel_width=0.015,
    )

    # OpiumBalls (raw opium cakes floating/dissolving in pool)
    bm_balls = bmesh.new()
    for i in range(18):
        bx = -5.6 + (i % 6) * 2.2 + ((i * 37) % 10) * 0.05
        by = -2.4 + (i // 6) * 2.1
        bm_sphere(0.32, 10, 8, (1.0, 1.0, 0.82), (bx, by, 0.72), bm=bm_balls)
    build_mesh_obj("OpiumBalls", bm_balls, m_opium, three_space=False, parent=pit)

    # Paddles (wooden stirring rakes used by workers at pit edge)
    bm_paddles = bmesh.new()
    for i, px in enumerate([-5.2, -1.8, 1.8, 5.2]):
        rot_x = 0.45 if i % 2 == 0 else -0.45
        py = -4.2 if i % 2 == 0 else 3.2
        bm_cyl(0.045, 0.045, 3.6, 8, (px, py, 1.55), rot=(rot_x, 0, 0.08 * i), bm=bm_paddles, mat_idx=0)
        bm_box(0.55, 0.22, 0.06, (px, py + (1.2 if i % 2 == 0 else -1.2), 0.78), bm=bm_paddles, mat_idx=1)
    build_mesh_obj("Paddles", bm_paddles, [m_bamboo, m_wood], three_space=False, parent=pit)

    return export_glb("humen-1839-opium.glb")


# ==============================================================================
# SCENE 2: Squadron Forces Bogue, 23 Feb 1841 (humen-squadron-bogue.glb)
# ==============================================================================
def build_squadron_bogue_glb():
    reset_scene()

    m_iron_hull = make_mat("IronHull", (0.10, 0.11, 0.13), roughness=0.45, metallic=0.65)
    m_red_hull = make_mat("RedBottom", (0.48, 0.11, 0.09), roughness=0.72)
    m_deck = make_mat("TeakDeck", (0.48, 0.34, 0.20), roughness=0.78)
    m_brass = make_mat("NavalBrass", (0.82, 0.64, 0.22), roughness=0.28, metallic=0.88)
    m_wood_dark = make_mat("DarkOak", (0.28, 0.17, 0.09), roughness=0.82)
    m_paddle_red = make_mat("PaddleWheelRed", (0.62, 0.12, 0.10), roughness=0.58)
    m_sail = make_mat("CanvasSail", (0.89, 0.85, 0.74), roughness=0.90)
    m_junk_sail = make_mat("QingBattenedSail", (0.64, 0.48, 0.26), roughness=0.88)
    m_rust_iron = make_mat("ForgedIron", (0.19, 0.18, 0.17), roughness=0.55, metallic=0.85)
    m_cliff = make_mat("BogueGranite", (0.44, 0.39, 0.33), roughness=0.93)
    m_ensign = make_mat("WhiteEnsignMat", (0.92, 0.90, 0.86), roughness=0.82)
    m_crimson = make_mat("CrimsonAccent", (0.68, 0.12, 0.10), roughness=0.65)

    # 1. HEICS Nemesis (iron paddle steamer facing south/+Z in Three => -Y in Blender, centered near Three (0,0,-40))
    nem = make_empty("Nemesis", (0.0, 0.0, -40.0))
    bm_hull = bmesh.new()
    # Sculpted streamlined iron hull (4-station lofted hull profile along Blender Y)
    stations = [
        (-9.0, 0.15, 1.3, 0.0),   # sharp bow (-Y -> Three +Z toward forts)
        (-6.2, 1.45, 1.45, -0.8),
        (-2.0, 2.35, 1.55, -1.0),
        (3.5, 2.30, 1.55, -1.0),
        (7.5, 1.75, 1.65, -0.7),
        (8.8, 1.10, 1.75, -0.2),  # transom stern
    ]
    hull_rings = []
    for sy, hw, ztop, zbot in stations:
        pts = [
            (0.0, sy, zbot),
            (hw * 0.72, sy, zbot + 0.35),
            (hw, sy, 0.25),
            (hw * 0.98, sy, ztop),
            (-hw * 0.98, sy, ztop),
            (-hw, sy, 0.25),
            (-hw * 0.72, sy, zbot + 0.35),
        ]
        hull_rings.append([bm_hull.verts.new(Vector(p)) for p in pts])
    for i in range(len(hull_rings) - 1):
        a, b = hull_rings[i], hull_rings[i + 1]
        for s in range(7):
            sn = (s + 1) % 7
            f = bm_hull.faces.new((a[s], a[sn], b[sn], b[s]))
            f.material_index = 1 if s in (0, 6) else 0
    # Close bow & stern caps
    bm_hull.faces.new(hull_rings[0]).material_index = 0
    bm_hull.faces.new(list(reversed(hull_rings[-1]))).material_index = 0
    # Teak deck + paddle boxes + bridge + bowsprit + masts + pivot guns
    bm_box(4.2, 14.5, 0.18, (0, 0.2, 1.52), bm=bm_hull, mat_idx=2)
    bm_box(5.8, 1.6, 0.75, (0, 0.2, 1.95), bm=bm_hull, mat_idx=0)  # captain's bridge
    # Twin paddlewheel housings
    for sx in (-2.7, 2.7):
        bm_cyl(1.65, 1.65, 0.95, 14, (sx, 0.2, 1.25), rot=(0, math.pi / 2, 0), bm=bm_hull, mat_idx=0)
    # Bowsprit + fore/main masts + yards
    bm_cyl(0.09, 0.04, 4.6, 10, (0, -10.5, 2.1), rot=(1.32, 0, 0), bm=bm_hull, mat_idx=3)
    for my, mh in [(-3.6, 9.8), (3.8, 8.8)]:
        bm_cyl(0.16, 0.08, mh, 12, (0, my, 1.5 + mh / 2), bm=bm_hull, mat_idx=3)
        bm_cyl(0.07, 0.05, 5.2, 8, (0, my, 1.5 + mh * 0.55), rot=(0, math.pi / 2, 0), bm=bm_hull, mat_idx=3)
        bm_cyl(0.06, 0.04, 3.8, 8, (0, my, 1.5 + mh * 0.82), rot=(0, math.pi / 2, 0), bm=bm_hull, mat_idx=3)
        # Furled/half-set canvas sails
        bm_box(4.8, 0.25, 2.6, (0, my - 0.15, 1.5 + mh * 0.65), bm=bm_hull, mat_idx=4)
    # Bow and stern 32-pounder pivot guns
    for gy, yaw in [(-6.2, 0.0), (6.4, math.pi)]:
        bm_cyl(0.95, 0.95, 0.22, 14, (0, gy, 1.62), bm=bm_hull, mat_idx=3)
        bm_cyl(0.16, 0.11, 2.4, 12, (0, gy - (0.7 if yaw == 0 else -0.7), 2.02), rot=(math.pi / 2, 0, yaw), bm=bm_hull, mat_idx=5)
    build_mesh_obj(
        "Nemesis_Hull",
        bm_hull,
        [m_iron_hull, m_red_hull, m_deck, m_wood_dark, m_sail, m_brass],
        three_space=False,
        parent=nem,
        bevel_width=0.02,
    )

    # Tall central iron Funnel
    bm_fun = bm_cyl(0.46, 0.42, 6.2, 16, (0, 0.2, 4.8), mat_idx=0)
    bm_torus(0.45, 0.06, 16, 8, (0, 0.2, 7.6), bm=bm_fun, mat_idx=1)
    build_mesh_obj("Funnel", bm_fun, [m_iron_hull, m_brass], three_space=False, parent=nem)

    # Wheel_L & Wheel_R (pivoted at axle center so scenes.js rotates rotation.x cleanly!)
    for side_name, sx in [("Wheel_L", -2.95), ("Wheel_R", 2.95)]:
        wheel_empty = make_empty(side_name, (sx, 0.2, 1.05), parent=nem, three_space=False)
        bm_w = bm_torus(1.25, 0.08, 16, 8, (0, 0, 0), rot=(0, math.pi / 2, 0), mat_idx=0)
        bm_torus(0.75, 0.06, 14, 8, (0, 0, 0), rot=(0, math.pi / 2, 0), bm=bm_w, mat_idx=0)
        for sp in range(10):
            a = 2.0 * math.pi * sp / 10
            py = math.cos(a) * 1.25
            pz = math.sin(a) * 1.25
            bm_box(0.78, 0.22, 0.09, (0, py, pz), bm=bm_w, mat_idx=1)
            # Spoke bar
            bm_cyl(0.05, 0.05, 2.5, 8, (0, 0, 0), rot=(a, 0, 0), bm=bm_w, mat_idx=0)
        build_mesh_obj(side_name + "_Paddles", bm_w, [m_rust_iron, m_paddle_red], three_space=False, parent=wheel_empty)

    # White Ensign on Nemesis stern gaff
    bm_ens = bm_box(0.06, 2.2, 1.35, (0, 8.6, 5.2), mat_idx=0)
    bm_box(0.08, 0.9, 0.65, (0, 8.0, 5.55), bm=bm_ens, mat_idx=1)
    build_mesh_obj("Ensign", bm_ens, [m_ensign, m_crimson], three_space=False, parent=nem)

    # 2. Qing War Junk (defender flanking the river chain at Three (14, 0, -28))
    junk = make_empty("WarJunk", (14.0, 0.0, -28.0))
    bm_jk = bmesh.new()
    # Curved junk hull + raised stern gallery
    j_stations = [
        (-5.5, 0.95, 1.35, -0.35),
        (-2.5, 1.95, 1.25, -0.8),
        (1.8, 2.05, 1.55, -0.8),
        (5.4, 1.65, 2.65, -0.35),
    ]
    j_rings = []
    for sy, hw, ztop, zbot in j_stations:
        pts = [
            (0.0, sy, zbot),
            (hw * 0.82, sy, 0.1),
            (hw, sy, ztop),
            (-hw, sy, ztop),
            (-hw * 0.82, sy, 0.1),
        ]
        j_rings.append([bm_jk.verts.new(Vector(p)) for p in pts])
    for i in range(len(j_rings) - 1):
        a, b = j_rings[i], j_rings[i + 1]
        for s in range(5):
            sn = (s + 1) % 5
            bm_jk.faces.new((a[s], a[sn], b[sn], b[s])).material_index = 0
    bm_jk.faces.new(j_rings[0]).material_index = 0
    bm_jk.faces.new(list(reversed(j_rings[-1]))).material_index = 1
    bm_box(3.4, 10.2, 0.18, (0, 0.1, 1.28), bm=bm_jk, mat_idx=2)
    # 3 masts + dragon bow eyes + 4 broadside guns
    for my, mh in [(-3.0, 6.2), (0.2, 8.2), (3.4, 5.4)]:
        bm_cyl(0.13, 0.08, mh, 10, (0, my, 1.3 + mh / 2), bm=bm_jk, mat_idx=0)
    for gx in (-1.75, 1.75):
        for gy in (-1.2, 1.2):
            bm_cyl(0.11, 0.08, 1.05, 8, (gx, gy, 1.48), rot=(0, math.pi / 2, 0), bm=bm_jk, mat_idx=3)
    build_mesh_obj("WarJunk_Hull", bm_jk, [m_wood_dark, m_crimson, m_deck, m_brass], three_space=False, parent=junk)

    # 3 Battened Junk Lug Sails
    for s_name, sy, sw, sh, sz in [
        ("Sail_Fore", -3.0, 2.8, 3.8, 4.4),
        ("Sail_Main", 0.2, 4.1, 5.2, 5.4),
        ("Sail_Mizzen", 3.4, 2.4, 3.2, 4.1),
    ]:
        bm_s = bm_box(sw, 0.12, sh, (0, sy, sz), mat_idx=0)
        for b in range(5):
            bz = sz - sh * 0.42 + b * (sh * 0.21)
            bm_cyl(0.04, 0.04, sw + 0.3, 8, (0, sy, bz), rot=(0, math.pi / 2, 0), bm=bm_s, mat_idx=1)
        build_mesh_obj(s_name, bm_s, [m_junk_sail, m_wood_dark], three_space=False, parent=junk)

    # 3. Iron Chain Boom (across strait at Three z=-31)
    boom = make_empty("IronChainBoom", (0.0, 0.0, -31.0))
    bm_pon = bmesh.new()
    for px in (-18.0, -9.0, 0.0, 9.0, 18.0):
        bm_box(1.5, 4.4, 0.65, (px, 0, 0.18), bm=bm_pon, mat_idx=0)
        bm_box(1.7, 0.9, 0.35, (px, 0, 0.60), bm=bm_pon, mat_idx=1)
    build_mesh_obj("Pontoons", bm_pon, [m_wood_dark, m_rust_iron], three_space=False, parent=boom)

    bm_chain = bmesh.new()
    for li in range(36):
        lx = -18.5 + li * 1.05
        # Catenary sag between pontoons
        sag = 0.25 * math.sin((lx % 9.0) / 9.0 * math.pi)
        rot_x = (math.pi / 2) if (li % 2 == 0) else 0.12
        bm_torus(0.32, 0.085, 14, 8, (lx, 0, 0.72 - sag), rot=(rot_x, 0, math.pi / 2), bm=bm_chain)
    build_mesh_obj("ChainLinks", bm_chain, m_rust_iron, three_space=False, parent=boom)

    # 4. Anunghoy Coastal Cliff & Casemate Battery on west bank (Three (-24, 0, -28))
    bat = make_empty("AnunghoyBattery", (-24.0, 0.0, -28.0))
    bm_bat = bmesh.new()
    bm_box(14.0, 18.0, 6.5, (0, 0, 2.2), bm=bm_bat, mat_idx=0)
    bm_box(9.5, 13.0, 3.8, (2.2, 0, 6.0), bm=bm_bat, mat_idx=0)
    # Stone battery wall + merlons + 4 bronze cannons pointing at Nemesis
    bm_box(1.8, 13.0, 2.8, (6.5, 0, 3.8), bm=bm_bat, mat_idx=1)
    for mi in range(-5, 6, 2):
        bm_box(1.4, 1.4, 1.1, (6.5, mi * 1.15, 5.75), bm=bm_bat, mat_idx=1)
    for cy in (-3.6, -1.2, 1.2, 3.6):
        bm_cyl(0.18, 0.12, 2.4, 10, (7.6, cy, 4.35), rot=(0, math.pi / 2, 0), bm=bm_bat, mat_idx=2)
    build_mesh_obj("AnunghoyBattery_Cliff", bm_bat, [m_cliff, m_wood_dark, m_brass], three_space=False, parent=bat, bevel_width=0.08)

    return export_glb("humen-squadron-bogue.glb")


# ==============================================================================
# SCENE 3: Rear Assault & Guan Tianpei, 26 Feb 1841 (humen-assault-breach.glb)
# ==============================================================================
def build_assault_breach_glb():
    reset_scene()

    m_stone = make_mat("BastionStone", (0.52, 0.45, 0.37), roughness=0.92)
    m_scorch = make_mat("ScorchedStone", (0.20, 0.17, 0.15), roughness=0.96)
    m_timber = make_mat("GateTimber", (0.33, 0.20, 0.11), roughness=0.84)
    m_iron = make_mat("IronHardware", (0.18, 0.18, 0.20), roughness=0.42, metallic=0.85)
    m_armor_red = make_mat("QingBrigandine", (0.58, 0.11, 0.09), roughness=0.52)
    m_brass = make_mat("ArmorBrass", (0.86, 0.67, 0.21), roughness=0.24, metallic=0.90)
    m_steel = make_mat("SaberSteel", (0.82, 0.84, 0.88), roughness=0.18, metallic=0.96)
    m_skin = make_mat("HeroSkin", (0.82, 0.62, 0.45), roughness=0.60)
    m_bamboo = make_mat("LadderWood", (0.52, 0.39, 0.21), roughness=0.80)
    m_jade_seal = make_mat("ImperialJadeSeal", (0.16, 0.56, 0.34), roughness=0.22, metallic=0.05)
    m_yellow_silk = make_mat("ImperialSilk", (0.90, 0.72, 0.16), roughness=0.42)
    m_bronze = make_mat("CannonBronze", (0.36, 0.28, 0.14), roughness=0.35, metallic=0.82)

    # 1. Breached Bastion Wall (centered at Three origin (0,0,0), rampart height 4.2m)
    bas = make_empty("BreachedBastion", (0.0, 0.0, 0.0))
    bm_bas = bmesh.new()
    # Left & Right bastion wings leaving a 3.6m central gatehouse breach + flanking return walls
    bm_box(16.0, 3.0, 4.2, (-10.0, 0, 2.1), bm=bm_bas, mat_idx=0)
    bm_box(16.0, 3.0, 4.2, (10.0, 0, 2.1), bm=bm_bas, mat_idx=0)
    # Stone gate lintel cracked by cannonade
    bm_box(4.6, 3.1, 0.95, (0, 0, 3.72), bm=bm_bas, mat_idx=1)
    # Rampart walkway ledge + merlons (with blasted gap around center)
    for mx in (-16, -13.5, -11, -8.5, -6, 6, 8.5, 11, 13.5, 16):
        bm_box(1.5, 0.7, 1.05, (mx, -1.15, 4.72), bm=bm_bas, mat_idx=0)
    # Blasted stone rubble piles at base of breach
    rubble_spots = [
        (-2.6, -2.1, 0.35, 0.9), (-1.4, -2.8, 0.28, 0.75), (1.8, -2.5, 0.32, 0.85),
        (2.8, -1.9, 0.42, 1.0), (-0.4, -3.2, 0.22, 0.65),
    ]
    for rx, ry, rz, rs in rubble_spots:
        bm_box(rs, rs * 0.8, rs * 0.65, (rx, ry, rz), bm=bm_bas, mat_idx=1)
    # Bamboo gabion baskets atop parapet
    for gx in (-7.2, -4.4, 4.4, 7.2):
        bm_cyl(0.45, 0.45, 0.95, 12, (gx, -1.1, 4.68), bm=bm_bas, mat_idx=3)
    build_mesh_obj(
        "BreachedBastion_Masonry",
        bm_bas,
        [m_stone, m_scorch, m_timber, m_bamboo],
        three_space=False,
        parent=bas,
        bevel_width=0.04,
    )

    # Gate_L & Gate_R (pivoted at outer jambs x=-1.95 and x=+1.95 so they open inward!)
    for gname, hx, dir_x, rot_z in [("Gate_L", -1.95, 1.0, 0.42), ("Gate_R", 1.95, -1.0, -0.58)]:
        gate_empty = make_empty(gname, (hx, -0.2, 0.0), parent=bas, three_space=False)
        gate_empty.rotation_euler = Euler((0, 0, rot_z), "XYZ")
        bm_g = bm_box(1.88, 0.22, 3.25, (dir_x * 0.94, 0, 1.625), mat_idx=0)
        # Iron reinforcement cross straps & hemispherical door studs
        for sz in (0.6, 1.6, 2.6):
            bm_box(1.86, 0.26, 0.14, (dir_x * 0.94, 0, sz), bm=bm_g, mat_idx=1)
            for sx in (0.35, 0.94, 1.52):
                bm_sphere(0.055, 8, 6, (1, 0.6, 1), (dir_x * sx, -0.14, sz), bm=bm_g, mat_idx=1)
        build_mesh_obj(gname + "_Leaf", bm_g, [m_timber, m_iron], three_space=False, parent=gate_empty)

    # 2. SiegeLadders (3 Assault Ladders resting against Three +Z face of wall)
    ladders = make_empty("SiegeLadders", (0.0, 0.0, 0.0))
    for idx, lx in enumerate([-7.2, -3.6, 6.4], start=1):
        lad = make_empty(f"Ladder_{idx}", (lx, 0.0, 2.2), parent=ladders)
        bm_lad = bmesh.new()
        for rx in (-0.36, 0.36):
            bm_cyl(0.05, 0.05, 5.4, 8, (rx, 0, 2.5), bm=bm_lad, mat_idx=0)
            # Iron grappling hook at top
            bm_cyl(0.035, 0.025, 0.55, 8, (rx, 0.22, 5.15), rot=(1.35, 0, 0), bm=bm_lad, mat_idx=1)
        for r in range(11):
            bm_cyl(0.032, 0.032, 0.74, 8, (0, 0, 0.38 + r * 0.46), rot=(0, math.pi / 2, 0), bm=bm_lad, mat_idx=0)
        build_mesh_obj(
            f"Ladder_{idx}_Wood",
            bm_lad,
            [m_bamboo, m_iron],
            location=(0, 0, 0),
            rotation=(-0.26, 0, 0),
            three_space=False,
            parent=lad,
        )

    # 3. Admiral Guan Tianpei on rampart walkway (Three (0, 4.2, -0.8)) holding drawn Saber + ImperialSeal + Cannon
    guan = make_empty("GuanTianpei", (0.0, 4.2, -0.8))
    bm_guan = bmesh.new()
    # Brigandine armored skirt & chest plate with brass studs
    bm_lathe(
        [(0.0, 0.0), (0.34, 0.0), (0.31, 0.55), (0.25, 0.92), (0.28, 1.38), (0.14, 1.48), (0.0, 1.48)],
        segs=16,
        bm=bm_guan,
        mat_idx=0,
    )
    # Pauldrons + Brass chest mirror (Huxinjing) + belt
    bm_sphere(0.14, 10, 8, (1.1, 0.9, 0.8), (-0.28, 0, 1.38), bm=bm_guan, mat_idx=1)
    bm_sphere(0.14, 10, 8, (1.1, 0.9, 0.8), (0.28, 0, 1.38), bm=bm_guan, mat_idx=1)
    bm_cyl(0.13, 0.13, 0.05, 16, (0, -0.25, 1.24), rot=(math.pi / 2, 0, 0), bm=bm_guan, mat_idx=1)
    # Left & Right arms (right arm raised forward holding sword grip)
    bm_cyl(0.075, 0.065, 0.56, 10, (-0.31, -0.10, 1.15), rot=(-0.35, 0.25, 0), bm=bm_guan, mat_idx=0)
    bm_cyl(0.075, 0.065, 0.58, 10, (0.31, -0.26, 1.36), rot=(-1.25, -0.2, 0), bm=bm_guan, mat_idx=0)
    # Head + battle beard + Iron/Brass Qing officer helmet with red plume
    bm_sphere(0.135, 12, 10, (1, 0.95, 1.08), (0, 0, 1.62), bm=bm_guan, mat_idx=2)
    bm_cone_top = bm_cyl(0.21, 0.06, 0.22, 16, (0, 0, 1.78), bm=bm_guan, mat_idx=3)
    bm_cyl(0.025, 0.04, 0.22, 8, (0, 0, 1.98), bm=bm_guan, mat_idx=0)
    build_mesh_obj("GuanTianpei_Body", bm_guan, [m_armor_red, m_brass, m_skin, m_iron], three_space=False, parent=guan)

    # Curved Liuyedao Saber in Guan Tianpei's right hand
    saber_empty = make_empty("Saber", (0.34, 1.42, 0.45), parent=guan)
    bm_sab = bm_cyl(0.025, 0.025, 0.22, 8, (0, 0, 0.05), rot=(0.4, 0, 0), mat_idx=1)
    bm_cyl(0.09, 0.09, 0.03, 14, (0, -0.05, 0.16), rot=(0.4, 0, 0), bm=bm_sab, mat_idx=1)
    # Segmented gently-curved steel blade
    for seg in range(6):
        t = seg / 5.0
        bm_box(0.024, 0.068, 0.18, (0, -0.12 - t * 0.18, 0.25 + seg * 0.155), bm=bm_sab, mat_idx=0)
    build_mesh_obj("Saber_Blade", bm_sab, [m_steel, m_brass], three_space=False, parent=saber_empty)

    # ImperialSeal (Commander's Seal wrapped in yellow silk on stand next to Guan Tianpei)
    bm_seal = bm_box(0.55, 0.45, 0.85, (-1.1, 0.2, 0.425), mat_idx=0)
    bm_box(0.32, 0.32, 0.18, (-1.1, 0.2, 0.94), bm=bm_seal, mat_idx=1)
    bm_box(0.16, 0.16, 0.18, (-1.1, 0.2, 1.12), bm=bm_seal, mat_idx=2)
    bm_sphere(0.06, 10, 8, (1, 1, 1.2), (-1.1, 0.2, 1.24), bm=bm_seal, mat_idx=2)
    build_mesh_obj("ImperialSeal", bm_seal, [m_timber, m_yellow_silk, m_jade_seal], three_space=False, parent=guan)

    # AdmiralCannon beside Guan Tianpei on rampart
    bm_acan = bmesh.new()
    bm_box(0.95, 1.65, 0.55, (1.9, 0.2, 0.28), bm=bm_acan, mat_idx=1)
    bm_cyl(0.24, 0.16, 2.65, 16, (1.9, -0.2, 0.72), rot=(math.pi / 2 - 0.08, 0, 0), bm=bm_acan, mat_idx=0)
    bm_torus(0.21, 0.035, 14, 8, (1.9, -1.45, 0.82), rot=(math.pi / 2, 0, 0), bm=bm_acan, mat_idx=0)
    build_mesh_obj("AdmiralCannon", bm_acan, [m_bronze, m_timber], three_space=False, parent=guan)

    return export_glb("humen-assault-breach.glb")


# ==============================================================================
# SCENE 4: Fort Taken & Humen Bell, 26 Feb 1841 (humen-fall-memorial.glb)
# ==============================================================================
def build_fall_memorial_glb():
    reset_scene()

    m_bronze = make_mat("AgedBronze", (0.34, 0.29, 0.18), roughness=0.38, metallic=0.84)
    m_bronze_bright = make_mat("ReliefBronze", (0.58, 0.46, 0.22), roughness=0.28, metallic=0.90)
    m_timber = make_mat("BelfryTimber", (0.28, 0.16, 0.09), roughness=0.82)
    m_iron = make_mat("SpikedIron", (0.16, 0.16, 0.18), roughness=0.45, metallic=0.85)
    m_stone = make_mat("BrokenStone", (0.48, 0.42, 0.35), roughness=0.92)
    m_qing_banner = make_mat("FallenQingBanner", (0.78, 0.62, 0.16), roughness=0.86)
    m_red_cloth = make_mat("RedFlagCloth", (0.72, 0.12, 0.11), roughness=0.84)
    m_blue_cloth = make_mat("BlueFlagCanton", (0.10, 0.18, 0.42), roughness=0.84)
    m_white_cloth = make_mat("WhiteFlagCross", (0.92, 0.91, 0.88), roughness=0.85)

    # 1. HumenBell (centered on courtyard plinth at Three (0, 0, 6))
    mem = make_empty("HumenBell", (0.0, 0.0, 6.0))
    bm_frame = bm_box(3.4, 2.2, 0.45, (0, 0, 0.225), mat_idx=1)  # stone plinth
    # Twin carved timber pillars, crossbeam & curved roof beam
    for px in (-1.35, 1.35):
        bm_box(0.28, 0.28, 3.6, (px, 0, 2.25), bm=bm_frame, mat_idx=0)
        bm_box(0.38, 0.85, 0.35, (px, 0, 0.60), bm=bm_frame, mat_idx=0)
    bm_box(3.4, 0.36, 0.32, (0, 0, 3.92), bm=bm_frame, mat_idx=0)
    bm_box(3.8, 1.15, 0.22, (0, 0, 4.18), bm=bm_frame, mat_idx=2)
    build_mesh_obj("BellFrame", bm_frame, [m_timber, m_stone, m_bronze], three_space=False, parent=mem, bevel_width=0.02)

    # BellBody pivoted at suspension beam z=3.75 so it can toll gently!
    bell_pivot = make_empty("BellBody", (0.0, 3.75, 0.0), parent=mem)
    bm_bell = bm_lathe(
        [
            (0.0, 0.0),
            (0.28, -0.15),
            (0.42, -0.35),
            (0.48, -0.95),
            (0.56, -1.65),
            (0.72, -2.15),
            (0.64, -2.18),
            (0.48, -1.65),
            (0.38, -0.45),
            (0.0, -0.45),
        ],
        segs=28,
        bm=None,
        mat_idx=0,
    )
    # Pu Lao dragon suspension loop at top
    bm_torus(0.18, 0.055, 16, 8, (0, 0, 0.02), rot=(math.pi / 2, 0, 0), bm=bm_bell, mat_idx=1)
    # Decorative bronze relief rings & rows of acoustic bosses (mei)
    for ring_r, ring_z in [(0.45, -0.60), (0.51, -1.25), (0.61, -1.85)]:
        bm_torus(ring_r, 0.028, 24, 8, (0, 0, ring_z), bm=bm_bell, mat_idx=1)
    for row_z, row_r in [(-0.78, 0.48), (-0.98, 0.50)]:
        for bi in range(12):
            a = 2.0 * math.pi * bi / 12
            bm_sphere(0.042, 8, 6, (1, 1, 1), (row_r * math.cos(a), row_r * math.sin(a), row_z), bm=bm_bell, mat_idx=1)
    build_mesh_obj("BellBody_Bronze", bm_bell, [m_bronze, m_bronze_bright], three_space=False, parent=bell_pivot)

    # 2. CapturedArtillery (lined up disarmed bronze guns beside broken carriages at Three (-6, 0, 8))
    art = make_empty("CapturedArtillery", (-5.5, 0.0, 8.5))
    bm_art = bmesh.new()
    for gi, (gx, gy, yaw) in enumerate([(-2.5, -1.5, 0.35), (0.5, 0.2, -0.25), (3.6, -1.2, 0.6)]):
        # Broken carriage planks on ground + barrel resting skewed
        bm_box(0.85, 1.5, 0.38, (gx, gy, 0.19), bm=bm_art, mat_idx=1)
        bm_cyl(0.22, 0.14, 2.45, 14, (gx, gy, 0.52), rot=(math.pi / 2, 0.08, yaw), bm=bm_art, mat_idx=0)
        # Dolphin handles
        bm_torus(0.12, 0.025, 10, 6, (gx, gy, 0.72), rot=(0, math.pi / 2, yaw), bm=bm_art, mat_idx=0)
        # Iron spike hammered into vent
        bm_cyl(0.02, 0.015, 0.24, 6, (gx - math.sin(yaw) * 0.8, gy + math.cos(yaw) * 0.8, 0.82), bm=bm_art, mat_idx=2)
    # Pyramid of captured cannonballs
    for bx in (-0.9, -0.5, -0.1):
        for by in (1.9, 2.3):
            bm_sphere(0.17, 10, 8, (1, 1, 1), (bx, by, 0.17), bm=bm_art, mat_idx=2)
    bm_sphere(0.17, 10, 8, (1, 1, 1), (-0.5, 2.1, 0.44), bm=bm_art, mat_idx=2)
    build_mesh_obj("CapturedArtillery_Guns", bm_art, [m_bronze, m_timber, m_iron], three_space=False, parent=art)

    # 3. FallenStandard (fallen Qing banner leaning against rubble near wall at Three (5.5, 0, 4.5))
    fall_std = make_empty("FallenStandard", (5.5, 0.0, 4.5))
    bm_fstd = bmesh.new()
    bm_cyl(0.055, 0.04, 3.8, 10, (0, 0, 0.42), rot=(1.32, 0, 0.4), bm=bm_fstd, mat_idx=0)
    bm_box(1.5, 0.06, 1.05, (0.65, -1.1, 0.52), bm=bm_fstd, mat_idx=1)
    build_mesh_obj("FallenStandard_Banner", bm_fstd, [m_timber, m_qing_banner], three_space=False, parent=fall_std)

    # 4. UnionFlagPole & waving FlagCloth atop the captured bastion (Three (-3.0, 4.2, -0.6))
    fpole = make_empty("UnionFlagPole", (-3.0, 4.2, -0.6))
    bm_fp = bm_cyl(0.075, 0.05, 5.4, 12, (0, 0, 2.7), mat_idx=0)
    bm_sphere(0.11, 10, 8, (1, 1, 1), (0, 0, 5.45), bm=bm_fp, mat_idx=1)
    build_mesh_obj("UnionFlagPole_Mast", bm_fp, [m_timber, m_bronze_bright], three_space=False, parent=fpole)

    # Subdivided FlagCloth pinned at x=0 along pole top (z=4.2..5.25)
    fcloth_pivot = make_empty("FlagCloth", (0.0, 4.72, 0.0), parent=fpole)
    bm_fc = bmesh.new()
    fx_steps, fz_steps = 12, 6
    fc_grid = []
    for iz in range(fz_steps + 1):
        row = []
        for ix in range(fx_steps + 1):
            fx = 2.6 * (ix / fx_steps)
            fz = -0.68 + 1.36 * (iz / fz_steps)
            fy = 0.14 * math.sin(fx * 2.1) * (ix / fx_steps)
            row.append(bm_fc.verts.new(Vector((fx, fy, fz))))
        fc_grid.append(row)
    for iz in range(fz_steps):
        for ix in range(fx_steps):
            f = bm_fc.faces.new((fc_grid[iz][ix], fc_grid[iz][ix + 1], fc_grid[iz + 1][ix + 1], fc_grid[iz + 1][ix]))
            # Stylised Union / Red Ensign pattern: blue canton + white diagonal + red field
            is_canton = (ix < fx_steps // 2) and (iz >= fz_steps // 2)
            is_cross = (iz == fz_steps // 2) or (ix == fx_steps // 4)
            f.material_index = 2 if (is_canton and is_cross) else (1 if is_canton else 0)
    build_mesh_obj("FlagCloth_Mesh", bm_fc, [m_red_cloth, m_blue_cloth, m_white_cloth], three_space=False, parent=fcloth_pivot)

    return export_glb("humen-fall-memorial.glb")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    paths = [
        build_opium_destruction_glb(),
        build_squadron_bogue_glb(),
        build_assault_breach_glb(),
        build_fall_memorial_glb(),
    ]
    print("ALL CINEMATIC GLBS BUILT:", paths)


if __name__ == "__main__":
    main()
