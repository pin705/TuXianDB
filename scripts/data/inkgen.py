# Seamless "mực loang" background (public/ink/ink-bleed.webp): spectral noise, bilinear domain warp,
# soft blotches with darker bleed rims. Usage: python3 scripts/data/inkgen.py  (needs numpy + Pillow)
import numpy as np
from PIL import Image, ImageFilter
N = 1200

def spectral(n, beta, seed):
    r = np.random.default_rng(seed)
    f = np.fft.fftfreq(n); fx, fy = np.meshgrid(f, f)
    k = np.sqrt(fx**2 + fy**2); k[0, 0] = 1
    spec = (r.normal(size=(n, n)) + 1j * r.normal(size=(n, n))) / k**beta; spec[0, 0] = 0
    out = np.real(np.fft.ifft2(spec)); return (out - out.mean()) / out.std()

def warp(img, dx, dy, amt):
    n = img.shape[0]; y, x = np.mgrid[0:n, 0:n].astype(float)
    xs, ys = (x + dx * amt) % n, (y + dy * amt) % n
    x0, y0 = np.floor(xs).astype(int), np.floor(ys).astype(int); fx, fy = xs - x0, ys - y0
    x1, y1 = (x0 + 1) % n, (y0 + 1) % n
    return (img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x1] * fx * (1 - fy)
            + img[y1, x0] * (1 - fx) * fy + img[y1, x1] * fx * fy)

def smooth(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)

wx, wy = spectral(N, 2.4, 2), spectral(N, 2.4, 3)
base = warp(spectral(N, 2.1, 1), wx, wy, 90)
detail = warp(spectral(N, 1.6, 4), wx, wy, 40)
mist = warp(spectral(N, 2.6, 6), wx, wy, 120)

field = base + 0.35 * detail
blot = smooth(-0.2, 1.3, field)                    # main ink wash
mistv = smooth(-0.6, 1.6, mist) * 0.5              # broad soft haze
gy, gx = np.gradient(smooth(0.35, 0.75, field))
rim = np.clip(np.hypot(gx, gy) * 7, 0, 1)          # darker ink at bleed edges
pool = smooth(0.6, 2.0, -field)                    # deep ink pools

deep = np.array([0x0A, 0x0D, 0x13]) / 255
mid = np.array([0x2A, 0x35, 0x45]) / 255
hi = np.array([0x3A, 0x47, 0x58]) / 255
v = np.clip(0.75 * blot * (0.82 + 0.18 * np.tanh(detail)) + mistv, 0, 1)[..., None]
col = deep + (mid - deep) * v + (hi - mid) * (smooth(0.8, 1.0, v[..., 0])[..., None]) * 0.6
col *= (1 - 0.30 * rim[..., None]) * (1 - 0.35 * pool[..., None])
col += spectral(N, 0.0, 9)[..., None] * 0.006     # paper grain
img = Image.fromarray((np.clip(col, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
img.save('public/ink/ink-bleed.webp', quality=88)
a = np.asarray(img); print(a.mean(axis=(0, 1)), a.min(), a.max())
