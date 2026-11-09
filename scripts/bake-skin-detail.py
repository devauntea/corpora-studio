"""Generate an original, periodic 48 mm skin microrelief tile with Blender.

No photos, scans, commercial textures or anatomy assets. Seeded cells form
fine furrows; independent jittered pores have varied radius and depth. Packed
linear channels: R height (-.035 to .020 mm), G roughness, B cavity, A 1.
The app samples it in rest-space so it follows poses without tattoo-UV seams.
"""
from pathlib import Path
import hashlib
import json
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/anatomy'
SIZE = 1024
SEED = 81723
rng = np.random.default_rng(SEED)
y, x = np.mgrid[:SIZE, :SIZE].astype(np.float32)/SIZE

def cells(count):
    jitter = rng.uniform(.12, .88, (count, count, 2)).astype(np.float32)
    xx, yy = x*count, y*count
    ix, iy = np.floor(xx).astype(int), np.floor(yy).astype(int)
    first = np.full_like(x, 100)
    second = np.full_like(x, 100)
    nearest = np.zeros_like(ix)
    for dy in [-1, 0, 1]:
        for dx in [-1, 0, 1]:
            jx, jy = (ix+dx) % count, (iy+dy) % count
            j = jitter[jy, jx]
            distance = np.sqrt((xx-ix-dx-j[..., 0])**2+(yy-iy-dy-j[..., 1])**2)
            nearer = distance < first
            second = np.where(nearer, first, np.minimum(second, distance))
            nearest = np.where(nearer, jy*count+jx, nearest)
            first = np.minimum(first, distance)
    return first, second, nearest

a, b, _ = cells(26)
furrows = np.exp(-((b-a)/.085)**2)
p, _, ids = cells(112)
radius = rng.uniform(.10, .18, 112*112)[ids]
depth = rng.uniform(.40, 1, 112*112)[ids]
pores = np.exp(-(p/radius)**2)*depth
# Two continuous periodic undulations avoid an entirely uniform cellular finish.
wave = .5*np.sin(2*np.pi*(3*x+2*y)) + .3*np.cos(2*np.pi*(7*x-4*y))
height = .006*wave - .010*furrows - .022*pores
roughness = np.clip(.62+.035*wave+.045*furrows+.035*pores, .48, .76)
cavity = np.clip(1-.12*furrows-.22*pores, .6, 1)
pixels = np.stack([np.clip((height+.035)/.055, 0, 1), roughness, cavity, np.ones_like(x)], axis=-1).astype(np.float32)
img = bpy.data.images.new('Form Studio original skin microrelief', width=SIZE, height=SIZE, alpha=True)
img.colorspace_settings.name = 'Non-Color'
img.pixels.foreach_set(pixels.ravel())
img.file_format = 'PNG'
img.filepath_raw = str(OUT / 'skin-detail-v8.png')
img.save()
metadata = {'version': 1, 'generator': 'scripts/bake-skin-detail.py', 'seed': SEED, 'resolution': [SIZE, SIZE], 'tileWidthMm': 48, 'heightRangeMm': [-.035, .020], 'channels': ['linear height', 'roughness', 'cavity', 'opaque'], 'license': 'CC0-1.0', 'source': 'Original seeded procedural cells and pores; no external texture inputs.', 'sha256': hashlib.sha256((OUT / 'skin-detail-v8.png').read_bytes()).hexdigest(), 'blender': bpy.app.version_string}
(OUT / 'skin-detail-v8.json').write_text(json.dumps(metadata, indent=2)+'\n')
print(json.dumps(metadata), flush=True)
