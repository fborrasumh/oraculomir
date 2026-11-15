#!/usr/bin/env python3
"""OráculoMIR · clasificación de las preguntas por asignatura con IA (opcional; mejora mucho a las palabras clave).

Se ejecuta en GitHub Actions solo si existe el secreto ANTHROPIC_API_KEY en el repositorio.
    ANTHROPIC_API_KEY=... python3 scripts/mir_clasifica_ia.py
Guarda el resultado en data/clasificacion_ia.json ({id: asignatura}) y solo clasifica las preguntas que aún no estén ahí,
así que cada ejecución cuesta solo lo nuevo. El código comprueba que cada etiqueta sea una asignatura válida;
lo que no lo sea se ignora y esa pregunta se queda con la clasificación por palabras clave."""
import json, os, sys, time, pathlib, urllib.request

R = pathlib.Path(__file__).resolve().parent.parent
DATA, CACHE = R / 'data' / 'mir.json', R / 'data' / 'clasificacion_ia.json'
MODELO = os.environ.get('MODELO_IA', 'claude-haiku-4-5-20251001')
LOTE = 25


def llama(prompt, key):
    body = json.dumps({'model': MODELO, 'max_tokens': 2500, 'messages': [{'role': 'user', 'content': prompt}]}).encode()
    req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body, headers={'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'})
    for k in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return ''.join(b.get('text', '') for b in json.loads(r.read())['content'])
        except Exception as e:
            if k == 3: raise
            time.sleep(5 * (k + 1))


def main():
    key = os.environ.get('ANTHROPIC_API_KEY')
    if not key: print('Sin ANTHROPIC_API_KEY: se mantiene la clasificación por palabras clave.'); return 0
    d = json.loads(DATA.read_text(encoding='utf-8'))
    asigs = [a for a in d['asignaturas'] if a['id'] != 'otras']; validas = {a['id'] for a in asigs}
    cache = json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
    pend = [q for q in d['preguntas'] if q['id'] not in cache]
    print(f'{len(pend)} preguntas por clasificar con {MODELO}')
    lista = '\n'.join(f"{a['id']}: {a['nombre']}" for a in asigs)
    for i in range(0, len(pend), LOTE):
        lote = pend[i:i + LOTE]
        prompt = (f'Clasifica cada pregunta del examen MIR en la asignatura de la que depende la respuesta (no la de los antecedentes del caso). '
                  f'Usa SOLO estos identificadores:\n{lista}\n\nDevuelve SOLO un objeto JSON {{"id_pregunta": "id_asignatura", ...}}.\n\n'
                  + '\n\n'.join(f"[{q['id']}] {q['enunciado'][:700]}\n" + '\n'.join(f'{k + 1}. {o[:200]}' for k, o in enumerate(q['opciones'])) for q in lote))
        try:
            tx = llama(prompt, key); j = json.loads(tx[tx.index('{'):tx.rindex('}') + 1])
            for q in lote:
                v = str(j.get(q['id'], '')).strip()
                if v in validas: cache[q['id']] = v
        except Exception as e: print('lote con error:', e)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True), encoding='utf-8')
        print(f'  {min(i + LOTE, len(pend))}/{len(pend)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
