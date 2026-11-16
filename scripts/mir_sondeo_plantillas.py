#!/usr/bin/env python3
"""Sondeo (solo diagnóstico) de fuentes para las plantillas que faltan (2010 y 2014). Guarda lo encontrado en
data/raw/<año>/sondeo/ para revisarlo antes de usar nada:
  · oposicionesgratis.com/mir/examenes/<año>: respuestas JSON de su web y __NEXT_DATA__;
  · OCR (tesseract) de las imágenes de la plantilla oficial: casiMedicos (2014) y PDF escaneados de Drive."""
import json, re, sys, subprocess, pathlib, time, urllib.request
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import mir_externos as X
R = pathlib.Path(__file__).resolve().parent.parent
IMG = {2014: [('casimedicos_png', 'https://www.casimedicos.com/mir/wp-content/uploads/2014/02/casimedicos25_2_14_respuestasMIR2013_14.png'),
              ('drive_escaneado', 'https://drive.google.com/uc?export=download&id=0BzoyV8-T3UMEYzVKWmk0TEVNbUk')],
       2010: [('drive_hoja', 'https://drive.google.com/uc?export=download&id=0BzoyV8-T3UMEWlc5ZlNXNC1wNXc')]}


def ocr(nombre, b, dst):
    f = dst / (nombre + ('.pdf' if b[:4] == b'%PDF' else '.png')); f.write_bytes(b)
    imgs = []
    if f.suffix == '.pdf':
        subprocess.run(['pdftoppm', '-r', '300', '-png', str(f), str(dst / nombre)], check=True)
        imgs = sorted(dst.glob(nombre + '-*.png'))
    else: imgs = [f]
    txt = ''
    for im in imgs:
        for psm in ('6',):
            txt += subprocess.run(['tesseract', str(im), '-', '--psm', psm, '-l', 'spa'], capture_output=True, text=True).stdout + '\n'
    (dst / (nombre + '_ocr.txt')).write_text(txt, encoding='utf-8')
    print(f'  OCR {nombre}: {len(imgs)} imagen(es), {len(txt)} caracteres. Muestra:\n' + '\n'.join('    ' + l for l in txt.splitlines()[:25]))


def web(anio, dst):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(locale='es-ES'); js = []
        pg.on('response', lambda r: js.append(r) if 'json' in (r.headers.get('content-type') or '') else None)
        pg.goto(f'https://oposicionesgratis.com/mir/examenes/{anio}', wait_until='networkidle', timeout=90000); time.sleep(3)
        html = pg.content(); (dst / 'oposicionesgratis.html').write_text(html, encoding='utf-8')
        nd = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
        if nd: (dst / 'oposicionesgratis_next.json').write_text(nd.group(1), encoding='utf-8'); print('  __NEXT_DATA__:', len(nd.group(1)), 'bytes:', nd.group(1)[:600])
        for i, r in enumerate(js[:30]):
            try: t = r.text(); (dst / f'oposicionesgratis_resp{i}.json').write_text(t, encoding='utf-8'); print('  JSON', r.url, len(t), t[:300])
            except Exception: pass
        print('  Texto visible:', pg.inner_text('body')[:1500].replace('\n', ' | '))
        for sel in ('text=Hacerlo', 'text=Consultar', 'text=Ver respuestas', 'text=Empezar'):
            try: pg.click(sel, timeout=3000); time.sleep(3); print('  pulsado', sel, '→', pg.url); break
            except Exception: pass
        (dst / 'oposicionesgratis_tras_click.html').write_text(pg.content(), encoding='utf-8')
        for i, r in enumerate(js[30:60]):
            try: t = r.text(); (dst / f'oposicionesgratis_resp_b{i}.json').write_text(t, encoding='utf-8'); print('  JSON(b)', r.url, len(t), t[:300])
            except Exception: pass
        b.close()


for anio in (2010, 2014):
    dst = R / 'data' / 'raw' / str(anio) / 'sondeo'; dst.mkdir(parents=True, exist_ok=True); print(f'== {anio}')
    try: web(anio, dst)
    except Exception as e: print('  web: error', e)
    for nombre, u in IMG[anio]:
        try: ocr(nombre, X.baja(u) if 'drive' in u else X.OP.open(urllib.request.Request(u, headers=X.UA), timeout=60).read(), dst)
        except Exception as e: print('  OCR', nombre, 'error', e)
