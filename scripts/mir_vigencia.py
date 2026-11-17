#!/usr/bin/env python3
"""OráculoMIR · ¿sigue vigente la respuesta oficial? Revisión con IA de todas las preguntas oficiales frente a las guías actuales.

Dos pasadas, para no marcar de más:
  1. Revisor: con la respuesta oficial delante, dice si hoy es «vigente», «discutible» o «desactualizada» (y por qué cambio de guía).
  2. Verificador independiente, solo para las marcadas: intenta defender la respuesta oficial. Una pregunta queda como
     «desactualizada» solo si los dos coinciden; si no, «discutible».
No se revisan las anuladas ni las que llevan imagen (el modelo no la ve). Es una criba orientativa: lo marcado hay que revisarlo.
Se puede relanzar: guarda lo hecho en data/vigencia_ia.json y continúa. Se para sola antes del límite de tiempo de Actions.
    OPENAI_API_KEY=... python3 scripts/mir_vigencia.py"""
import json, os, sys, time, pathlib, concurrent.futures as cf
from collections import Counter, defaultdict
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import mir_clasifica_ia as IA

R = IA.R; DATA = R / 'data' / 'mir.json'; CACHE = R / 'data' / 'vigencia_ia.json'; SALIDA = R / 'data' / 'vigencia.json'
LOTE, HILOS, LIMITE = 8, 6, float(os.environ.get('MINUTOS', '48')) * 60
T0 = time.time()

def bloque(q): return f"[{q['id']}] MIR {q['anio']}\n{q['enunciado'][:900]}\n" + '\n'.join(f'{k + 1}. {o[:220]}' for k, o in enumerate(q['opciones'])) + f"\nRespuesta oficial: {q['correcta']}"

P1 = ('Eres un médico especialista que revisa un banco de preguntas oficiales del examen MIR (España). Para cada pregunta se da el año del examen y su respuesta oficial, '
      'que fue correcta según el criterio de ese año. Decide si, con las guías de práctica clínica, clasificaciones (TNM, GOLD, KDIGO…), fármacos y recomendaciones vigentes HOY, '
      'esa respuesta oficial sigue siendo la mejor:\n'
      '- "vigente": sigue siendo la mejor respuesta (este es el caso habitual).\n'
      '- "desactualizada": un cambio CONCRETO posterior al examen (guía, clasificación, fármaco retirado o nuevo estándar) hace que hoy otra opción sea la mejor o que la oficial sea incorrecta.\n'
      '- "discutible": ha habido cambios que la hacen dudosa, pero no está claro que otra opción sea mejor.\n'
      'Sé conservador: no marques como desactualizada por simple desacuerdo con la plantilla ni por errores que ya tuviera en su año. Nombra el cambio concreto y su año.\n'
      'Devuelve SOLO JSON: {"revisiones":[{"id":"2018-147","veredicto":"vigente","actual":0,"cambio":"guía o clasificación que cambió, con año (vacío si vigente)","motivo":"una frase"}]} '
      '("actual": número de la opción que hoy sería la mejor, o 0).\n\n')
P2 = ('Eres un médico especialista y tu tarea es DEFENDER la respuesta oficial de unas preguntas del examen MIR. Otro revisor afirma que ya no es la mejor por un cambio de guía. '
      'Comprueba si ese cambio existe de verdad, si es posterior al examen y si de verdad hace que hoy otra opción sea mejor. Si la afirmación es exagerada, inexacta o el cambio no afecta a esta pregunta, recházala.\n'
      'Devuelve SOLO JSON: {"revisiones":[{"id":"2018-147","confirma":true,"motivo":"una frase"}]}\n\n')

def llama_json(prompt, key):
    tx = IA.llama(prompt, key); return json.loads(tx[tx.index('{'):tx.rindex('}') + 1]).get('revisiones', [])

def pasada1(lote, key):
    out = {}
    for r in llama_json(P1 + '\n\n'.join(bloque(q) for q in lote), key):
        v = str(r.get('veredicto', '')); i = str(r.get('id', ''))
        if v in ('vigente', 'discutible', 'desactualizada'): out[i] = {'v1': v, 'actual': int(r.get('actual') or 0), 'cambio': str(r.get('cambio', ''))[:300], 'motivo': str(r.get('motivo', ''))[:400]}
    return out

def pasada2(lote, cache, key):
    txt = '\n\n'.join(bloque(q) + f"\nAfirmación del otro revisor: hoy sería mejor la opción {cache[q['id']]['actual'] or '(ninguna clara)'}. Cambio: {cache[q['id']]['cambio']}. {cache[q['id']]['motivo']}" for q in lote)
    return {str(r.get('id', '')): {'confirma': bool(r.get('confirma')), 'motivo2': str(r.get('motivo', ''))[:400]} for r in llama_json(P2 + txt, key)}

def en_paralelo(lotes, fn, cache, nombre):
    hechos = 0
    with cf.ThreadPoolExecutor(HILOS) as ex:
        futs = {}
        for l in lotes:
            if time.time() - T0 > LIMITE: break
            futs[ex.submit(fn, l)] = l
        for f in cf.as_completed(futs):
            try:
                for i, v in f.result().items():
                    if i in cache or nombre == 'p2': cache.setdefault(i, {}).update(v)
                    else: cache[i] = v
            except Exception as e: print('  lote con error:', str(e)[:200])
            hechos += 1
            if hechos % 10 == 0: CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True), encoding='utf-8'); print(f'  {nombre}: {hechos}/{len(futs)} lotes', flush=True)
    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True), encoding='utf-8')
    return len(futs) == len(lotes)

def main():
    key = os.environ.get('OPENAI_API_KEY') or os.environ.get('ANTHROPIC_API_KEY')
    if not key: sys.exit('Falta OPENAI_API_KEY')
    d = json.loads(DATA.read_text(encoding='utf-8')); P = d['preguntas']
    cand = [q for q in P if q.get('correcta') and not q.get('anulada') and not q.get('imagen') and len(q.get('opciones') or []) >= 4]
    cache = json.loads(CACHE.read_text(encoding='utf-8')) if CACHE.exists() else {}
    pend = [q for q in cand if q['id'] not in cache]
    print(f'{len(cand)} preguntas revisables · pendientes de la 1.ª pasada: {len(pend)} · modelo {IA.MODELO}')
    completo = en_paralelo([pend[i:i + LOTE] for i in range(0, len(pend), LOTE)], lambda l: pasada1(l, key), cache, 'p1')
    marc = [q for q in cand if q['id'] in cache and cache[q['id']]['v1'] != 'vigente' and 'confirma' not in cache[q['id']]]
    print(f'pendientes de la 2.ª pasada: {len(marc)}')
    if completo: completo = en_paralelo([marc[i:i + LOTE] for i in range(0, len(marc), LOTE)], lambda l: pasada2(l, cache, key), cache, 'p2')
    # resumen
    def final(c):
        if c['v1'] == 'vigente': return 'vigente'
        if 'confirma' not in c: return None
        return 'desactualizada' if c['v1'] == 'desactualizada' and c['confirma'] else 'discutible' if c['confirma'] or c['v1'] == 'desactualizada' else 'vigente'
    por = {q['id']: q for q in cand}; res = {i: final(c) for i, c in cache.items() if i in por}
    hechas = {i: v for i, v in res.items() if v}
    cnt = Counter(hechas.values()); anio = defaultdict(Counter); asig = defaultdict(Counter)
    for i, v in hechas.items(): anio[por[i]['anio']][v] += 1; asig[por[i]['asig']][v] += 1
    salida = {'fecha': time.strftime('%Y-%m-%d'), 'modelo': IA.MODELO, 'revisables': len(cand), 'revisadas': len(hechas), 'completa': completo and len(hechas) == len(cand),
              'total': dict(cnt), 'por_anio': {str(k): dict(v) for k, v in sorted(anio.items())}, 'por_asig': {k: dict(v) for k, v in sorted(asig.items())},
              'preguntas': {i: {'v': v, 'actual': cache[i]['actual'], 'cambio': cache[i]['cambio'], 'motivo': cache[i]['motivo'], 'verificador': cache[i].get('motivo2', '')} for i, v in sorted(hechas.items()) if v != 'vigente'}}
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1), encoding='utf-8')
    rs = (f"## Vigencia de las respuestas oficiales ({IA.MODELO})\n\nRevisadas {len(hechas)} de {len(cand)} preguntas revisables{' (incompleta: relanza el paso para continuar)' if not salida['completa'] else ''}.\n\n"
          f"- Vigentes: {cnt['vigente']}\n- Discutibles: {cnt['discutible']}\n- Desactualizadas (las dos pasadas coinciden): {cnt['desactualizada']}\n\n| Año | Vigente | Discutible | Desactualizada |\n|---|---|---|---|\n"
          + ''.join(f"| {k} | {v['vigente']} | {v['discutible']} | {v['desactualizada']} |\n" for k, v in sorted(anio.items())))
    print(rs)
    if os.environ.get('GITHUB_STEP_SUMMARY'): open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write(rs)

if __name__ == '__main__': main()
