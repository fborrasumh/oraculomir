#!/usr/bin/env python3
"""Cuadernillos de imágenes → data/img/<año>/<nº>.jpg  (una imagen por página, ancho máx. 1000 px, JPEG ligero).
El número de imagen se lee del texto de la página («IMAGEN Nº 5», «Imagen 5»); si la página no lo trae, se usa su posición.
Necesita pdftoppm (poppler-utils).   python3 scripts/mir_imagenes.py"""
import re, subprocess, sys, pathlib, tempfile, shutil
R = pathlib.Path(__file__).resolve().parent.parent; RAW = R / 'data' / 'raw'; IMG = R / 'data' / 'img'
NUM = re.compile(r'IMAGEN\s*(?:N\s*[ºo°.]*\s*)?(\d{1,3})', re.I)


def etiquetas(pdf):
    import pdfplumber
    with pdfplumber.open(pdf) as p:
        return [[int(m) for m in NUM.findall(pg.extract_text() or '')] for pg in p.pages]


def main():
    for d in sorted(RAW.glob('20*/imagenes.pdf')):
        anio = d.parent.name; out = IMG / anio
        if out.exists() and any(out.glob('*.jpg')): continue
        et = etiquetas(d); tmp = pathlib.Path(tempfile.mkdtemp())
        subprocess.run(['pdftoppm', '-jpeg', '-jpegopt', 'quality=72', '-scale-to', '1000', str(d), str(tmp / 'p')], check=True)
        pags = sorted(tmp.glob('p-*.jpg'), key=lambda f: int(f.stem.split('-')[1]))
        out.mkdir(parents=True, exist_ok=True); usados, n = set(), 0
        # páginas de portada/instrucciones sin etiqueta antes de la primera imagen: se saltan si después sí hay etiquetas
        con_et = any(et)
        for i, f in enumerate(pags):
            nums = [k for k in (et[i] if i < len(et) else []) if k not in usados]
            if con_et and not nums: continue
            k = nums[0] if nums else i + 1
            usados.add(k); shutil.copy(f, out / f'{k}.jpg'); n += 1
        shutil.rmtree(tmp)
        print(f'{anio}: {len(pags)} páginas → {n} imágenes (etiquetadas: {"sí" if con_et else "no, por orden"})')


if __name__ == '__main__':
    main()
