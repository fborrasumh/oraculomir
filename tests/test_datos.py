#!/usr/bin/env python3
"""Pruebas del paso PDF → preguntas con textos que imitan los cuadernos y plantillas oficiales (preguntas ficticias).
    python3 tests/test_datos.py"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / 'scripts'))
import mir_datos as M

CUADERNO = """MINISTERIO DE SANIDAD
PRUEBAS SELECTIVAS 2026
CUADERNO DE EXAMEN
1. Compruebe que este cuaderno lleva todas sus páginas.
2. Las respuestas se marcan en la hoja de respuestas.
3. Dispone de 270 minutos.
MEDICINA
1. Pregunta asociada a la imagen 1.
Varón de 64 años con dolor torácico opresivo y elevación del ST
en derivaciones inferiores. ¿Cuál es la actitud más adecuada?
1. Angioplastia primaria.
2. Observación.
3. Alta con
antiagregación.
4. Ecocardiograma diferido.
- 1 -
2. Niño de 8 meses con bronquiolitis. ¿Qué tratamiento es de elección?
1. Medidas de soporte.
2. Corticoides.
3. Antibiótico.
4. Salbutamol sistemático.
3. En un ensayo clínico, la sensibilidad de una prueba es:
1. Verdaderos positivos entre enfermos.
2. Verdaderos negativos entre sanos.
3. 2 mg/kg.
4. Ninguna.
4. Mujer embarazada de 32 semanas con preeclampsia grave. Señale la correcta:
1. Sulfato de magnesio.
2. Esperar.
3. Diuréticos.
4. Ninguna.
"""
PLANTILLA_PAREJAS = """RESPUESTAS CORRECTAS DEFINITIVAS
1 1 3 1
2 1 4 1
"""
PLANTILLA_VERSIONES = """Pregunta V0 V1 V2 V3 V4
1 1 2 3 4 1
2 1 3 3 2 2
3 ANULADA ANULADA ANULADA ANULADA ANULADA
4 1 1 1 1 1
"""

ok = True
def check(nombre, cond, extra=''):
    global ok; ok &= bool(cond); print(('✓' if cond else '✕'), nombre, extra)

qs, nopt = M.mejor_cuaderno(CUADERNO)
check('se saltan las instrucciones numeradas de la portada y salen las 4 preguntas', [q['n'] for q in qs] == [1, 2, 3, 4], str([(q['n'], q['enunciado'][:30]) for q in qs]))
check('4 opciones detectadas', nopt == 4)
check('el enunciado de varias líneas se une', 'elevación del ST en derivaciones inferiores' in qs[0]['enunciado'])
check('la opción partida en dos líneas se une', qs[0]['opciones'][2] == 'Alta con antiagregación.', qs[0]['opciones'][2])
check('el número de página no se cuela', all('- 1 -' not in o for o in qs[0]['opciones']))
check('pregunta con imagen marcada', qs[0]['imagen'] and not qs[1]['imagen'])
check('«2 mg/kg» dentro de una opción no rompe nada', qs[2]['opciones'][2] == '2 mg/kg.')
A = M.parse_plantilla(PLANTILLA_PAREJAS, 4, 4); check('plantilla en parejas', A == {1: 1, 3: 1, 2: 1, 4: 1}, str(A))
B = M.parse_plantilla(PLANTILLA_VERSIONES, 4, 4); check('plantilla por versiones: se toma la versión 0 y la anulada es 0', B == {1: 1, 2: 1, 3: 0, 4: 1}, str(B))
asigs = M.carga_asignaturas()
lab = [M.clasifica(q, asigs)[0] for q in qs]
check('clasificación por palabras clave', lab == ['cardio', 'pedia', 'estadistica', 'gine'], str(lab))
check('sin palabras clave → «otras»', M.clasifica({'enunciado': 'zzz', 'opciones': ['a', 'b']}, asigs) == ('otras', 0.0))
J = [{'V_0': '1', 'RC_0': '3', 'V_1': '43', 'RC_1': '2'}, {'V_0': '2', 'RC_0': ' ', 'V_1': '44', 'RC_1': '1'}]
check('hoja de respuestas JSON del portal: tabla en columnas y anulada en blanco', M.parse_respuestas_json(J) == {1: 3, 43: 2, 2: 0, 44: 1})
H = 'Preguntas de reserva ( 176 - 185 )  176 2 : pregunta 176, respuesta 2\n 10 Anulada : pregunta 10, anulada\n' + ''.join(f' {i} 1 : pregunta {i}, respuesta 1\n' for i in range(1, 120) if i != 10)
r = M.parse_plantilla(H, 185, 4); check('plantilla web con «pregunta N, respuesta R»: el rango «176 - 185» no anula nada', r.get(176) == 2 and r.get(10) == 0 and r.get(11) == 1, str({k: r.get(k) for k in (10, 11, 176)}))
G = 'V RC V RC\n1 5 53 3\n2 3 54 1\n106 158 5\n131 183 3 235 1\n'
r = M.parse_plantilla(G, 260, 5); check('tabla del Ministerio con anulada como hueco («106 158 5»)', r.get(106) == 0 and r.get(158) == 5 and r.get(131) == 0 and r.get(183) == 3 and r.get(53) == 3, str({k: r.get(k) for k in (53, 106, 158, 131, 183, 235)}))
import mir_fetch as F
check('año del examen: convocatoria 2025-2026 → 2026', F.anio_de('Convocatoria 2025-2026 Medicina') == 2026 and F.anio_de('MIR_2019_cuaderno.pdf') == 2019 and F.anio_de('conv 2014/15') == 2015)
check('tipo de documento', F.tipo_de('Cuaderno de examen') == 'cuaderno' and F.tipo_de('Plantilla de respuestas correctas') == 'plantilla' and F.tipo_de('Cuaderno de imágenes') == 'imagenes')
check('titulación: Medicina sí, Farmacia no', F.es_medicina('MEDICINA cuaderno 2020') and not F.es_medicina('FARMACIA cuaderno 2020'))
c = []; F.anota(c, 'https://x/a.pdf', 'Plantilla provisional de respuestas MEDICINA 2024'); check('plantilla provisional se distingue de la definitiva', c and c[0]['tipo'] == 'plantilla_provisional')
# imágenes reales del banco publicado: cada pregunta con imagen apunta a un JPEG válido y con el mismo nº que cita su enunciado
import json, re
from PIL import Image
RAIZ = pathlib.Path(__file__).resolve().parent.parent
_d = json.loads((RAIZ / 'data' / 'mir.json').read_text(encoding='utf-8')); _P = _d['preguntas'] if isinstance(_d, dict) else _d
_mal = []
for q in [q for q in _P if q.get('img')]:
    f = RAIZ / q['img']; m = re.search(r'imagen\s*(?:n[ºo°.]*\s*)?(\d+)', q['enunciado'], re.I)
    try:
        with Image.open(f) as I: I.verify()
        with Image.open(f) as I: w, h = I.size
    except Exception as e: _mal.append((q['id'], 'no se abre: ' + str(e))); continue
    if w < 200 or h < 120: _mal.append((q['id'], f'demasiado pequeña {w}x{h}'))
    if not m or int(m.group(1)) != int(re.search(r'/(\d+)\.jpg$', q['img']).group(1)): _mal.append((q['id'], 'el nº de imagen no coincide con el enunciado'))
check(f'imágenes del banco ({sum(1 for q in _P if q.get("img"))}): existen, se abren y corresponden a su pregunta', not _mal, str(_mal[:5]))
print('\nTODO OK' if ok else '\nHAY FALLOS'); sys.exit(0 if ok else 1)
