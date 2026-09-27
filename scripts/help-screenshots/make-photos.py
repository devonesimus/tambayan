"""Stand-in gathering photos and a video thumbnail for the Help screenshots. Needs Pillow."""
import random, sys, os
from PIL import Image, ImageDraw, ImageFilter

out = sys.argv[1]
os.makedirs(out, exist_ok=True)

def bokeh(seed, w, h, top, bottom, lights):
    rnd = random.Random(seed)
    img = Image.new("RGB", (w, h))
    px = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        px.line([(0, y), (w, y)], fill=tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)))
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(lights):
        r = rnd.randint(int(h * 0.03), int(h * 0.13))
        x, y = rnd.randint(0, w), rnd.randint(0, h)
        c = rnd.choice([(255, 214, 140), (255, 182, 96), (255, 240, 210), (170, 190, 255), (255, 150, 120)])
        d.ellipse([x - r, y - r, x + r, y + r], fill=c + (rnd.randint(50, 130),))
    layer = layer.filter(ImageFilter.GaussianBlur(h * 0.006))
    img = Image.alpha_composite(img.convert("RGBA"), layer)
    # soft silhouettes along the bottom, like people gathered at dusk
    fig = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fig)
    for i in range(rnd.randint(5, 9)):
        cx = int(w * (i + 0.5 + rnd.uniform(-0.25, 0.25)) / 8)
        hh = int(h * rnd.uniform(0.32, 0.5))
        top_y = h - hh
        hr = int(h * 0.05)
        fd.ellipse([cx - hr, top_y, cx + hr, top_y + 2 * hr], fill=(20, 24, 48, 235))
        fd.rounded_rectangle([cx - int(hr * 1.9), top_y + int(hr * 2.1), cx + int(hr * 1.9), h + 20], radius=hr, fill=(20, 24, 48, 235))
    fig = fig.filter(ImageFilter.GaussianBlur(h * 0.012))
    return Image.alpha_composite(img, fig).convert("RGB")

palettes = [
    ((24, 34, 84), (232, 150, 70)), ((40, 26, 70), (240, 120, 90)), ((18, 52, 96), (250, 190, 110)),
    ((30, 30, 60), (220, 140, 60)), ((26, 44, 90), (238, 160, 100)), ((52, 30, 74), (250, 170, 120)),
]
for i in range(14):
    top, bottom = palettes[i % len(palettes)]
    bokeh(100 + i, 1600, 1067, top, bottom, 26).save(f"{out}/gathering-{i+1:02d}.jpg", quality=86)
bokeh(7, 480, 360, (20, 28, 70), (60, 60, 120), 14).save(f"{out}/thumb.jpg", quality=85)
print("photos ok")
