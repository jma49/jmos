# Paints the keepsakes' colour atlas, public/room/keepsakes.webp: one picture that holds what is
# printed, stitched or painted on the three keepsakes of the room (scene.py's mug, figurine and
# plush): the mug's glaze with its lettering, the plush's pineapple print, face, ear lining,
# sunglasses and the word on the back of its head, and the figurine's paint. scene.py lays each
# surface's texture coordinates on its island; the page (src/room/main.js) puts the picture on
# the materials whose names begin with "atlas". atlas.json says where each island is and how
# big the thing it covers is, and both scripts read it, so a painter may replace an island
# and nothing else changes (docs/agents/pond.md has the islands in words).
#
# Run with any Python that has Pillow (not Blender's):
#   python3 tools/pond/room/atlas.py [fonts folder]
# The lettering is set from fonts in that folder (default /home/user/room/fonts): Protest
# Revolution for the mug, Sacramento for the plush, both under the SIL Open Font License and not
# kept in the repository. Without a font file the lettering is left out and the script says so.
# Everything here is a stand-in for what the art thread paints.
import json
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
FONTS = sys.argv[1] if len(sys.argv) > 1 else '/home/user/room/fonts'
LAYOUT = json.load(open(os.path.join(HERE, 'atlas.json')))
SIZE = LAYOUT['size']
UP = 4  # every island is painted this many times larger and brought down, for clean edges

CHARCOAL = (88, 88, 94)  # the plush's black cloth: a soft charcoal, so its form shows
BLUE = (88, 120, 212)
WHITE = (236, 236, 232)
YELLOW, ORANGE = (243, 196, 84), (233, 132, 44)
FIG_YELLOW, FIG_BROWN, SKIN = (236, 196, 118), (78, 52, 44), (238, 178, 134)


def font(name, size):
    path = os.path.join(FONTS, name)
    if not os.path.exists(path):
        print('no font', path, ': its lettering is left out')
        return None
    return ImageFont.truetype(path, size)


def rounded(points, rounds=2):
    """A closed outline with its corners cut round."""
    for _ in range(rounds):
        cut = []
        for (ax, ay), (bx, by) in zip(points, points[1:] + points[:1]):
            cut += [(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25), (ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75)]
        points = cut
    return points


def speckle(img, rng, amount, grain=1):
    """Break a flat colour up a little, as cloth or a pebbled skin does."""
    w, h = img.size
    noise = Image.new('L', (max(1, w // grain), max(1, h // grain)))
    noise.putdata([rng.randint(0, 255) for _ in range(noise.size[0] * noise.size[1])])
    noise = noise.resize((w, h), Image.BILINEAR).filter(ImageFilter.GaussianBlur(grain * 0.6))
    dark = Image.new('RGB', (w, h), (0, 0, 0))
    light = Image.new('RGB', (w, h), (255, 255, 255))
    img = Image.composite(dark, img, noise.point(lambda v: int(max(0, 128 - v) * amount)))
    return Image.composite(light, img, noise.point(lambda v: int(max(0, v - 128) * amount)))


def words(text, face, width, height, lean=0.0, tilt=0.0, bold=0):
    """Lettering as a white-on-black mask `width` by `height` pixels: set large, leaned forward
    (`lean`, a shear), turned (`tilt`, degrees) and fitted to the box."""
    if face is None:
        return Image.new('L', (int(width), int(height)), 0)
    box = face.getbbox(text, stroke_width=bold)
    w, h = box[2] - box[0] + 8, box[3] - box[1] + 8
    mask = Image.new('L', (w + int(abs(lean) * h) + 8, h), 0)
    ImageDraw.Draw(mask).text((4 - box[0], 4 - box[1]), text, font=face, fill=255, stroke_width=bold, stroke_fill=255)
    mask = mask.transform(mask.size, Image.AFFINE, (1, lean, -lean * h * 0.5 - 4 + 4, 0, 1, 0), Image.BICUBIC)
    mask = mask.crop(mask.getbbox())
    mask = mask.resize((int(width), int(height)), Image.LANCZOS)
    return mask.rotate(tilt, Image.BICUBIC, expand=True) if tilt else mask


def stamp(img, mask, centre, colour):
    img.paste(colour, (int(centre[0] - mask.size[0] / 2), int(centre[1] - mask.size[1] / 2)), mask)


def mug(w, h, spec, rng):
    """The mug's wall unrolled: `span` degrees of it, centred on the front, by its height."""
    img = Image.new('RGB', (w, h), BLUE)
    per_degree, per_metre = w / spec['span'], h / spec['height']
    visible = 2 * 0.033  # the mug's width as the eye sees it, in metres
    radius = 0.0328
    for text, share, cap, z, bold in (('ON THE ROAD', 0.78, 0.0115, 0.0535, 5), ('HAPPY ANNIVERSARY', 0.45, 0.0036, 0.0390, 2)):
        # the line takes `share` of the visible width: that chord is so many degrees round the wall
        degrees = 2 * math.degrees(math.asin(share * visible / 2 / radius))
        mask = words(text, font('ProtestRevolution-Regular.ttf', 300), degrees * per_degree, cap * 1.25 * per_metre, lean=0.21, bold=bold)
        # it climbs a little to the right: sheared up, since the island is not square
        climb = math.tan(math.radians(2.5)) * (degrees * per_degree) * (per_metre / (per_degree * 360 / (2 * math.pi * radius)))
        mask = mask.transform((mask.size[0], int(mask.size[1] + abs(climb))), Image.AFFINE, (1, 0, 0, climb / mask.size[0], 1, -climb), Image.BICUBIC)
        stamp(img, mask, (w / 2, (1 - z / spec['height']) * h), (255, 255, 255))
    return img


def plush_print(w, h, spec, rng):
    """The pineapple body unrolled, from `from` to `to` degrees round it (more than once round,
    so the seam at the back has print on both sides): orange lines crossing, a dot in each diamond."""
    img = speckle(Image.new('RGB', (w, h), YELLOW), rng, 0.10, UP * 2)
    draw = ImageDraw.Draw(img)
    lines, twist = spec['lines'], spec['twist']
    per_degree = w / (spec['to'] - spec['from'])
    x = lambda degrees: (degrees - spec['from']) * per_degree
    y = lambda t: (1 - t) * h  # t runs up the body
    thick = max(2, round(1.5 * per_degree))
    for turn in (1, -1):
        for k in range(-lines, 2 * lines):
            pts = [(x(360 * k / lines + turn * math.degrees(twist) * t / 20), y(t / 20)) for t in range(21)]
            draw.line(pts, fill=ORANGE, width=thick, joint='curve')
    step = math.pi / (lines * twist)
    for j in range(0, 7):
        for k in range(-lines, 2 * lines):
            cx, cy = x(360 * k / lines + math.degrees(twist * j * step) + 180 / lines), y(j * step)
            draw.ellipse((cx - 3.2 * per_degree, cy - 0.055 * h, cx + 3.2 * per_degree, cy + 0.055 * h), fill=ORANGE)
    # the print is even in the middle band; under the collar and toward the foot it gives way to plain cloth
    plain = speckle(Image.new('RGB', (w, h), YELLOW), rng, 0.10, UP * 2)
    fade = Image.new('L', (w, h), 0)
    fd = ImageDraw.Draw(fade)
    for row in range(h):
        t = row / h
        fd.line((0, row, w, row), fill=int(255 * min(1.0, max(0.0, (0.26 - t) / 0.10, (t - 0.84) / 0.10))))
    return Image.composite(plain, img, fade)


def stitched_round(draw, cx, cy, r, colour, rim, ticks, rng):
    """A round of cloth sewn on: its face, and a flat stitched rim of short threads round its edge."""
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=colour)
    for i in range(ticks):
        a = 2 * math.pi * i / ticks
        shade = rng.randint(-10, 8)
        draw.line((cx + (r - rim) * math.cos(a), cy + (r - rim) * math.sin(a), cx + (r + rim * 0.15) * math.cos(a), cy + (r + rim * 0.15) * math.sin(a)),
                  fill=tuple(max(0, min(255, c + shade)) for c in (246, 246, 244)), width=max(2, round(2 * math.pi * r / ticks * 0.9)))


def plush_face(w, h, spec, rng):
    """The front of the plush's head, seen square on: the eyes and the nose on the black cloth."""
    img = speckle(Image.new('RGB', (w, h), CHARCOAL), rng, 0.10, UP)
    draw = ImageDraw.Draw(img)
    px = w / spec['extent'][0]
    at = lambda x, z: (w / 2 - x * px, h / 2 - z * px)  # x is the cat's own: its right is the looker's left
    eye_z = -0.0035
    for sx in (1, -1):
        cx, cy = at(sx * 0.029, eye_z)
        stitched_round(draw, cx, cy, 0.0141 * px, WHITE, 0.0019 * px, 120, rng)
        if sx > 0:  # its right eye: the pupil stitched, a shade larger, with a faint ring in the stitching
            px_, py = at(sx * 0.0245, eye_z)
            draw.ellipse((px_ - 0.0061 * px, py - 0.0061 * px, px_ + 0.0061 * px, py + 0.0061 * px), fill=(34, 34, 38))
            draw.ellipse((px_ - 0.0036 * px, py - 0.0036 * px, px_ + 0.0036 * px, py + 0.0036 * px), outline=(70, 70, 76), width=max(1, round(0.0005 * px)))
        else:
            px_, py = at(sx * 0.0245, eye_z + 0.0008)
            draw.ellipse((px_ - 0.0056 * px, py - 0.0056 * px, px_ + 0.0056 * px, py + 0.0056 * px), fill=(14, 14, 16))
            draw.ellipse((px_ - 0.0034 * px, py - 0.0040 * px, px_ - 0.0010 * px, py - 0.0018 * px), fill=(60, 60, 66))  # a glint: this one is a glossy disc
    cx, cy = at(0, eye_z - 0.0142)
    rx, ry = 0.0054 * px, 0.0040 * px
    draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(150, 96, 62))
    for i in range(-6, 7):  # the nose is satin stitch: upright threads
        x0 = cx + i * rx / 6.5
        half = ry * math.sqrt(max(0.0, 1 - (i / 6.5) ** 2))
        draw.line((x0, cy - half, x0, cy + half), fill=(134 + rng.randint(-12, 14), 84, 54), width=max(1, round(rx / 9)))
    return img


def plush_back(w, h, spec, rng):
    """The back of the plush's head, seen square on from behind: the word stitched across it."""
    img = speckle(Image.new('RGB', (w, h), CHARCOAL), rng, 0.10, UP)
    px = w / spec['extent'][0]
    mask = words('Hawaii', font('Sacramento-Regular.ttf', 400), 0.080 * px, 0.034 * px, tilt=11)
    stamp(img, mask, (w / 2, h / 2 - 0.004 * px), (240, 240, 238))
    return img


def plush_ear(w, h, spec, rng):
    """One ear from the front, stood upright (scene.py leans it): black cloth and its gold lining."""
    img = speckle(Image.new('RGB', (w, h), CHARCOAL), rng, 0.10, UP)
    draw = ImageDraw.Draw(img)
    px, pz = w / spec['extent'][0], h / spec['extent'][1]
    tri = rounded([(w / 2 - 0.0200 * px, h - 0.0020 * pz), (w / 2 + 0.0200 * px, h - 0.0020 * pz), (w / 2, h - 0.0350 * pz)], 2)  # most of the ear's front
    draw.polygon(tri, fill=(232, 202, 72))
    for i in range(60):  # the lining is thread laid side by side
        x0 = w * i / 60
        draw.line((x0, 0, x0, h), fill=(250, 232, 130) if i % 3 == 0 else (204, 174, 54), width=max(1, UP // 2))  # metal thread: bright strands among the rest
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).polygon(tri, fill=255)
    return Image.composite(img, speckle(Image.new('RGB', (w, h), CHARCOAL), rng, 0.10, UP), mask)


GLASSES_LENS = [(0.0070, 0.0062), (0.0090, -0.0062), (0.0150, -0.0128), (0.0245, -0.0142), (0.0355, -0.0130), (0.0428, -0.0070), (0.0448, 0.0030), (0.0410, 0.0118), (0.0260, 0.0140), (0.0105, 0.0132)]
GLASSES_STITCH = [(0.0180, 0.0062), (0.0240, 0.0086), (0.0310, 0.0080), (0.0336, 0.0040)]


def plush_glasses(w, h, spec, rng):
    """The sunglasses laid flat, seen from the front: red felt (scene.py cuts the outline), the two
    lenses of black cloth, the white stitch on each."""
    x0, y0, x1, y1 = spec['extent']
    img = speckle(Image.new('RGB', (w, h), (214, 44, 30)), rng, 0.10, UP)
    draw = ImageDraw.Draw(img)
    at = lambda x, y: ((x - x0) / (x1 - x0) * w, (y1 - y) / (y1 - y0) * h)
    for sx in (1, -1):
        draw.polygon([at(sx * x, y) for x, y in rounded(GLASSES_LENS, 2)], fill=(30, 28, 32))
        draw.line([at(sx * x, y) for x, y in GLASSES_STITCH], fill=(236, 236, 232), width=max(2, round(0.0008 / (x1 - x0) * w)), joint='curve')
    return img


def pebbled(w, h, colour, rng):
    """The figurine's matt vinyl: finely pebbled, like a citrus peel."""
    img = Image.new('RGB', (w, h), colour)
    draw = ImageDraw.Draw(img)
    for _ in range(w * h // (UP * UP * 14)):
        x, y, r = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(0.8, 1.6) * UP
        k = rng.choice((-14, -9, 8, 12))
        draw.ellipse((x - r, y - r, x + r, y + r), fill=tuple(max(0, min(255, c + k)) for c in colour))
    return img.filter(ImageFilter.GaussianBlur(UP * 0.5))


def figurine_face(w, h, spec, rng):
    """The figurine's face, seen square on: smooth tan skin, the two big eyes that look up and to
    the looker's right, brows, a nose, a smile, a blush on each cheek with a squiggle on it."""
    img = Image.new('RGB', (w, h), SKIN)
    px = w / spec['extent'][0]
    at = lambda x, z: (w / 2 - x * px, h / 2 - z * px)  # x is the figure's own: its right is the looker's left
    line = (52, 30, 24)
    # the blush first, soft at its edge
    blush = Image.new('L', (w, h), 0)
    bd = ImageDraw.Draw(blush)
    cheeks = ((0.0064, -0.0052), (-0.0070, -0.0042))
    for x, z in cheeks:
        cx, cy = at(x, z)
        bd.ellipse((cx - 0.0030 * px, cy - 0.0026 * px, cx + 0.0030 * px, cy + 0.0026 * px), fill=210)
    img = Image.composite(Image.new('RGB', (w, h), (234, 104, 62)), img, blush.filter(ImageFilter.GaussianBlur(0.0010 * px)))
    draw = ImageDraw.Draw(img)
    thin = max(2, round(0.00028 * px))
    for x, z in cheeks:  # a tilde on each
        cx, cy = at(x, z + 0.0006)
        draw.line([(cx + 0.0018 * px * k / 10, cy - 0.0006 * px * math.sin(math.pi * k / 10)) for k in range(-10, 11)], fill=line, width=round(thin * 1.5), joint='curve')
    for sx in (1, -1):
        cx, cy = at(sx * 0.0039, 0.0002)
        rx, rz = 0.0025 * px, 0.0032 * px
        draw.ellipse((cx - rx - thin, cy - rz - thin, cx + rx + thin, cy + rz + thin), fill=(120, 70, 52))  # the lid's line
        draw.ellipse((cx - rx, cy - rz, cx + rx, cy + rz), fill=(246, 244, 240))
        # the iris fills most of the eye, toward the looker's upper right; the white is a crescent below and beside it
        ix, iz = cx + 0.0005 * px, cy - 0.0007 * px
        draw.ellipse((ix - 0.0020 * px, iz - 0.0024 * px, ix + 0.0020 * px, iz + 0.0024 * px), fill=(64, 34, 24))
        draw.ellipse((ix - 0.0012 * px, iz - 0.0015 * px, ix + 0.0012 * px, iz + 0.0015 * px), fill=(30, 16, 12))
        sx_, sz = ix + 0.0007 * px, iz - 0.0010 * px
        r = 0.00062 * px
        draw.polygon([(sx_ + (r if k % 2 == 0 else r * 0.28) * math.sin(math.pi * k / 4), sz - (r if k % 2 == 0 else r * 0.28) * math.cos(math.pi * k / 4)) for k in range(8)], fill=(250, 250, 248))
        bx, bz = at(sx * 0.0041, 0.0068)
        draw.arc((bx - 0.0012 * px, bz - 0.0006 * px, bx + 0.0012 * px, bz + 0.0010 * px), 200, 340, fill=line, width=thin)
    nx, nz = at(0, -0.0030)
    draw.ellipse((nx - 0.0007 * px, nz - 0.0004 * px, nx + 0.0007 * px, nz + 0.0005 * px), fill=(206, 128, 88))
    mx, mz = at(0, -0.0056)
    draw.line([(mx - 0.0011 * px, mz - 0.0003 * px), (mx - 0.0005 * px, mz + 0.0003 * px), (mx, mz - 0.0001 * px), (mx + 0.0005 * px, mz + 0.0003 * px), (mx + 0.0011 * px, mz - 0.0003 * px)],
              fill=line, width=thin, joint='curve')
    return img


def figurine_body(w, h, spec, rng, back=False):
    """The figurine's star body, seen square on from the front (or from behind): quartered in
    yellow and dark brown, and in front the hood's bib over the chest and a small dark shoulder."""
    x0, z0, x1, z1 = spec['extent']
    yellow, brown = pebbled(w, h, FIG_YELLOW, rng), pebbled(w, h, FIG_BROWN, rng)
    at = (lambda x, z: ((x - x0) / (x1 - x0) * w, (z1 - z) / (z1 - z0) * h)) if back else (lambda x, z: ((x1 - x) / (x1 - x0) * w, (z1 - z) / (z1 - z0) * h))
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    if back:  # plain, but for the quartering low down
        draw.polygon([at(0, -0.004), at(x1, -0.004), at(x1, -0.0085), at(0, -0.0085)], fill=255)
        draw.polygon([at(0, -0.0085), at(x0, -0.0085), at(x0, z0), at(0, z0)], fill=255)
    else:  # brown where it is the figure's right and up, or its left and down
        draw.polygon([at(0, 0), at(x1, 0), at(x1, z1), at(0, z1)], fill=255)
        draw.polygon([at(0, 0), at(x0, 0), at(x0, z0), at(0, z0)], fill=255)
        sx, sz = at(-0.0058, 0.0052)
        draw.ellipse((sx - 0.0019 / (x1 - x0) * w, sz - 0.0017 / (z1 - z0) * h, sx + 0.0019 / (x1 - x0) * w, sz + 0.0017 / (z1 - z0) * h), fill=255)
    img = Image.composite(brown, yellow, mask)
    if not back:
        bib = rounded([at(x, z) for x, z in ((0.0030, 0.0120), (0.0038, 0.0034), (0.0018, 0.0002), (-0.0006, -0.0016), (-0.0030, 0.0002), (-0.0052, 0.0030), (-0.0048, 0.0120))], 1)
        m = Image.new('L', (w, h), 0)
        ImageDraw.Draw(m).polygon(bib, fill=255)
        edge = m.filter(ImageFilter.GaussianBlur(UP * 1.2))
        img = Image.composite(Image.new('RGB', (w, h), (150, 110, 60)), img, edge.point(lambda v: v // 3))  # a soft shadow under its edge
        img = Image.composite(pebbled(w, h, FIG_YELLOW, rng), img, m)
    return img


PAINTERS = {
    'mug': mug, 'plush-print': plush_print, 'plush-face': plush_face, 'plush-back': plush_back, 'plush-ear': plush_ear, 'plush-glasses': plush_glasses,
    'figurine-face': figurine_face, 'figurine-body': figurine_body, 'figurine-back': lambda w, h, s, r: figurine_body(w, h, s, r, back=True),
    'figurine-hood': lambda w, h, s, r: pebbled(w, h, FIG_YELLOW, r),
}

atlas = Image.new('RGB', (SIZE, SIZE), (128, 128, 128))
for name, spec in LAYOUT['islands'].items():
    x0, y0, x1, y1 = spec['rect']
    island = PAINTERS[name]((x1 - x0) * UP, (y1 - y0) * UP, spec, random.Random(name))
    atlas.paste(island.resize((x1 - x0, y1 - y0), Image.LANCZOS), (x0, y0))
out = os.path.join(REPO, 'public', 'room', LAYOUT['file'])
atlas.save(out, quality=88, method=6)
print(out, os.path.getsize(out), 'bytes')
