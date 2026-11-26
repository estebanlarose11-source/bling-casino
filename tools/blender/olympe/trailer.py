# L'Olympe in 3D: the showcase film (owner's wish of 26 November 2026: « un truc de ouf, comme un studio professionnel »),
# vertical 9:16 for phones, Snap and TikTok. Everything is modelled and animated in Blender (gems.py), rendered with Cycles:
#   0.0 s  night; Zeus's lightning strikes the centre, the flash lights everything, the 5 gems burst out of the strike;
#   1.0 s  the gems turn in a ring (a carousel seen from above) around a ball of storm energy, each one spinning on itself;
#   4.3 s  a second strike: the gold title L'OLYMPE rises and turns to face us, a light sweeps across its letters;
#   6.0 s  hold on the title, the gems in an arc above it.
# Then post.py: storm sky, gold dust, bloom, glints, grade -> tools/blender/olympe/out/olympe-3d.mp4 (1080 × 1920).
# python3 tools/blender/olympe/trailer.py [--from N] [--to N] [--preview]   (frames in BL_TMP, then --post)
import math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import gems

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = os.environ.get('BL_TMP', '/tmp/olympe-film')
FPS, SECONDS = 30, 7.0
N = int(FPS * SECONDS)
W, H = 540, 960          # rendered size (×2 in post)
QUICK = os.environ.get('BL_QUICK')  # preview: quarter size, few samples
KEYS = ['s0', 's1', 's2', 's3', 's4']
RING_R = 1.45
CENTER_Z = 1.45                    # centre of the wheel of gems
TILT = math.radians(28)            # the wheel leans back: the gems at the top are further away
STRIKE1, STRIKE2 = 6, 129          # frames of the 2 lightning strikes
TITLE_IN = (126, 156)              # the title rises
SWEEP = (160, 200)                 # the light sweeps across the title


def smooth(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
def back(t, s=1.7): t = min(1, max(0, t)) - 1; return 1 + t * t * ((s + 1) * t + s)   # ease out with overshoot


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1); em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m, em


def plasma():
    """the storm energy: swirling noise (it moves with W = time) from deep blue to white-cyan, brighter on the rim"""
    m = bpy.data.materials.new('plasma')
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.noise_dimensions = '4D'
    nz.inputs['Scale'].default_value = 4.2; nz.inputs['Detail'].default_value = 9; nz.inputs['Roughness'].default_value = 0.62
    nz.inputs['Distortion'].default_value = 1.6
    ramp = nt.nodes.new('ShaderNodeValToRGB'); cr = ramp.color_ramp
    cr.elements[0].position = 0.46; cr.elements[0].color = (0.005, 0.012, 0.09, 1)
    cr.elements[1].position = 0.60; cr.elements[1].color = (0.75, 0.95, 1.0, 1)
    e = cr.elements.new(0.53); e.color = (0.05, 0.28, 1.0, 1)
    fr = nt.nodes.new('ShaderNodeLayerWeight'); fr.inputs['Blend'].default_value = 0.35
    add = nt.nodes.new('ShaderNodeMix'); add.data_type = 'RGBA'; add.blend_type = 'ADD'
    add.inputs['B'].default_value = (0.25, 0.55, 1.0, 1)
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], add.inputs['A'])
    nt.links.new(fr.outputs['Fresnel'], add.inputs['Factor'])
    nt.links.new(add.outputs['Result'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    em.inputs['Strength'].default_value = 0
    m['noise'] = nz.name
    return m, em


def bolt_points(a, b, rnd, rough=0.22, depth=7):
    """a jagged lightning path from a to b (midpoint displacement)"""
    pts = [Vector(a), Vector(b)]
    amp = (Vector(b) - Vector(a)).length * rough
    for _ in range(depth):
        nxt = []
        for p, q in zip(pts, pts[1:]):
            m = (p + q) / 2 + Vector((rnd.uniform(-amp, amp), rnd.uniform(-amp, amp) * 0.4, rnd.uniform(-amp, amp) * 0.3))
            nxt += [p, m]
        nxt.append(pts[-1]); pts = nxt; amp *= 0.55
    return pts


def curve(name, pts, width, mat):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = width; cu.bevel_resolution = 2
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        taper = 1 - 0.65 * i / (len(pts) - 1)
        sp.points[i].co = (*p, 1); sp.points[i].radius = taper
    cu.materials.append(mat)
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    return ob


def bolt(seed, a, b, mat):
    """a main bolt and its branches, as glowing tubes"""
    rnd = random.Random(seed)
    main = bolt_points(a, b, rnd)
    obs = [curve(f'bolt{seed}', main, 0.022, mat)]
    for k in range(5):
        i = rnd.randint(len(main) // 6, len(main) * 4 // 5)
        p = main[i]
        d = Vector((rnd.uniform(-1.4, 1.4), rnd.uniform(-0.4, 0.4), -rnd.uniform(0.4, 1.2)))
        obs.append(curve(f'br{seed}_{k}', bolt_points(p, p + d, rnd, 0.3, 5), 0.010, mat))
    return obs


def build():
    gems.reset()
    sc = bpy.context.scene
    gems.cycles(24 if QUICK else 96, W // (2 if QUICK else 1), H // (2 if QUICK else 1), transparent=True)
    c = sc.cycles; c.adaptive_threshold = 0.01
    sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5
    sc.render.fps = FPS; sc.frame_start, sc.frame_end = 0, N - 1
    gems.studio(1.2)
    lights = gems.strips(2.2, (0, 0, 0.6))
    cam = gems.camera((0, -11, 1.8), (0, 0, 0.6), lens=45)

    # the wheel: 5 gems turning around the storm energy, always facing us, each spinning on itself
    ring = bpy.data.objects.new('ring', None); sc.collection.objects.link(ring); ring.location = (0, 0, CENTER_Z)
    cam.data.dof.use_dof = True; cam.data.dof.focus_object = ring; cam.data.dof.aperture_fstop = 2.8
    G = []
    for k, key in enumerate(KEYS):
        a = 2 * math.pi * k / 5 + math.pi / 2
        holder = bpy.data.objects.new(f'h{k}', None); sc.collection.objects.link(holder)
        spin = bpy.data.objects.new(f'sp{k}', None); sc.collection.objects.link(spin); spin.parent = holder
        for o in (gems.stone(key, f'st{k}'), gems.setting(key, f'se{k}')):
            o.parent = spin; o.rotation_euler = (math.radians(90), 0, 0); o.scale = (0.47,) * 3
        G.append((holder, spin, a))

    # storm energy at the centre: a glowing core and its halo
    core_m, core_em = plasma()
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.42, location=(0, 0, 1.15))
    core = bpy.context.object; core.data.materials.append(core_m); bpy.ops.object.shade_smooth()
    core.parent = ring; core.location = (0, 0, 0)
    halo = bpy.data.lights.new('halo', 'POINT'); halo.color = (0.5, 0.72, 1.0); halo.shadow_soft_size = 0.4
    hob = bpy.data.objects.new('halo', halo); sc.collection.objects.link(hob); hob.parent = ring; hob.location = (0, 0, 0)

    # the title in gold, a light that sweeps across it
    font = bpy.data.fonts.load('/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf')
    tc = bpy.data.curves.new('title', 'FONT'); tc.body = "L'OLYMPE"; tc.font = font
    tc.align_x = 'CENTER'; tc.align_y = 'CENTER'; tc.size = 0.7; tc.space_character = 1.08
    tc.extrude = 0.10; tc.bevel_depth = 0.022; tc.bevel_resolution = 3
    title = bpy.data.objects.new('title', tc); sc.collection.objects.link(title)
    title.data.materials.append(gems.gold_material())
    tpiv = bpy.data.objects.new('tpiv', None); sc.collection.objects.link(tpiv); tpiv.location = (0, -1.0, -1.25)
    title.parent = tpiv; title.rotation_euler = (math.radians(90), 0, 0)
    sweep = gems.area('sweep', (-4, -3.0, -0.9), (0, -1.0, -1.25), (0.18, 2.4), 0)

    # flash light of the strikes
    flash = bpy.data.lights.new('flash', 'POINT'); flash.color = (0.7, 0.85, 1.0); flash.shadow_soft_size = 1.2
    fob = bpy.data.objects.new('flash', flash); sc.collection.objects.link(fob); fob.location = (0, -1.5, 3.2)

    # ---- animation (keyframes: motion blur follows them)
    for f in range(N + 1):
        t = f / FPS
        # gems burst out of the strike, then turn in a ring; at the end they rise into an arc over the title
        burst = back((f - STRIKE1 - 2) / 18, 1.4)
        rise = smooth((f - TITLE_IN[0] + 6) / 36)
        cz = CENTER_Z + 0.35 * rise
        ring.location = (0, 0, cz); ring.keyframe_insert('location', frame=f)
        turn = 0.42 * t + 1.1 * smooth((f - STRIKE1) / 45)          # the wheel turns (fast just after the burst)
        for k, (holder, spin, a) in enumerate(G):
            r = RING_R * max(0.0, burst) * (1 - 0.08 * rise)
            ph = a + turn
            holder.location = (r * math.cos(ph), r * math.sin(ph) * math.sin(TILT), cz + r * math.sin(ph) * math.cos(TILT))
            s = max(0.001, min(1.15, burst))
            holder.scale = (s, s, s)
            spin.rotation_euler = (0, 0, 2 * math.pi * (1.0 - smooth((f - STRIKE1) / 40)) * 1.5 + math.sin(t * 2.1 + k * 1.3) * 0.45)
            for o, p in ((holder, 'location'), (holder, 'scale'), (spin, 'rotation_euler')): o.keyframe_insert(p, frame=f)
        tin = (f - TITLE_IN[0]) / (TITLE_IN[1] - TITLE_IN[0])
        tpiv.scale = (max(0.001, back(tin, 1.3)),) * 3
        tpiv.rotation_euler = (math.radians(-12) * (1 - smooth(tin)), 0, math.radians(-75) * (1 - smooth(tin)) + math.radians(6) * math.sin(t * 1.1) * smooth(tin))
        tpiv.location = (0, -1.0, -1.25 - 0.6 * (1 - smooth(tin)))
        tpiv.keyframe_insert('scale', frame=f); tpiv.keyframe_insert('rotation_euler', frame=f); tpiv.keyframe_insert('location', frame=f)
        # camera: slow push in and a little orbit
        cam.location = (math.sin(t * 0.35) * 0.45, -11 + 1.3 * smooth(t / SECONDS), 1.8 - 0.3 * smooth(t / SECONDS))
        cam.rotation_euler = (Vector((0, 0, 0.55 + 0.1 * rise)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
    return {'core': core_em, 'halo': halo, 'flash': flash, 'sweep': sweep, 'core_ob': core}


def BOLTS(mat):
    """strike 1 on the energy at the centre of the wheel, strike 2 on the title"""
    return bolt(3, (0.35, 0.6, 7.5), (0, 0, CENTER_Z + 0.1), mat) + bolt(11, (-0.7, 0.4, 7.5), (0, -1.0, -1.0), mat)


def strikes(f):
    """how bright the lightning is at frame f (2 strikes, each with flickers)"""
    v = 0.0
    for s0 in (STRIKE1, STRIKE2):
        d = f - s0
        if 0 <= d < 14: v = max(v, [1, 0.35, 1, 0.8, 0.25, 0.6, 0.15, 0.4, 0.1, 0.2, 0.06, 0.1, 0.03, 0.0][d])
    return v


def frame(ctx, f, bolts):
    sc = bpy.context.scene
    sc.frame_set(f)
    v = strikes(f)
    for b in bolts: b.hide_render = v < 0.05
    for i, b in enumerate(bolts):
        if not b.hide_render: b.data.materials[0].node_tree.nodes['Emission'].inputs['Strength'].default_value = 60 * v
    t = f / FPS
    ctx['core'].inputs['Strength'].default_value = (7.0 + 2.0 * math.sin(t * 9) + 12 * v) * smooth((f - STRIKE1) / 10)
    ctx['core_ob'].active_material.node_tree.nodes['Noise Texture'].inputs['W'].default_value = t * 1.4
    ctx['core_ob'].scale = (0.15 + 0.85 * smooth((f - STRIKE1) / 8),) * 3
    ctx['halo'].energy = (260 + 120 * math.sin(t * 9) + 1800 * v) * smooth((f - STRIKE1) / 10)
    ctx['flash'].energy = 9000 * v
    sw = (f - SWEEP[0]) / (SWEEP[1] - SWEEP[0])
    ctx['sweep'].data.energy = 2600 * math.sin(math.pi * min(1, max(0, sw)))
    ctx['sweep'].location = (-4 + 8 * smooth(sw), -3.0, -0.9)
    ctx['sweep'].rotation_euler = (Vector((0, -1.0, -1.25)) - ctx['sweep'].location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f'{TMP}/f{f:04d}.png'
    bpy.ops.render.render(write_still=True)


def main():
    a = sys.argv
    f0 = int(a[a.index('--from') + 1]) if '--from' in a else 0
    f1 = int(a[a.index('--to') + 1]) if '--to' in a else N - 1
    os.makedirs(TMP, exist_ok=True)
    ctx = build()
    bm, _ = emission('boltmat', (0.62, 0.8, 1.0), 60)
    bolts = BOLTS(bm)
    step = 10 if '--preview' in a else 1
    for f in range(f0, f1 + 1, step):
        if os.path.exists(f'{TMP}/f{f:04d}.png') and '--again' not in a: continue
        frame(ctx, f, bolts)


if __name__ == '__main__':
    main()
