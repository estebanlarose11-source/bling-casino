# L'Olympe in 3D (owner's wish of 26 November 2026: « pousse Blender à fond, comme un studio professionnel »): the 5 gems
# of the game (assets/games/zeus/s0…s4: sapphire, emerald, topaz, amethyst, ruby), modelled for real in Blender and rendered
# with Cycles like a jeweller's photo: cut stones (convex hull of the facet points: every facet is a true plane), glass
# with refraction and dispersion (the rainbow « fire »), polished gold settings, black studio with strip lights.
# Used by sprites.py (the animated symbols of the game) and trailer.py (the showcase film).
# pip install bpy (Blender 5.3 as a Python module; renders on the CPU, no graphics card needed)
import math
import bmesh
import bpy
from mathutils import Vector

DATA = bpy.utils.resource_path('LOCAL') + '/datafiles/studiolights/world/'

# the 5 gems of L'Olympe, as in the owner's pictures: cut, colour, refractive index
GEMS = {
    's0': {'name': 'Saphir', 'cut': 'round', 'color': (0.12, 0.36, 1.0), 'ior': 1.77, 'abbe': 22},
    's1': {'name': 'Émeraude', 'cut': 'emerald', 'color': (0.10, 0.85, 0.32), 'ior': 1.58, 'abbe': 24},
    's2': {'name': 'Topaze', 'cut': 'cushion', 'color': (1.0, 0.72, 0.12), 'ior': 1.63, 'abbe': 20},
    's3': {'name': 'Améthyste', 'cut': 'cushion', 'color': (0.66, 0.22, 1.0), 'ior': 1.55, 'abbe': 22},
    's4': {'name': 'Rubis', 'cut': 'cushion', 'color': (1.0, 0.08, 0.10), 'ior': 1.77, 'abbe': 20},
}


def reset():
    global _gold
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _gold = None


def hull(name, pts):
    """a faceted stone: the convex hull of its facet points (every facet is flat, as on a real cut stone)"""
    bm = bmesh.new()
    for p in pts: bm.verts.new(p)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    # merge coplanar triangles into true facets (cleaner edges and highlights)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(0.4), verts=bm.verts, edges=bm.edges)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for f in me.polygons: f.use_smooth = False
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob


# radius of the girdle in direction a: round, cushion (superellipse) or emerald (square with cut corners)
def girdle_r(cut, a):
    if cut == 'round': return 1.0
    c, s = abs(math.cos(a)), abs(math.sin(a))
    if cut == 'cushion':
        n = 3.2
        return 1.0 / (c ** n + s ** n) ** (1 / n)
    # emerald: square 1 × 1 with corners cut at 0.30 (octagon)
    k = 0.70
    return 1.0 / max(c, s, (c + s) / (1 + k) * 1.0)


def ring(cut, n, r, z, rot=0.0):
    return [Vector((girdle_r(cut, a) * r * math.cos(a), girdle_r(cut, a) * r * math.sin(a), z))
            for a in [rot + 2 * math.pi * i / n for i in range(n)]]


def brilliant_points(cut):
    """round brilliant (sapphire) or cushion brilliant (topaz, amethyst, ruby): table, star and kite facets, upper
    girdle facets, girdle, lower girdle facets, pavilion mains, culet (standard proportions: table 56 %, crown 34°,
    pavilion 41°)"""
    g, crown, pav, table = 0.035, 0.30, 0.86, 0.56
    pts = []
    pts += ring(cut, 8, table, g + crown, math.pi / 8)                          # table
    zr = lambda r: g + crown * (1 - (r - table) / (1 - table))
    pts += ring(cut, 8, 0.80, zr(0.80) + 0.012, 0)                              # star tips / kite sides
    pts += ring(cut, 32, 1.0, g, math.pi / 32)                                  # girdle, top
    pts += ring(cut, 32, 1.0, -g, math.pi / 32)                                 # girdle, bottom
    pts += ring(cut, 8, 0.52, -g - pav * 0.48 - 0.012, 0)                       # lower girdle tips
    pts.append(Vector((0, 0, -g - pav)))                                         # culet
    return pts


def step_points():
    """emerald step cut: rows of steps on the crown and the pavilion, a long table"""
    pts = []
    for r, z in [(0.62, 0.30), (0.80, 0.23), (0.92, 0.14), (1.0, 0.035), (1.0, -0.035), (0.86, -0.25), (0.68, -0.48), (0.45, -0.70)]:
        pts += ring('emerald', 64, r, z)
    pts += [Vector((x, 0, -0.80)) for x in (-0.18, 0.18)]                        # keel
    return pts


def stone(key, name=None):
    G = GEMS[key]
    ob = hull(name or f'gem_{key}', step_points() if G['cut'] == 'emerald' else brilliant_points(G['cut']))
    ob.data.materials.append(gem_material(key))
    return ob


def setting(key, name=None):
    """the polished gold rim that holds the stone (follows its girdle), with a rounded profile"""
    cut = GEMS[key]['cut']
    N = 160
    # profile (radial offset, height) around the girdle: from inside the stone, over the top edge, down the outside
    prof = [(-0.05, 0.03), (-0.01, 0.10), (0.06, 0.14), (0.14, 0.13), (0.20, 0.07), (0.22, 0.0), (0.22, -0.12), (0.19, -0.21),
            (0.10, -0.25), (0.0, -0.23), (-0.06, -0.12)]
    verts, faces = [], []
    pl = []
    for i in range(N):
        a = 2 * math.pi * i / N
        r = girdle_r(cut, a)
        pl.append(Vector((r * math.cos(a), r * math.sin(a), 0)))
    for i in range(N):
        p, q, o = pl[i], pl[(i + 1) % N], pl[i - 1]
        t = (q - o).normalized()
        nrm = Vector((t.y, -t.x, 0)).normalized()
        for dr, z in prof: verts.append(p + nrm * dr + Vector((0, 0, z)))
    M = len(prof)
    for i in range(N):
        for j in range(M - 1):
            a, b = i * M + j, ((i + 1) % N) * M + j
            faces.append((a, b, b + 1, a + 1))
    me = bpy.data.meshes.new('set'); me.from_pydata(verts, [], faces); me.update()
    for f in me.polygons: f.use_smooth = True
    ob = bpy.data.objects.new(name or f'set_{key}', me); bpy.context.scene.collection.objects.link(ob)
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = sub.render_levels = 2
    ob.data.materials.append(gold_material())
    return ob


def gem_material(key):
    G = GEMS[key]
    m = bpy.data.materials.new(f'gem_{key}')
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    # colour mostly from the depth of crystal crossed (volume absorption), a little on the surface
    c = G['color']
    b.inputs['Base Color'].default_value = (0.55 + 0.45 * c[0], 0.55 + 0.45 * c[1], 0.55 + 0.45 * c[2], 1)
    vol = nt.nodes.new('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value = (*c, 1)
    vol.inputs['Density'].default_value = G.get('density', 2.2)
    nt.links.new(vol.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    b.inputs['Roughness'].default_value = 0.0
    b.inputs['IOR'].default_value = G['ior']
    b.inputs['Transmission Weight'].default_value = 1.0
    b.inputs['Transmission Dispersion Scale'].default_value = 1.0
    b.inputs['Transmission Dispersion Abbe Number'].default_value = G['abbe']
    b.inputs['Specular IOR Level'].default_value = 0.5
    return m


_gold = None
def gold_material():
    global _gold
    if _gold: return _gold
    m = bpy.data.materials.new('gold')
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (1.0, 0.60, 0.18, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.13
    b.inputs['Anisotropic'].default_value = 0.25
    _gold = m
    return m


def studio(strength=1.4, hdri='studio.exr', bg=(0, 0, 0)):
    """jeweller's studio: a dim HDRI for the gold, black behind, and strip lights that draw sharp lines in the facets"""
    sc = bpy.context.scene
    w = bpy.data.worlds.new('w'); sc.world = w
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = bpy.data.images.load(DATA + hdri)
    bgn = nt.nodes.new('ShaderNodeBackground'); bgn.inputs['Strength'].default_value = strength
    # the camera sees black (or bg), the reflections see the HDRI
    lp = nt.nodes.new('ShaderNodeLightPath')
    black = nt.nodes.new('ShaderNodeBackground'); black.inputs['Color'].default_value = (*bg, 1); black.inputs['Strength'].default_value = 1
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(env.outputs['Color'], bgn.inputs['Color'])
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(bgn.outputs['Background'], mix.inputs[1])
    nt.links.new(black.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])


def area(name, loc, look, size, power, color=(1, 1, 1), shape='RECTANGLE'):
    L = bpy.data.lights.new(name, 'AREA')
    L.shape = shape
    if shape in ('RECTANGLE', 'ELLIPSE'): L.size, L.size_y = size
    else: L.size = size[0]
    L.energy = power; L.color = color
    ob = bpy.data.objects.new(name, L); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def strips(scale=1.0, target=(0, 0, 0)):
    """3 long softboxes around and above + a warm kicker and a cold rim: the lines that make a stone sparkle"""
    s = scale
    return [
        area('key', (2.4 * s, -2.2 * s, 3.2 * s), target, (0.35 * s, 3.0 * s), 900 * s * s),
        area('fill', (-2.8 * s, -1.4 * s, 2.6 * s), target, (0.30 * s, 2.6 * s), 600 * s * s),
        area('top', (0.0, 0.6 * s, 4.0 * s), target, (2.2 * s, 0.25 * s), 700 * s * s),
        area('warm', (-1.6 * s, 2.4 * s, 0.6 * s), target, (0.6 * s, 0.6 * s), 380 * s * s, (1.0, 0.78, 0.5)),
        area('rim', (1.8 * s, 2.6 * s, 1.2 * s), target, (0.25 * s, 1.6 * s), 520 * s * s, (0.65, 0.8, 1.0)),
        area('front', (0.4 * s, -4.5 * s, 2.2 * s), target, (1.6 * s, 0.9 * s), 650 * s * s),
    ]


VIEW = ['Filmic', 'High Contrast']


def cycles(samples=256, w=512, h=512, transparent=True):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    c = sc.cycles
    c.device = 'CPU'
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.006
    c.use_denoising = True
    c.denoiser = 'OPENIMAGEDENOISE'
    c.max_bounces = 32
    c.transmission_bounces = 24
    c.glossy_bounces = 12
    c.diffuse_bounces = 3
    c.transparent_max_bounces = 16
    c.caustics_reflective = False
    c.caustics_refractive = False
    c.blur_glossy = 0.4
    c.sample_clamp_indirect = 30
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.view_settings.view_transform = VIEW[0]
    sc.view_settings.look = VIEW[1]
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    sc.render.threads_mode = 'AUTO'


def camera(loc, target=(0, 0, 0), lens=85):
    cam = bpy.data.cameras.new('cam'); cam.lens = lens
    ob = bpy.data.objects.new('cam', cam); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = ob
    return ob
