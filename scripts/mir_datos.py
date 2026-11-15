#!/usr/bin/env python3
"""OráculoMIR · de los PDF oficiales a data/mir.json (sin red).

    python3 scripts/mir_datos.py                 # lee data/raw/<año>/{cuaderno,plantilla}.pdf
    python3 scripts/mir_datos.py --solo-informe  # vuelve a clasificar y a escribir el informe con lo ya extraído

Para cada año:
  1. extrae el texto del cuaderno (versión 0) y de la plantilla DEFINITIVA de respuestas (pdfplumber);
  2. separa preguntas y opciones (parse_cuaderno) y lee la respuesta correcta de cada número (parse_plantilla);
  3. clasifica cada pregunta en una asignatura con las palabras clave de data/asignaturas.json (clasifica);
  4. escribe data/mir.json (lo que lee la app) y data/informe.md (qué se extrajo y qué falló, año a año).
Nada se inventa: una pregunta sin respuesta en la plantilla queda con correcta=null y no entra en simulacros."""
import argparse, json, re, sys, unicodedata, datetime, pathlib

R = pathlib.Path(__file__).resolve().parent.parent
RAW, OUT = R / 'data' / 'raw', R / 'data'


def norm(s):
    s = unicodedata.normalize('NFD', str(s or '').lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9ñ]+', ' ', s).strip()


# ── 1 · cuaderno ───────────────────────────────────────────────────────────────────────────────
RUIDO = re.compile(r'^\s*(-\s*\d+\s*-|\d+\s*/\s*\d+|p[aá]gina\s+\d+.*|versi[oó]n\s*:?\s*\d+.*|mir\s*20\d\d.*|medicina\s*$|cuaderno de examen.*|ministerio de sanidad.*|pruebas selectivas.*)\s*$', re.I)
NUM = re.compile(r'^\s*(\d{1,3})\s*[.)]\s*(.*)$')


def limpia_lineas(texto):
    return [l.rstrip() for l in texto.replace('\r', '').split('\n') if l.strip() and not RUIDO.match(l)]


def parse_cuaderno(texto, nopt):
    """Máquina de estados: pregunta q → enunciado → opciones 1..nopt → pregunta q+1.
    Un número de línea es opción si es la siguiente opción esperada; es pregunta nueva si es q+1 y ya están todas las opciones."""
    qs, cur, campo = [], None, None
    for l in limpia_lineas(texto):
        m = NUM.match(l)
        if m:
            n, resto = int(m.group(1)), m.group(2).strip()
            sig_q = (qs[-1]['n'] + 1 if qs else 1) if cur is None else cur['n'] + 1
            if cur is not None and len(cur['opciones']) < nopt and n == len(cur['opciones']) + 1 and campo is not None:
                cur['opciones'].append(resto); campo = 'opcion'; continue
            if n == sig_q and (cur is None or len(cur['opciones']) == nopt):
                if cur is not None: qs.append(cur)
                cur = {'n': n, 'enunciado': resto, 'opciones': []}; campo = 'enunciado'; continue
        if cur is None: continue
        if campo == 'enunciado': cur['enunciado'] = (cur['enunciado'] + ' ' + l.strip()).strip()
        elif campo == 'opcion': cur['opciones'][-1] = (cur['opciones'][-1] + ' ' + l.strip()).strip()
    if cur is not None: qs.append(cur)
    for q in qs:
        q['enunciado'] = re.sub(r'\s+', ' ', q['enunciado'])
        q['opciones'] = [re.sub(r'\s+', ' ', o) for o in q['opciones']]
        q['imagen'] = bool(re.search(r'\bimagen(es)?\b|\bfigura\b', q['enunciado'], re.I))
    return [q for q in qs if len(q['opciones']) == nopt]


def mejor_cuaderno(texto):
    """Los MIR antiguos tienen 5 opciones y los recientes 4, y la portada trae instrucciones numeradas («1. Compruebe…»).
    Se prueba a empezar en cada una de las primeras líneas «1.» y con 4 y 5 opciones; gana lo que extrae más preguntas."""
    ls = texto.replace('\r', '').split('\n')
    inicios = [i for i, l in enumerate(ls) if NUM.match(l) and int(NUM.match(l).group(1)) == 1][:12] or [0]
    mejor = ([], 4)
    for i in inicios:
        t = '\n'.join(ls[i:])
        for nopt in (4, 5):
            qs = parse_cuaderno(t, nopt)
            if qs and len(qs) >= len(mejor[0]): mejor = (qs, nopt)   # empate → el inicio más tardío (se salta la portada)
    return mejor


# ── 2 · plantilla ──────────────────────────────────────────────────────────────────────────────
TOK = re.compile(r'ANULADA|ANUL\.?|\d{1,3}|-', re.I)


def _val(tk, nopt):
    if tk.upper().startswith('ANUL') or tk == '-': return 0          # 0 = anulada
    v = int(tk); return v if 1 <= v <= nopt else None


def parse_plantilla(texto, n_preg, nopt):
    """Devuelve {n: correcta (1..nopt) | 0 (anulada)} con la estrategia que cubre más números 1..n_preg.
    A) parejas «número respuesta» seguidas (tablas a varias columnas);
    B) una fila por pregunta con una columna por versión: se toma la primera (versión 0)."""
    lineas = [TOK.findall(l) for l in texto.split('\n')]
    A, B = {}, {}
    for tks in lineas:
        for i in range(0, len(tks) - 1, 2):
            if tks[i].isdigit():
                q, v = int(tks[i]), _val(tks[i + 1], nopt)
                if 1 <= q <= n_preg and v is not None and q not in A: A[q] = v
        if len(tks) >= 2 and tks[0].isdigit():
            q, v = int(tks[0]), _val(tks[1], nopt)
            if 1 <= q <= n_preg and v is not None and q not in B: B[q] = v
    cubre = lambda d: sum(1 for i in range(1, n_preg + 1) if i in d)
    por_versiones = len(set(re.findall(r'\bV\s?([0-4])\b', texto, re.I))) >= 2   # cabecera «V0 V1 V2…»
    if por_versiones and cubre(B) >= 0.9 * cubre(A): return B
    return A if cubre(A) >= cubre(B) else B


# ── 3 · clasificación por palabras clave ─────────────────────────────────────────────────────────
def carga_asignaturas():
    return json.loads((OUT / 'asignaturas.json').read_text(encoding='utf-8'))['asignaturas']


def clasifica(q, asigs):
    """Puntúa cada asignatura: palabra clave en el enunciado = 2 × nº de palabras de la clave; en las opciones = 1 ×.
    Devuelve (id, confianza 0-1). Sin coincidencias → ('otras', 0)."""
    en, op = ' ' + norm(q['enunciado']) + ' ', ' ' + norm(' '.join(q['opciones'])) + ' '
    pts = {}
    for a in asigs:
        s = 0
        for kw in a['kw']:
            k = norm(kw); w = len(k.split())
            rx = re.compile(r'(?<![a-z0-9])' + re.escape(k))
            s += 2 * w * len(rx.findall(en)) + w * len(rx.findall(op))
        if s: pts[a['id']] = s
    if not pts: return 'otras', 0.0
    orden = sorted(pts.items(), key=lambda x: -x[1])
    total = sum(pts.values())
    return orden[0][0], round(orden[0][1] / total, 2)


# ── 4 · montaje ────────────────────────────────────────────────────────────────────────────────
def _dos_columnas(pg):
    """¿Página maquetada a dos columnas? Casi ninguna palabra cruza el centro y las dos mitades tienen texto."""
    ws = pg.extract_words(); mid = pg.width / 2
    if len(ws) < 40: return False
    cruza = sum(1 for w in ws if w['x0'] < mid < w['x1']); izq = sum(1 for w in ws if w['x1'] <= mid)
    return cruza / len(ws) < 0.02 and 0.2 < izq / len(ws) < 0.8


def texto_pdf(p):
    """Texto en orden de lectura: si la página va a dos columnas, primero la izquierda y luego la derecha."""
    import pdfplumber
    out = []
    with pdfplumber.open(p) as pdf:
        for pg in pdf.pages:
            if _dos_columnas(pg):
                w, h = pg.width, pg.height
                out += [pg.crop((0, 0, w / 2, h)).extract_text() or '', pg.crop((w / 2, 0, w, h)).extract_text() or '']
            else: out.append(pg.extract_text() or '')
    return '\n'.join(out)


def procesa_anio(anio, d):
    inf = {'anio': anio, 'ok': False}
    cu, pl = d / 'cuaderno.pdf', d / 'plantilla.pdf'
    if not cu.exists(): inf['error'] = 'falta cuaderno.pdf'; return [], inf
    tx = (d / 'cuaderno.txt').read_text(encoding='utf-8') if (d / 'cuaderno.txt').exists() else texto_pdf(cu)
    (d / 'cuaderno.txt').write_text(tx, encoding='utf-8')
    qs, nopt = mejor_cuaderno(tx)
    inf.update(preguntas=len(qs), opciones=nopt)
    if not qs: inf['error'] = 'no se reconocieron preguntas en el cuaderno'; return [], inf
    resp = {}
    if pl.exists():
        tp = (d / 'plantilla.txt').read_text(encoding='utf-8') if (d / 'plantilla.txt').exists() else texto_pdf(pl)
        (d / 'plantilla.txt').write_text(tp, encoding='utf-8')
        resp = parse_plantilla(tp, max(q['n'] for q in qs), nopt)
    inf['con_respuesta'] = sum(1 for q in qs if resp.get(q['n']))
    inf['anuladas'] = sum(1 for q in qs if resp.get(q['n']) == 0)
    huecos = [i for i in range(1, max(q['n'] for q in qs) + 1) if i not in {q['n'] for q in qs}]
    inf['huecos'] = huecos[:30]
    out = []
    for q in qs:
        r = resp.get(q['n'])
        out.append({'id': f"{anio}-{q['n']:03d}", 'anio': anio, 'n': q['n'], 'enunciado': q['enunciado'], 'opciones': q['opciones'],
                    'correcta': r if r else None, 'anulada': r == 0, 'imagen': q['imagen']})
    inf['ok'] = True
    return out, inf


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--solo-informe', action='store_true'); a = ap.parse_args()
    asigs = carga_asignaturas()
    preg, informes = [], []
    for d in sorted(p for p in RAW.glob('20[0-9][0-9]') if p.is_dir()):
        anio = int(d.name)
        try: qs, inf = procesa_anio(anio, d)
        except Exception as e: qs, inf = [], {'anio': anio, 'ok': False, 'error': f'{type(e).__name__}: {e}'}
        preg += qs; informes.append(inf)
    for q in preg: q['asig'], q['conf'] = clasifica(q, asigs)
    datos = {'generado': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
             'fuente': 'Cuadernos de examen y plantillas definitivas de respuestas del Ministerio de Sanidad (fse.sanidad.gob.es)',
             'clasificacion': 'automática por palabras clave (data/asignaturas.json); conf = peso de la asignatura ganadora sobre el total',
             'asignaturas': [{'id': x['id'], 'nombre': x['nombre']} for x in asigs] + [{'id': 'otras', 'nombre': 'Sin clasificar'}],
             'examenes': informes, 'preguntas': preg}
    (OUT / 'mir.json').write_text(json.dumps(datos, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # informe legible
    L = ['# Informe de extracción · OráculoMIR', '', f"Generado: {datos['generado']}", '',
         '| Año | Preguntas | Opciones | Con respuesta | Anuladas | Huecos | Estado |', '|---|---|---|---|---|---|---|']
    for i in informes:
        L.append(f"| {i['anio']} | {i.get('preguntas', 0)} | {i.get('opciones', '')} | {i.get('con_respuesta', 0)} | {i.get('anuladas', 0)} | {len(i.get('huecos', []))} | {'✓' if i['ok'] else '✕ ' + i.get('error', '')} |")
    sc = sum(1 for q in preg if q['asig'] == 'otras')
    L += ['', f'Preguntas totales: {len(preg)} · sin clasificar: {sc} ({(sc / max(1, len(preg))):.0%})', '',
          'Revisa a mano al menos 20 preguntas por año contra el PDF antes de fiarte de los datos.']
    (OUT / 'informe.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
    print('\n'.join(L))
    return 0 if preg else 1


if __name__ == '__main__':
    sys.exit(main())
