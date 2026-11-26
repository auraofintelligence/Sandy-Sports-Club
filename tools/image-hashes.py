"""Write the manifest tests/image-manifest.json: sha256 and 64-bit dHash for every assets/ image.
Run after adding or replacing an image: python3 tools/image-hashes.py"""
import hashlib, json, os
from PIL import Image
root = os.path.join(os.path.dirname(__file__), '..')
out = {}
for f in sorted(os.listdir(os.path.join(root, 'assets'))):
    if not f.lower().endswith(('.webp', '.png', '.jpg', '.jpeg', '.gif')):
        continue
    path = os.path.join(root, 'assets', f)
    data = open(path, 'rb').read()
    im = Image.open(path).convert('L').resize((9, 8), Image.LANCZOS)
    px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
    bits = ''.join('1' if px[r*9+c] > px[r*9+c+1] else '0' for r in range(8) for c in range(8))
    out['assets/' + f] = {'sha256': hashlib.sha256(data).hexdigest(), 'dhash': '%016x' % int(bits, 2)}
json.dump(out, open(os.path.join(root, 'tests', 'image-manifest.json'), 'w'), indent=1, sort_keys=True)
print(len(out), 'images hashed')
