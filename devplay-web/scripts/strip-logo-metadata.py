#!/usr/bin/env python3
"""Limpia metadatos (C2PA/caBX y otros chunks auxiliares) del PNG del logo.
Reconstruye el PNG solo con los chunks esenciales — píxeles intactos (lossless).
"""
import struct, sys

F = '/home/z/my-project/public/logo-devplay.png'
KEEP = {'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS'}

src = open(F, 'rb').read()
assert src[:8] == b'\x89PNG\r\n\x1a\n', 'no es un PNG válido'

out = b'\x89PNG\r\n\x1a\n'
pos, removed = 8, []
while pos < len(src):
    length = struct.unpack('>I', src[pos:pos+4])[0]
    ctype = src[pos+4:pos+8].decode('latin1')
    chunk = src[pos:pos+12+length]
    if ctype in KEEP:
        out += chunk
    else:
        removed.append(ctype)
    pos += 12 + length

open(F, 'wb').write(out)
print('chunks eliminados:', removed or 'ninguno')
print('tamaño: antes', len(src), '→ ahora', len(out), 'bytes')

# Verificación: re-escanear y confirmar que solo quedan esenciales
data = open(F, 'rb').read()
pos, final = 8, []
while pos < len(data):
    length = struct.unpack('>I', data[pos:pos+4])[0]
    final.append(data[pos+4:pos+8].decode('latin1'))
    pos += 12 + length
print('chunks finales:', final)
assert final[0] == 'IHDR' and final[-1] == 'IEND', 'estructura rota'
print('PNG válido y limpio ✓')
