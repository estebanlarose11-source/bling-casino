# The 3D films of the slot machines (owner's wish of 27 November 2026, after the film of L'Olympe: « fais ça sur toutes
# les machines »). A machine's symbols are the owner's painted images: each becomes a real 3D piece in Blender, a
# "token" = the image's silhouette (its alpha, traced by OpenCV) extruded into a thick plate with a polished bevel. The
# front face carries the painting (lacquered: the studio lights slide across it, a light relief from its shading), the
# bevel, sides and back are metal (gold by default): seen turning, it is a coin or a medal cut to the symbol's shape.
import math, os
import numpy as np
import cv2
import bpy
from PIL import Image

TMP = os.environ.get('BL_TMP', '/tmp/films3d')


def emoji(ch, size=420):
    """an emoji drawn as a painting (Noto Color Emoji: its bitmaps are 136 px, scaled up smoothly)"""
    from PIL import ImageDraw, ImageFont
    f = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 109)
    im = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((80, 80), ch, font=f, embedded_color=True, anchor='mm')
    return im.resize((size, size), Image.LANCZOS)


def trace(path, maxdim=420, thresh=110):
    """the painting cropped to its silhouette, its outlines (outer and holes) in pixels, its size"""
    im = emoji(path[6:]) if path.startswith('emoji:') else Image.open(path).convert('RGBA')
    a = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(a > 24)
    im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    k = maxdim / max(im.size)
    im = im.resize((max(2, round(im.size[0] * k)), max(2, round(im.size[1] * k))), Image.LANCZOS)
    rgba = np.asarray(im)
    m = (rgba[..., 3] > thresh).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.copyMakeBorder(m, 2, 2, 2, 2, cv2.BORDER_CONSTANT, 0)  # a silhouette that touches the edge still closes
    cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    big = max(cv2.contourArea(c) for c in cs)
    out = []
    for c, h in zip(cs, hier[0]):
        ar = cv2.contourArea(c)
        if ar < big * (0.03 if h[3] < 0 else 0.01): continue          # crumbs and tiny holes
        c = cv2.approxPolyDP(c, 0.7, True)[:, 0, :].astype(np.float64) - 2
        if len(c) < 3: continue
        out.append(c)
    return im, out, im.size


def _mat_token(name, img_path, w, h, rim):
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear(); L = nt.links.new
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    # the painting on the front: object coordinates -> 0…1 over the image
    mp = nt.nodes.new('ShaderNodeMapping')
    s = max(w, h)
    mp.inputs['Scale'].default_value = (s / w, s / h, 1)
    mp.inputs['Location'].default_value = (0.5, 0.5, 0)
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(img_path); tex.extension = 'EXTEND'
    tex.interpolation = 'Cubic'
    L(tc.outputs['Object'], mp.inputs['Vector']); L(mp.outputs['Vector'], tex.inputs['Vector'])
    # half-transparent edges of the painting sit on dark metal
    under = nt.nodes.new('ShaderNodeMix'); under.data_type = 'RGBA'
    under.inputs['A'].default_value = (rim[0] * 0.25, rim[1] * 0.25, rim[2] * 0.25, 1)
    L(tex.outputs['Alpha'], under.inputs['Factor']); L(tex.outputs['Color'], under.inputs['B'])
    face = nt.nodes.new('ShaderNodeBsdfPrincipled')
    # lit only a little (the lights would burn the pieces near them white), its own colours carried by emission
    dim = nt.nodes.new('ShaderNodeMix'); dim.data_type = 'RGBA'; dim.blend_type = 'MULTIPLY'; dim.inputs['Factor'].default_value = 1
    k = float(os.environ.get('TK_BASE', 0.4)); dim.inputs['B'].default_value = (k, k, k, 1)
    L(under.outputs['Result'], dim.inputs['A']); L(dim.outputs['Result'], face.inputs['Base Color'])
    face.inputs['Roughness'].default_value = 0.5
    face.inputs['Specular IOR Level'].default_value = float(os.environ.get('TK_SPEC', 0.2))
    face.inputs['Coat Weight'].default_value = float(os.environ.get('TK_COAT', 0.15))
    face.inputs['Coat Roughness'].default_value = 0.06
    L(under.outputs['Result'], face.inputs['Emission Color'])
    face.inputs['Emission Strength'].default_value = float(os.environ.get('TK_EMI', 0.82))
    # a light relief from the painting's own shading (it catches the lights when the piece turns)
    bw = nt.nodes.new('ShaderNodeRGBToBW'); L(tex.outputs['Color'], bw.inputs['Color'])
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.22; bump.inputs['Distance'].default_value = 0.004
    L(bw.outputs['Val'], bump.inputs['Height']); L(bump.outputs['Normal'], face.inputs['Normal'])
    # the metal of the bevel, sides and back
    metal = nt.nodes.new('ShaderNodeBsdfPrincipled')
    metal.inputs['Base Color'].default_value = (*rim, 1)
    metal.inputs['Metallic'].default_value = 1.0
    metal.inputs['Roughness'].default_value = 0.16
    metal.inputs['Anisotropic'].default_value = 0.2
    # front = the object-space normal points to +Z
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); L(tc.outputs['Normal'], sep.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs['From Min'].default_value = 0.80; mr.inputs['From Max'].default_value = 0.97
    L(sep.outputs['Z'], mr.inputs['Value'])
    mix = nt.nodes.new('ShaderNodeMixShader')
    L(mr.outputs['Result'], mix.inputs['Fac']); L(metal.outputs['BSDF'], mix.inputs[1]); L(face.outputs['BSDF'], mix.inputs[2])
    L(mix.outputs['Shader'], out.inputs['Surface'])
    return m


GOLD = (1.0, 0.62, 0.20)


def token(path, name, depth=0.07, bevel=0.022, rim=GOLD):
    """the 3D piece of a painted symbol, 1 unit on its longest side, lying in XY (front = +Z)"""
    os.makedirs(TMP, exist_ok=True)
    im, cs, (w, h) = trace(path)
    png = f'{TMP}/tok-{name}.png'; im.save(png)
    s = max(w, h)
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    cu.extrude = depth / 2; cu.bevel_depth = bevel; cu.bevel_resolution = 4
    for c in cs:
        sp = cu.splines.new('POLY'); sp.points.add(len(c) - 1)
        for i, (x, y) in enumerate(c):
            sp.points[i].co = ((x - w / 2) / s, (h / 2 - y) / s, 0, 1)
        sp.use_cyclic_u = True
    cu.materials.append(_mat_token(f'm-{name}', png, w, h, rim))
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    return ob
