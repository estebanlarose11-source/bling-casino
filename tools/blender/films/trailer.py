# The 3D film of a slot machine (owner's wish of 27 November 2026: the film of L'Olympe on every machine), vertical 9:16
# for Snap and TikTok, same timing as L'Olympe:
#   0.0 s  dark; an impact at the centre (flash, shockwave in post), the hero symbol bursts out, the 5 others around it;
#   1.0 s  the 5 symbols turn in a ring around the hero, each spinning on itself; the hero turns over once (its gold back);
#   4.3 s  a second impact: the machine's name rises in gold and turns to face us, a light sweeps across its letters;
#   6.0 s  hold, the address of the site in post.
# Everything here is rendered by Blender (Cycles) on a transparent background, frames in BL_TMP/<id>/; then film.py.
# python3 tools/blender/films/trailer.py <id> [--from N] [--to N] [--preview] [--again]
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '../olympe'))
import bpy
from mathutils import Vector
import gems, tokens
from machines import M, GOLD

ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
FPS, SECONDS = 30, 7.0
N = int(FPS * SECONDS)
W, H = 540, 960
QUICK = os.environ.get('BL_QUICK')
RING_R, CENTER_Z, TILT = 1.55, 1.45, math.radians(28)
STRIKE1, STRIKE2 = 6, 129
TITLE_IN, SWEEP = (126, 156), (160, 200)
HERO_TURNS = [(58, 92), (166, 200)]


def tmp(mid): return os.path.join(os.environ.get('BL_TMP', '/tmp/films3d'), mid)
def smooth(t): t = min(1, max(0, t)); return t * t * (3 - 2 * t)
def back(t, s=1.7): t = min(1, max(0, t)) - 1; return 1 + t * t * ((s + 1) * t + s)


def impact(f):
    """how strong the impact light is at frame f (2 impacts, a fast flash that fades)"""
    v = 0.0
    for s0 in (STRIKE1, STRIKE2):
        d = f - s0
        if 0 <= d < 12: v = max(v, math.exp(-d / 2.6))
    return v


def bebas(d):
    """the site's poster font (Bebas Neue, tools/seo/bebas.woff2) as a .ttf Blender can read"""
    p = os.path.join(d, 'bebas.ttf')
    if not os.path.exists(p):
        from fontTools.ttLib import TTFont
        f = TTFont(os.path.join(ROOT, 'tools/seo/bebas.woff2')); f.flavor = None; f.save(p)
    return p


def src(s): return s if s.startswith('emoji:') else os.path.join(ROOT, 'assets/games', s + '.webp')


def build(mid):
    cfg = M[mid]; d = tmp(mid); os.makedirs(d, exist_ok=True)
    os.environ['BL_TMP'] = d; tokens.TMP = d
    gems.reset()
    sc = bpy.context.scene
    gems.cycles(16 if QUICK else 40, W // (2 if QUICK else 1), H // (2 if QUICK else 1), transparent=True)
    sc.cycles.adaptive_threshold = 0.012
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'   # the paintings keep their colours
    sc.render.use_persistent_data = True
    sc.render.use_motion_blur = not os.environ.get('NO_MB'); sc.render.motion_blur_shutter = 0.28   # a longer shutter washed the turning paintings out
    sc.render.fps = FPS; sc.frame_start, sc.frame_end = 0, N - 1
    gems.studio(0.5)
    for L in gems.strips(2.2, (0, 0, 0.6)): L.data.energy *= 0.12
    cam = gems.camera((0, -11, 1.8), (0, 0, 0.6), lens=45)
    rim = cfg.get('rim', GOLD)
    acc = cfg['accent']

    ring = bpy.data.objects.new('ring', None); sc.collection.objects.link(ring); ring.location = (0, 0, CENTER_Z)
    cam.data.dof.use_dof = not os.environ.get('NO_DOF'); cam.data.dof.focus_object = ring; cam.data.dof.aperture_fstop = 3.2

    def piece(path, name, scale):
        holder = bpy.data.objects.new(f'h-{name}', None); sc.collection.objects.link(holder)
        spin = bpy.data.objects.new(f's-{name}', None); sc.collection.objects.link(spin); spin.parent = holder
        o = tokens.token(src(path), name, rim=rim)
        o.parent = spin; o.rotation_euler = (math.radians(90), 0, 0); o.scale = (scale,) * 3
        return holder, spin

    G = [(*piece(p, f'r{k}', 0.92), 2 * math.pi * k / 5 + math.pi / 2) for k, p in enumerate(cfg['ring'])]
    hero, hspin = piece(cfg['hero'], 'hero', 1.45)

    # light of the machine's colour behind the hero (a coloured rim on every piece) and the flash of the impacts
    glow = bpy.data.lights.new('glow', 'POINT'); glow.color = acc; glow.shadow_soft_size = 0.6
    gob = bpy.data.objects.new('glow', glow); sc.collection.objects.link(gob); gob.parent = ring; gob.location = (0, 1.2, 0)
    flash = bpy.data.lights.new('flash', 'POINT'); flash.color = tuple(0.55 + 0.45 * c for c in acc); flash.shadow_soft_size = 1.2
    fob = bpy.data.objects.new('flash', flash); sc.collection.objects.link(fob); fob.location = (0, -1.8, 2.6)

    # the title in gold, in the site's poster font, fitted to the frame
    tc = bpy.data.curves.new('title', 'FONT'); tc.body = cfg['title']; tc.font = bpy.data.fonts.load(bebas(d))
    tc.align_x = 'CENTER'; tc.align_y = 'CENTER'; tc.size = 1.0; tc.space_character = 1.06; tc.space_line = 0.82
    tc.extrude = 0.085; tc.bevel_depth = 0.02; tc.bevel_resolution = 3
    title = bpy.data.objects.new('title', tc); sc.collection.objects.link(title)
    title.data.materials.append(gems.gold_material())
    bpy.context.view_layer.update()
    k = min(3.7 / title.dimensions.x, (1.5 if '\n' in cfg['title'] else 0.95) / title.dimensions.y)
    title.scale = (k, k, k)
    lines = cfg['title'].count('\n')
    TZ = -1.25 - 0.22 * lines
    tpiv = bpy.data.objects.new('tpiv', None); sc.collection.objects.link(tpiv); tpiv.location = (0, -1.0, TZ)
    title.parent = tpiv; title.rotation_euler = (math.radians(90), 0, 0)
    tkey = gems.area('tkey', (1.6, -4.5, TZ + 1.8), (0, -1.0, TZ), (2.4, 0.6), 0, (1.0, 0.95, 0.85))
    sweep = gems.area('sweep', (-4, -3.0, TZ + 0.35), (0, -1.0, TZ), (0.18, 2.4), 0)
    # these two light only the title (light linking): on the paintings they would burn the colours white
    tcoll = bpy.data.collections.new('title-lit'); tcoll.objects.link(title)
    for L in (tkey, sweep): L.light_linking.receiver_collection = tcoll

    for f in range(N + 1):
        t = f / FPS
        burst = back((f - STRIKE1 - 2) / 18, 1.4)
        rise = smooth((f - TITLE_IN[0] + 6) / 36)
        cz = CENTER_Z + 0.35 * rise
        ring.location = (0, 0, cz); ring.keyframe_insert('location', frame=f)
        turn = 0.42 * t + 1.1 * smooth((f - STRIKE1) / 45)
        for kk, (holder, spin, a) in enumerate(G):
            r = RING_R * max(0.0, burst) * (1 - 0.06 * rise)
            ph = a + turn
            holder.location = (r * math.cos(ph), r * math.sin(ph) * math.sin(TILT), cz + r * math.sin(ph) * math.cos(TILT))
            s = max(0.001, min(1.15, burst)); holder.scale = (s, s, s)
            spin.rotation_euler = (0, 0, 2 * math.pi * (1.0 - smooth((f - STRIKE1) / 40)) * 1.5 + math.sin(t * 2.1 + kk * 1.3) * 0.5)
            for o, p in ((holder, 'location'), (holder, 'scale'), (spin, 'rotation_euler')): o.keyframe_insert(p, frame=f)
        # the hero: bursts out of the first impact, floats, turns over twice (its metal back catches the light)
        hb = back((f - STRIKE1) / 16, 2.2)
        hero.location = (0, 0.15, cz + 0.05 * math.sin(t * 2.3)); hero.scale = (max(0.001, hb) * (1 - 0.12 * rise),) * 3
        rz = sum(2 * math.pi * smooth((f - a0) / (a1 - a0)) for a0, a1 in HERO_TURNS)
        hspin.rotation_euler = (math.sin(t * 1.7) * 0.06, 0, rz + math.sin(t * 1.3) * 0.18)
        for o, p in ((hero, 'location'), (hero, 'scale'), (hspin, 'rotation_euler')): o.keyframe_insert(p, frame=f)
        tin = (f - TITLE_IN[0]) / (TITLE_IN[1] - TITLE_IN[0])
        tpiv.scale = (max(0.001, back(tin, 1.3)),) * 3
        tpiv.rotation_euler = (math.radians(-12) * (1 - smooth(tin)), 0, math.radians(-75) * (1 - smooth(tin)) + math.radians(6) * math.sin(t * 1.1) * smooth(tin))
        tpiv.location = (0, -1.0, TZ - 0.6 * (1 - smooth(tin)))
        tpiv.keyframe_insert('scale', frame=f); tpiv.keyframe_insert('rotation_euler', frame=f); tpiv.keyframe_insert('location', frame=f)
        cam.location = (math.sin(t * 0.35) * 0.45, -11 + 1.3 * smooth(t / SECONDS), 1.8 - 0.3 * smooth(t / SECONDS))
        cam.rotation_euler = (Vector((0, 0, 0.55 + 0.1 * rise)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.keyframe_insert('location', frame=f); cam.keyframe_insert('rotation_euler', frame=f)
    return dict(glow=glow, flash=flash, sweep=sweep, tkey=tkey, TZ=TZ, dir=d)


def frame(ctx, f):
    sc = bpy.context.scene
    sc.frame_set(f)
    t = f / FPS; v = impact(f)
    ctx['glow'].energy = (140 + 60 * math.sin(t * 5)) * smooth((f - STRIKE1) / 10) + 1200 * v
    ctx['flash'].energy = 3500 * v
    ctx['tkey'].data.energy = 700 * smooth((f - TITLE_IN[0]) / 20)
    sw = (f - SWEEP[0]) / (SWEEP[1] - SWEEP[0])
    ctx['sweep'].data.energy = 3200 * math.sin(math.pi * min(1, max(0, sw)))
    ctx['sweep'].location = (-4 + 8 * smooth(sw), -3.0, ctx['TZ'] + 0.35)
    ctx['sweep'].rotation_euler = (Vector((0, -1.0, ctx['TZ'])) - ctx['sweep'].location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = f"{ctx['dir']}/f{f:04d}.png"
    bpy.ops.render.render(write_still=True)


def main():
    a = sys.argv
    mid = next(x for x in a[1:] if x in M)
    f0 = int(a[a.index('--from') + 1]) if '--from' in a else 0
    f1 = int(a[a.index('--to') + 1]) if '--to' in a else N - 1
    ctx = build(mid)
    step = int(a[a.index('--preview') + 1]) if '--preview' in a else 1
    for f in range(f0, f1 + 1, step):
        if os.path.exists(f"{ctx['dir']}/f{f:04d}.png") and '--again' not in a: continue
        frame(ctx, f)


if __name__ == '__main__':
    main()
