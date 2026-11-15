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
import mir_fetch as F
check('año del examen: convocatoria 2025-2026 → 2026', F.anio_de('Convocatoria 2025-2026 Medicina') == 2026 and F.anio_de('MIR_2019_cuaderno.pdf') == 2019 and F.anio_de('conv 2014/15') == 2015)
check('tipo de documento', F.tipo_de('Cuaderno de examen') == 'cuaderno' and F.tipo_de('Plantilla de respuestas correctas') == 'plantilla' and F.tipo_de('Cuaderno de imágenes') == 'imagenes')
check('titulación: Medicina sí, Farmacia no', F.es_medicina('MEDICINA cuaderno 2020') and not F.es_medicina('FARMACIA cuaderno 2020'))
c = []; F.anota(c, 'https://x/a.pdf', 'Plantilla provisional de respuestas MEDICINA 2024'); check('plantilla provisional se distingue de la definitiva', c and c[0]['tipo'] == 'plantilla_provisional')
print('\nTODO OK' if ok else '\nHAY FALLOS'); sys.exit(0 if ok else 1)
