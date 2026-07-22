"""Generate placeholder icon files for Snapzy."""
from PIL import Image, ImageDraw
import os, struct

DIR = os.path.dirname(os.path.abspath(__file__))
COLOR = (99, 102, 241)
BG = (30, 30, 35)

def make_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = size // 6
    d.rounded_rectangle([(0, 0), (size-1, size-1)], radius=r, fill=BG)
    cx, cy = size // 2, size // 2
    bw, bh = size * 3 // 5, size * 3 // 8
    bx, by = cx - bw // 2, cy - bh // 4
    d.rounded_rectangle([(bx, by), (bx+bw, by+bh)], radius=bw//8, fill=COLOR)
    lr = size // 6
    d.ellipse([(cx-lr, cy-lr), (cx+lr, cy+lr)], fill=(255,255,255))
    d.ellipse([(cx-lr+3, cy-lr+3), (cx+lr-3, cy+lr-3)], fill=COLOR)
    return img

# PNG icons
make_icon(32).save(os.path.join(DIR, '32x32.png'))
make_icon(128).save(os.path.join(DIR, '128x128.png'))
make_icon(256).save(os.path.join(DIR, '128x128@2x.png'))

# Windows ICO (single 256x256, sufficient for tauri-build)
make_icon(256).save(os.path.join(DIR, 'icon.ico'), format='ICO')

# macOS ICNS (minimal valid file)
png_bytes = open(os.path.join(DIR, '128x128.png'), 'rb').read()
entry = b'ic07' + struct.pack('>I', len(png_bytes) + 8) + png_bytes
header = b'icns' + struct.pack('>I', len(entry) + 8)
with open(os.path.join(DIR, 'icon.icns'), 'wb') as f:
    f.write(header + entry)

print("Icons generated successfully.")
