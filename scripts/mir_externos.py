#!/usr/bin/env python3
"""OráculoMIR · MIR antiguos (2007-2021) desde copias de terceros de los PDF oficiales (data/fuentes_externas.json).
Se ejecuta en GitHub Actions (allí hay red):  python3 scripts/mir_externos.py
Para cada año prueba las URL en orden y se queda con la primera que pasa las comprobaciones:
  · cuaderno: es un PDF, su texto menciona MEDICINA y se extraen al menos el 90 % de las preguntas esperadas para ese año;
  · plantilla: PDF o página web cuyas respuestas cubren al menos el 90 % de las preguntas extraídas.
Lo que no pasa se descarta y se dice en el registro. Cada año guarda su origen en data/raw/<año>/origen.txt."""
import json, re, sys, html, pathlib, urllib.request, urllib.parse, http.cookiejar, tempfile
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import mir_datos as M
R = pathlib.Path(__file__).resolve().parent.parent; RAW = R / 'data' / 'raw'
ESPERADAS = lambda y: 260 if y <= 2014 else 235 if y <= 2019 else 185 if y <= 2021 else 210   # incluidas las de reserva
UA = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'}
cj = http.cookiejar.CookieJar(); OP = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))


def baja(url):
    m = re.search(r'[?&]id=([\w-]+)', url) if 'drive.google' in url else None
    if m: url = f'https://drive.usercontent.google.com/download?id={m.group(1)}&export=download&confirm=t'
    b = OP.open(urllib.request.Request(url, headers=UA), timeout=120).read()
    if m and b[:4] != b'%PDF':
        # página de aviso de Drive (fichero grande): reenviar su formulario con los campos ocultos (id, export, confirm, uuid…)
        t = b.decode('utf-8', 'ignore'); f = re.search(r'<form[^>]*action="([^"]+)"[^>]*>(.*?)</form>', t, re.S)
        if f:
            campos = dict(re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', f.group(2)))
            u2 = html.unescape(f.group(1)) + '?' + urllib.parse.urlencode(campos)
            b = OP.open(urllib.request.Request(u2, headers=UA), timeout=180).read()
        if b[:4] != b'%PDF':
            tit = re.search(r'<title>(.*?)</title>', b.decode('utf-8', 'ignore'), re.S)
            raise ValueError('Drive no da el PDF: ' + (tit.group(1).strip()[:80] if tit else b[:80].decode('utf-8', 'ignore')))
    return b


def texto_de(b, url):
    if b[:4] == b'%PDF':
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f: f.write(b); n = f.name
        return M.texto_pdf(n), 'pdf'
    t = re.sub(r'<script.*?</script>|<style.*?</style>', ' ', b.decode('utf-8', 'ignore'), flags=re.S)
    t = html.unescape(re.sub(r'<(br|/tr|/li|/p|/div)[^>]*>', '\n', t)); t = re.sub(r'<[^>]+>', ' ', t)
    return t, 'html'


def main():
    F = json.loads((R / 'data' / 'fuentes_externas.json').read_text(encoding='utf-8'))
    resumen = []
    for ys, e in F.items():
        if not ys.isdigit(): continue
        y = int(ys); d = RAW / ys
        if (d / 'respuestas.json').exists(): continue            # ya está del portal oficial
        d.mkdir(parents=True, exist_ok=True); qs = None; origen = []
        if (d / 'cuaderno.txt').exists():
            qs, nopt = M.mejor_cuaderno((d / 'cuaderno.txt').read_text(encoding='utf-8'))
        for u in ([] if qs and len(qs) >= 0.9 * ESPERADAS(y) else e.get('cuaderno', [])):
            try:
                b = baja(u); tx, tipo = texto_de(b, u)
                if tipo != 'pdf': raise ValueError('no es un PDF')
                if not re.search(r'medicina', tx, re.I): raise ValueError('no menciona MEDICINA')
                q2, nopt = M.mejor_cuaderno(tx)
                if len(q2) < 0.9 * ESPERADAS(y): raise ValueError(f'solo {len(q2)} preguntas de {ESPERADAS(y)}')
                (d / 'cuaderno.pdf').write_bytes(b); (d / 'cuaderno.txt').write_text(tx, encoding='utf-8'); qs = q2
                origen.append('cuaderno: ' + u); print(f'{y} cuaderno OK ({len(q2)} preg., {nopt} opciones) ← {u}'); break
            except Exception as ex: print(f'{y} cuaderno ✕ {u}: {ex}')
        if not qs: resumen.append(f'{y}: sin cuaderno válido'); continue
        if not (d / 'plantilla.txt').exists():
            nmax = max(q['n'] for q in qs)
            for u in e.get('plantilla', []):
                try:
                    b = baja(u); tx, tipo = texto_de(b, u)
                    if tipo == 'html': i = tx.lower().find('respuesta'); tx = tx[i:] if i >= 0 else tx
                    if tipo == 'pdf' and len(tx.strip()) < 200: raise ValueError('PDF escaneado sin texto: no se lee para no arriesgar respuestas mal leídas')
                    r = M.parse_plantilla(tx, nmax, nopt)
                    cubre = sum(1 for q in qs if q['n'] in r)
                    if cubre < 0.9 * len(qs): raise ValueError(f'respuestas para {cubre} de {len(qs)}')
                    (d / 'plantilla.txt').write_text(tx, encoding='utf-8')
                    if tipo == 'pdf': (d / 'plantilla.pdf').write_bytes(b)
                    origen.append('plantilla: ' + u); print(f'{y} plantilla OK ({cubre}/{len(qs)}, anuladas {sum(1 for v in r.values() if v == 0)}) ← {u}'); break
                except Exception as ex: print(f'{y} plantilla ✕ {u}: {ex}')
        if origen: (d / 'origen.txt').write_text('Copia de terceros del documento oficial del Ministerio de Sanidad\n' + '\n'.join(origen) + '\n', encoding='utf-8')
        resumen.append(f"{y}: cuaderno {'sí' if qs else 'no'} · plantilla {'sí' if (d / 'plantilla.txt').exists() else 'NO'}")
    print('\n'.join(resumen))


if __name__ == '__main__':
    main()
