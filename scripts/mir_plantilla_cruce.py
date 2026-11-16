#!/usr/bin/env python3
"""Respuestas de 2010 y 2014 cruzando NUESTRO cuaderno con la transcripción de oposicionesgratis.com
(que declara venir de la plantilla definitiva —2014— o de dos transcripciones independientes coincidentes —2010—).
Se empareja por TEXTO del enunciado (no por número) y la opción correcta por TEXTO de la opción. Se acepta solo si:
  · el enunciado coincide (Jaccard ≥ 0,6) y la opción correcta encaja con una de las nuestras (≥ 0,7) sin ambigüedad;
  · ninguna anulada publicada (data/verificacion.json) recibe respuesta;
  · los cambios de respuesta publicados («cambios») coinciden.
Escribe data/raw/<año>/respuestas_cruce.json  {n: correcta}  y lo anota en origen.txt.   python3 scripts/mir_plantilla_cruce.py"""
import json, re, sys, pathlib, unicodedata
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent)); import mir_datos as M
R = pathlib.Path(__file__).resolve().parent.parent
def toks(s):
    s = unicodedata.normalize('NFD', str(s).lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return set(re.findall(r'[a-zñ0-9]{3,}', s))
def jac(a, b):
    A, B = toks(a), toks(b); return len(A & B) / max(1, len(A | B))

ver = json.loads((R / 'data' / 'verificacion.json').read_text(encoding='utf-8'))
ok_total = True
for y in (2010, 2014):
    d = R / 'data' / 'raw' / str(y); src = d / 'sondeo' / 'oposicionesgratis_resp0.json'
    if not src.exists(): print(y, 'sin fuente'); continue
    G = json.loads(src.read_text(encoding='utf-8')); qs, nopt = M.mejor_cuaderno((d / 'cuaderno.txt').read_text(encoding='utf-8'))
    res, dudas = {}, []
    for g in G:
        sc = sorted(((jac(q['enunciado'], g['enunciado']), q) for q in qs), key=lambda x: -x[0])
        s, q = sc[0]
        if s < 0.6 or (len(sc) > 1 and sc[1][0] > s - 0.1): dudas.append((g['id'], 'enunciado', round(s, 2))); continue
        txt = g['opciones'][int(g['correcta'])]
        so = sorted(((jac(o, txt), k + 1) for k, o in enumerate(q['opciones'])), key=lambda x: -x[0])
        if so[0][0] < 0.7 or (len(so) > 1 and so[1][0] > so[0][0] - 0.15): dudas.append((g['id'], 'opción', round(so[0][0], 2))); continue
        if q['n'] in res and res[q['n']] != so[0][1]: dudas.append((g['id'], 'choque', q['n'])); res.pop(q['n']); continue
        res[q['n']] = so[0][1]
    v = ver.get(str(y), {}); anul = set(v.get('anuladas', []))
    choca_anul = sorted(anul & set(res)); cambios = {int(k): c for k, c in v.get('cambios', {}).items()}
    mal_cambio = {k: (c, res.get(k)) for k, c in cambios.items() if res.get(k) != c}
    valido = not choca_anul and not mal_cambio
    ok_total &= valido
    print(f"{y}: {len(res)} respuestas de {len(qs)} preguntas · dudas {len(dudas)} · anuladas publicadas con respuesta {choca_anul or 'ninguna'} · cambios publicados {'✓' if not mal_cambio else mal_cambio} → {'ACEPTADO' if valido else 'RECHAZADO'}")
    for x in dudas[:8]: print('   duda', x)
    if valido:
        out = {str(n): c for n, c in sorted(res.items())}
        for n in anul: out[str(n)] = 0
        (d / 'respuestas_cruce.json').write_text(json.dumps(out, indent=0), encoding='utf-8')
        o = d / 'origen.txt'; L = o.read_text(encoding='utf-8').splitlines() if o.exists() else ['Copia de terceros del documento oficial del Ministerio de Sanidad']
        lin = f'plantilla: https://oposicionesgratis.com/mir/examenes/{y} (cruce por texto con el cuaderno; anuladas de data/verificacion.json)'
        if lin not in L: o.write_text('\n'.join([l for l in L if not l.startswith('plantilla: ')] + [lin]) + '\n', encoding='utf-8')
sys.exit(0 if ok_total else 1)
