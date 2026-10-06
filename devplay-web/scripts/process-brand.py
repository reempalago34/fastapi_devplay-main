#!/usr/bin/env python3
"""
Procesa los assets de marca nuevos de DevPlay 🎨
  - Mascota → logo-devplay.png + default-avatar.png (512x512 optimizado)
  - Banner  → default-banner.png (1200x600) con placa "DEVPLAY · Juega. Crea. Comparte."
Paleta: crema #F6EFDE · terracota #C05B2E · espresso #40302A
"""
from PIL import Image, ImageDraw, ImageFont, ImageOps
import os, shutil

BRAND = '/home/z/my-project/brand-new'
PUBLIC = '/home/z/my-project/public'
BACKUP = f'{PUBLIC}/_brand-backup'
CARLITO = '/usr/share/fonts/truetype/english/Carlito-Bold.ttf'

ESPRESSO = (64, 48, 42, 255)        # #40302A
TERRACOTA = (192, 91, 46, 255)      # #C05B2E
CREMA = (246, 239, 222, 255)        # #F6EFDE

os.makedirs(BACKUP, exist_ok=True)

# ---------- backups ----------
for f in ['logo-devplay.png', 'uploads/default-avatar.png', 'uploads/default-banner.png']:
    src = f'{PUBLIC}/{f}'
    dst = f'{BACKUP}/{os.path.basename(f)}'
    if os.path.exists(src) and not os.path.exists(dst):
        shutil.copy2(src, dst)
        print(f'backup: {f} → _brand-backup/')

# ---------- 1) Mascota: logo + avatar ----------
m = Image.open(f'{BRAND}/mascot-raw.png').convert('RGB')
side = min(m.size)
m = ImageOps.fit(m, (side, side), Image.LANCZOS).resize((512, 512), Image.LANCZOS)
m.save(f'{PUBLIC}/logo-devplay.png', optimize=True)
m.save(f'{PUBLIC}/uploads/default-avatar.png', optimize=True)
print(f'mascota 512x512 → logo-devplay.png + default-avatar.png')

# ---------- 2) Banner con placa de texto ----------
b = Image.open(f'{BRAND}/banner-raw.png').convert('RGB')
b = b.resize((1200, 587), Image.LANCZOS)  # mantiene ~2:1
b = b.convert('RGBA')
overlay = Image.new('RGBA', b.size, (0, 0, 0, 0))
d = ImageDraw.Draw(overlay)

W, H = b.size
cx = W // 2
plate_w, plate_h = 660, 168
px0, py0 = cx - plate_w // 2, 209  # centrada en la banda visible del recorte del perfil (h-32/44/52)

# placa crema con doble filete espresso (estilo frame-double de la web)
d.rounded_rectangle([px0, py0, px0 + plate_w, py0 + plate_h], radius=10, fill=(*CREMA[:3], 252))
d.rounded_rectangle([px0 + 5, py0 + 5, px0 + plate_w - 5, py0 + plate_h - 5], radius=7, outline=ESPRESSO, width=3)
d.rounded_rectangle([px0 + 11, py0 + 11, px0 + plate_w - 11, py0 + plate_h - 11], radius=5, outline=(*ESPRESSO[:3], 110), width=1)

def text_tracked(dr, xy_center, text, font, tracking, fill):
    # dibuja texto con espaciado entre letras, centrado en xy_center
    widths = [dr.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = xy_center[0] - total / 2
    ascent, descent = font.getmetrics()
    y = xy_center[1] - (ascent + descent) / 2
    for ch, w in zip(text, widths):
        dr.text((x, y), ch, font=font, fill=fill)
        x += w + tracking

f_big = ImageFont.truetype(CARLITO, 74)
f_sub = ImageFont.truetype(CARLITO, 25)

text_tracked(d, (cx, py0 + 62), 'DEVPLAY', f_big, 14, ESPRESSO)
text_tracked(d, (cx, py0 + 128), 'JUEGA · CREA · COMPARTE', f_sub, 7, TERRACOTA)

out = Image.alpha_composite(b, overlay).convert('RGB')
out.save(f'{PUBLIC}/uploads/default-banner.png', optimize=True)
print(f'banner {out.size} → default-banner.png')

# ---------- resumen ----------
for f in ['logo-devplay.png', 'uploads/default-avatar.png', 'uploads/default-banner.png']:
    kb = os.path.getsize(f'{PUBLIC}/{f}') / 1024
    print(f'  {f}: {kb:.0f} KB')
print('LISTO')
