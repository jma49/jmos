# max per-channel difference (0-255) between two builds' shots, whole and in three crops at 2x
import sys, numpy as np
from PIL import Image
A, B = sys.argv[1], sys.argv[2]
crops = {'title': (0, 0, 520, 300), 'koi': (300, 180, 660, 480), 'ripple': (520, 240, 720, 440)}
for look in ['water', 'ink', 'ukiyo', 'ascii']:
    a = np.asarray(Image.open(f'{A}-{look}.png').convert('RGB')).astype(int); b = np.asarray(Image.open(f'{B}-{look}.png').convert('RGB')).astype(int)
    d = np.abs(a - b); out = [f'{look:6} all max {d.max():3d} (>1: {(d.max(2) > 1).mean() * 100:.3f}%)']
    for k, (x0, y0, x1, y1) in crops.items():
        out.append(f'{k} {d[y0:y1, x0:x1].max():3d}')
        Image.fromarray(np.concatenate([a[y0:y1, x0:x1], b[y0:y1, x0:x1]], 1).astype('uint8')).save(f'{B}-{look}-{k}-pair.png')
    print('  '.join(out))
