/* ══ OráculoMIR · interfaz. La lógica pura está en nucleo.js (probada en Node) y los datos en datos.js ══ */
const STEPS = ['Inicio', 'Predicción', 'Simulacro', 'Generador IA'];
const HUBS = ['Reto diario', 'Mi estudio', 'Banco y exámenes', 'Validación'];
const NAV = [['Ver la predicción', 'Todo funciona sin clave, salvo el generador de preguntas nuevas.'], ['Siguiente: simulacro', 'Pulsa «Practicar» en una asignatura para un simulacro solo de ella.'], ['Siguiente: generador IA', 'Elige cuántas preguntas y empieza; puedes dejar el simulacro y volver.'], ['Volver al inicio', 'Descarga las preguntas aceptadas en Word, CSV o Moodle (GIFT).']];
const RENDER = {0: pintaInicio, 1: pintaPred, 2: pintaSim, 3: pintaGen, 4: pintaReto, 5: pintaEstudio, 6: pintaBanco, 7: pintaValidacion};
const REPO = 'fborrasumh/oraculomir';
const GLOS = [
  ['¿De dónde salen las preguntas?', 'De los cuadernos de examen y las plantillas definitivas de respuestas que publica el Ministerio de Sanidad en su portal de Formación Sanitaria Especializada. Un proceso automático del repositorio los descarga, extrae el texto y lee la respuesta oficial de cada pregunta. Las preguntas anuladas y las que dependen de una imagen no entran en los simulacros.'],
  ['¿Cómo se clasifica cada pregunta?', 'Por palabras clave de cada asignatura (fichero data/asignaturas.json del repositorio). Es automático y se equivoca a veces, sobre todo en preguntas que tocan dos asignaturas. La parte sin clasificar se indica en la portada.'],
  ['¿Cómo se predice?', 'Para cada asignatura se calcula qué parte del examen ha ocupado cada año. Los años recientes pesan más (semivida de 4 años) y se añade la mitad de la tendencia. El resultado se escala a 200 preguntas. El intervalo del 80 % combina lo que varía de un año a otro y el azar propio de un recuento.'],
  ['¿Cuánto fiarse?', 'El método se prueba a ciegas: se esconde el último examen, se predice con los anteriores y se compara con lo que salió, en los tres últimos MIR. Se compara con dos referencias sencillas: repetir el año anterior y la media de todos los años. Si no las mejora, la app lo dice y conviene usar el resultado solo como orden de prioridad.'],
  ['¿Predice preguntas concretas?', 'No. Predice cuántas preguntas tendrá cada asignatura. El simulacro usa preguntas oficiales de años anteriores en esa proporción: sirve para entrenar el formato y el ritmo, no para adivinar el examen.'],
  ['Generador con agentes', 'Un agente redacta, con el contexto de años anteriores (temas que más se repiten, temas que llevan tiempo sin salir y seis preguntas oficiales recientes), dos agentes resuelven a ciegas con las opciones barajadas y el código comprueba el formato y que no sea una copia del banco oficial. Solo se aceptan las preguntas que los tres responden igual. Eso reduce mucho los errores, pero no los elimina. Si tienes claves de dos proveedores, usa el otro para el segundo resolutor: modelos distintos se equivocan menos a la vez.'],
  ['Privacidad y coste', 'La predicción, los simulacros y el reto diario funcionan en tu navegador, sin clave y sin enviar nada. El generador envía al proveedor de IA que elijas la asignatura y unas preguntas oficiales de ejemplo; nunca datos tuyos. Cada tanda son tres llamadas a la IA y la pagas tú con tu clave: elige un modelo económico.'],
  ['Puntuación', 'Como en el MIR: +3 por acierto, −1 por fallo y 0 en blanco. La «neta» es aciertos menos fallos entre tres.']
];
let S = {sim: null, reto: null, racha: {ultima: null, n: 0}, gen: [], genStats: null, asigSim: 'probable', hist: {}, explic: {}, prac: null};
let ENVIO_OK = false, PRED = {filas: [], anios: []}, VAL = null, relojT = null;
const BASE_URL = () => location.origin + location.pathname;
const pct = x => Math.round(x * 100) + ' %';

/* ── cálculo una vez cargados los datos (se quita «Sin clasificar» de la predicción) ── */
function calcula() {
  const c = {}; for (const y in DATA.conteos) { c[y] = {}; for (const k in DATA.conteos[y]) if (k !== 'otras') c[y][k] = DATA.conteos[y][k]; }
  PRED = predice(c, ANIO_OBJ, {asigs: DATA.asignaturas.map(a => a.id).filter(id => id !== 'otras' && aniosDe(c).some(y => c[y][id]))});
  VAL = valida(c);
}
const preg = id => DATA.preguntas.find(q => q.id === id);
const origenDe = q => q.demo ? t('Pregunta de ejemplo (no oficial)') : t('MIR {0} · pregunta {1}', q.anio, q.n) + (q.fuente === 'tercero' ? ' · ' + t('tomada de una copia del cuaderno oficial') : '');

/* ── compartir: menú nativo del móvil; si no hay, se copia al portapapeles ── */
async function comparte(texto, url) {
  try { if (navigator.share) { await navigator.share({text: texto, url}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(texto + (url && !texto.includes(url) ? '\n' + url : '')); toast(t('Copiado: pégalo en WhatsApp, Instagram o donde quieras')); }
  catch { toast(t('No se pudo copiar. Copia el enlace de la barra del navegador.')); }
}
const enlaceWA = texto => 'https://wa.me/?text=' + encodeURIComponent(texto);

/* ── 0 · inicio ── */
function pintaInicio() {
  const d = diasHastaMIR();
  $('cuenta').innerHTML = `<b>${d}</b> <span>${esc(d === 1 ? t('día para el MIR 2027') : t('días para el MIR 2027'))}</span><small>${esc(t('Sábado 23 de enero de 2027, 14:00'))}${S.racha.n ? ' · 🔥 ' + esc(t('racha de {0} días', S.racha.n)) : ''}</small>`;
  const ys = aniosDe(DATA.conteos), sc = DATA.preguntas.filter(q => q.asig === 'otras').length;
  $('estadoDatos').innerHTML = DATA.real
    ? `<div class="okbox">${esc(t('Banco oficial: {0} preguntas de los MIR {1} a {2}. {3} se pueden usar en simulacros (con respuesta, sin imagen y no anuladas).', nf(DATA.preguntas.length), ys[0], ys.at(-1), nf(DATA.preguntas.filter(utilizable).length)))} ${esc(t('Asignatura asignada con IA: {0}; por palabras clave: el resto. Sin clasificar: {1}.', pct(DATA.preguntas.filter(q => q.metodo === 'ia').length / Math.max(1, DATA.preguntas.length)), pct(sc / Math.max(1, DATA.preguntas.length))))}</div>`
    : `<div class="aviso"><b>${esc(t('Modo demostración.'))}</b> ${esc(t('Aún no se han cargado los exámenes oficiales: los recuentos son ficticios y las 12 preguntas son ejemplos escritos para la demo. Los datos reales los trae el flujo «Datos MIR» del repositorio.'))}</div>`;
  const pend = pendientes(S.hist, fechaMadrid()).length;
  $('inicioProj').innerHTML = (S.sim && !S.sim.fin ? `${esc(t('Tienes un simulacro a medias.'))} <button class="btn btn-ghost btn-sm" id="btnCont" type="button">${esc(t('Seguir'))}</button> ` : '')
    + (pend ? `${esc(t('Tienes {0} preguntas para repasar hoy.', pend))} <button class="btn btn-ghost btn-sm" type="button" data-irpaso="5">${esc(t('Repasar'))}</button>` : '');
}
$('btnStart').onclick = () => go(1);
$('btnEjemplo').onclick = () => go(4);
document.addEventListener('click', e => { if (e.target.id === 'btnCont') go(2); const b = e.target.closest('[data-irpaso]'); if (b) go(+b.dataset.irpaso); });

/* ── 1 · predicción ── */
function pintaPred() {
  const v = VAL;
  $('confianza').innerHTML = (DATA.real ? '' : `<div class="aviso">${esc(t('Datos de demostración ficticios: la tabla muestra cómo funciona, no la predicción real.'))}</div>`) + (v
    ? `<h3>${esc(t('¿Cuánto fiarse?'))} <span class="fa-chip ${v.nivel === 'alta' ? 'ok' : v.nivel === 'media' ? 'aviso' : 'error'}">${esc(t(v.nivel === 'alta' ? 'Fiabilidad alta' : v.nivel === 'media' ? 'Fiabilidad media' : 'Fiabilidad baja'))}</span></h3>
      <p>${esc(t('Probado a ciegas en los MIR {0}: el método se desvió de media {1} preguntas por asignatura. Repetir lo del año anterior se desviaba {2} y la media de todos los años, {3}. De las 10 asignaturas que puso arriba, {4} estaban de verdad entre las 10 con más preguntas.', v.porAnio.map(o => o.anio).join(', '), v.mae.toFixed(1), v.maeAnterior.toFixed(1), v.maeMedia.toFixed(1), v.aciertoTop10.toFixed(1)))}</p>
      <p class="help">${esc(t(v.nivel === 'alta' ? 'El reparto por asignaturas es bastante estable: úsalo para repartir tus horas.' : v.nivel === 'media' ? 'Mejora poco a las referencias sencillas: tómalo como orientación.' : 'No mejora a las referencias sencillas: úsalo solo como orden de prioridad y no dejes ninguna asignatura a cero.'))}</p>`
    : `<p>${esc(t('Hacen falta al menos cuatro exámenes para probar el método a ciegas.'))}</p>`);
  const max = Math.max(1, ...PRED.filas.map(f => f.hi));
  const fl = {sube: '↑', baja: '↓', estable: '→'};
  $('tablaPred').innerHTML = `<thead><tr><th>#</th><th>${esc(t('Asignatura'))}</th><th>${esc(t('Esperadas 2027'))}</th><th>${esc(t('Intervalo 80 %'))}</th><th>${esc(t('Tendencia'))}</th><th>${esc(t('Últimos MIR'))}</th><th></th></tr></thead><tbody>${PRED.filas.map((f, i) => `<tr>
    <td>${i + 1}</td><td><b>${esc(nombreAsig(f.id))}</b>${f.ultimaVez && f.ultimaVez < PRED.anios.at(-1) - 1 ? `<br><small class="muted">${esc(t('sin preguntas desde {0}', f.ultimaVez))}</small>` : ''}</td>
    <td><div class="om-bar${f.n / max < 0.2 ? ' corto' : ''}" role="img" style="--w:${(f.n / max * 100).toFixed(1)}%" aria-label="${esc(t('{0} preguntas esperadas', Math.round(f.n)))}"><span style="width:${(f.n / max * 100).toFixed(1)}%"></span><em>${Math.round(f.n)}</em></div></td>
    <td>${f.lo}–${f.hi}</td><td title="${esc(t(f.tend))}">${fl[f.tend]} <small>${esc(t(f.tend))}</small></td>
    <td><small>${f.ult.map(u => `${u.anio}: ${u.n}`).join(' · ')}</small></td>
    <td><button class="btn btn-ghost btn-sm" type="button" data-practica="${esc(f.id)}">${esc(t('Practicar'))}</button></td></tr>`).join('')}</tbody>`;
  $('notaPred').textContent = t('Calculado con los MIR {0}–{1}. Las preguntas sin clasificar no se reparten. Las cifras de años antiguos se escalan a 200 preguntas.', PRED.anios[0] ?? '–', PRED.anios.at(-1) ?? '–');
}
document.addEventListener('click', e => { const b = e.target.closest('[data-practica]'); if (b) { S.asigSim = b.dataset.practica; guarda(); go(2); } });
$('btnCsvPred').onclick = () => dl('oraculomir_prediccion_2027.csv', csvDe([t('asignatura'), t('esperadas'), t('minimo_80'), t('maximo_80'), t('tendencia')], PRED.filas.map(f => [nombreAsig(f.id), f.n.toFixed(1), f.lo, f.hi, t(f.tend)])), 'text/csv;charset=utf-8');
/* imagen para redes (1080×1350): lo que más se comparte es una imagen con un dato claro */
function lienzoPred() {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#0F2237'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#FFB38A'; g.font = '700 34px system-ui, sans-serif'; g.fillText('OráculoMIR', 70, 100);
  g.fillStyle = '#fff'; g.font = '800 64px system-ui, sans-serif'; g.fillText(t('MIR 2027: lo que más pesa'), 70, 190);
  g.fillStyle = '#C3D3E2'; g.font = '400 30px system-ui, sans-serif'; g.fillText(t('Preguntas esperadas sobre 200, según los MIR {0}-{1}', PRED.anios[0], PRED.anios.at(-1)), 70, 240);
  const top = PRED.filas.slice(0, 10), max = Math.max(1, ...top.map(f => f.n));
  top.forEach((f, i) => {
    const y = 320 + i * 88; g.fillStyle = '#fff'; g.font = '600 30px system-ui, sans-serif'; g.fillText(`${i + 1}. ${nombreAsig(f.id)}`.slice(0, 44), 70, y);
    g.fillStyle = '#1F3A56'; g.fillRect(70, y + 16, 780, 28); g.fillStyle = '#E4572E'; g.fillRect(70, y + 16, 780 * f.n / max, 28);
    g.fillStyle = '#fff'; g.font = '800 34px system-ui, sans-serif'; g.fillText(String(Math.round(f.n)), 880, y + 42);
  });
  g.fillStyle = '#9DB6CD'; g.font = '400 26px system-ui, sans-serif';
  g.fillText(DATA.real ? t('Estimación estadística, no una filtración. Pruébala gratis:') : t('DEMO con datos ficticios'), 70, H - 110);
  g.fillStyle = '#7FD6C4'; g.font = '700 30px system-ui, sans-serif'; g.fillText(BASE_URL().replace(/^https?:\/\//, ''), 70, H - 64);
  return c;
}
$('btnCompartePred').onclick = () => {
  if (!PRED.filas.length) return toast(t('Aún no hay predicción'));
  lienzoPred().toBlob(async b => {
    const f = new File([b], 'oraculomir_2027.png', {type: 'image/png'}), txt = t('Según OráculoMIR, en el MIR 2027 lo que más pesa es {0}. ¿Y tú qué llevas peor?', PRED.filas.slice(0, 3).map(x => nombreAsig(x.id)).join(', '));
    try { if (navigator.canShare && navigator.canShare({files: [f]})) { await navigator.share({files: [f], text: txt, url: BASE_URL()}); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    dl('oraculomir_2027.png', b); toast(t('Imagen descargada: compártela en tus redes'));
  }, 'image/png');
};

/* ── examen (simulacro y reto): una pregunta por pantalla, con rejilla para saltar ── */
function pintaPregunta(box, ex, modo) {
  const ids = ex.qs, i = Math.min(ex.idx || 0, ids.length - 1), q = preg(ids[i]);
  if (!q) { box.innerHTML = `<p class="empty">${esc(t('No se encontró la pregunta.'))}</p>`; return; }
  const inm = modo !== 'sim', r = ex.resp[q.id], ver = ex.fin || (inm && r);
  const rejilla = ids.map((id, k) => { const rr = ex.resp[id], qq = preg(id), est = !rr ? '' : (ex.fin || inm) ? (qq && rr === qq.correcta ? 'ok' : 'ko') : 'resp'; return `<button type="button" class="om-cel ${est} ${k === i ? 'act' : ''}" data-ir="${k}" aria-label="${esc(t('Pregunta {0}', k + 1))}">${k + 1}</button>`; }).join('');
  box.innerHTML = `<div class="card om-preg">
    <div class="om-cab"><span class="fa-chip">${esc(t('Pregunta {0} de {1}', i + 1, ids.length))}</span><span class="fa-chip">${esc(nombreAsig(q.asig))}</span>${modo === 'sim' && !ex.fin && ex.limite ? `<span class="fa-chip aviso" id="reloj"></span>` : ''}</div>
    <p class="om-enun">${esc(q.enunciado)}</p>
    ${q.img ? `<a class="om-img" href="${esc(q.img)}" target="_blank" rel="noopener" aria-label="${esc(t('Abrir la imagen a tamaño completo'))}"><img src="${esc(q.img)}" alt="${esc(t('Imagen de la pregunta {0} del MIR {1}', q.n, q.anio))}" loading="lazy"></a>` : ''}
    <div class="om-ops" role="radiogroup" aria-label="${esc(t('Opciones'))}">${q.opciones.map((o, k) => {
      const n = k + 1, cls = ver ? (n === q.correcta ? 'ok' : n === r ? 'ko' : '') : (n === r ? 'sel' : '');
      return `<button type="button" role="radio" aria-checked="${n === r}" class="om-op ${cls}" data-op="${n}" ${ver ? 'disabled' : ''}><b>${n}</b><span>${esc(o)}</span></button>`; }).join('')}</div>
    ${ver ? `<p class="help">${esc(origenDe(q))}${r ? '' : ' · ' + esc(t('en blanco'))}. ${esc(t('Respuesta correcta: {0}.', q.correcta))}</p>
      <div class="actions" style="margin-top:6px"><button class="btn btn-ghost btn-sm" type="button" data-porque="1">${ico('sparkles')} ${esc(t(S.explic[q.id] ? 'Ver la explicación' : '¿Por qué? (IA)'))}</button>${q.demo ? '' : `<a class="btn btn-ghost btn-sm" href="${esc(urlAviso(REPO, q))}" target="_blank" rel="noopener">${ico('github')} ${esc(t('Avisar de un error'))}</a>`}</div>
      <div class="om-exp" data-exp="${esc(q.id)}">${S.explic[q.id] ? expHTML(S.explic[q.id]) : ''}</div>` : ''}
    <div class="actions"><button class="btn btn-ghost btn-sm" type="button" data-mov="-1" ${i === 0 ? 'disabled' : ''}>${ico('left')} ${esc(t('Anterior'))}</button>
      ${!ver && r && modo === 'sim' ? `<button class="btn btn-ghost btn-sm" type="button" data-blanco="1">${esc(t('Dejar en blanco'))}</button>` : ''}
      <button class="btn btn-ghost btn-sm" type="button" data-mov="1" ${i === ids.length - 1 ? 'disabled' : ''}>${esc(t('Siguiente'))} ${ico('right')}</button>
      ${!ex.fin && modo === 'sim' ? `<button class="btn btn-primary btn-sm" type="button" data-fin="1">${esc(t('Terminar y corregir'))}</button>` : ''}</div>
    <div class="om-rejilla">${rejilla}</div></div>`;
  box.onclick = ev => {
    const b = ev.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.op) {
      ex.resp[q.id] = +b.dataset.op;
      if (inm) { anota(q, ex.resp[q.id] === q.correcta); if (Object.keys(ex.resp).length === ids.length) (modo === 'reto' ? cierraReto : () => { ex.fin = true; })(); }
      else if (i < ids.length - 1) ex.idx = i + 1;
      guarda(); return RENDER[step]();
    }
    if (b.dataset.porque) return explica(q, box);
    if (b.dataset.blanco) { delete ex.resp[q.id]; guarda(); return RENDER[step](); }
    if (b.dataset.mov) { ex.idx = Math.max(0, Math.min(ids.length - 1, i + +b.dataset.mov)); guarda(); return RENDER[step](); }
    if (b.dataset.ir) { ex.idx = +b.dataset.ir; guarda(); return RENDER[step](); }
    if (b.dataset.fin) { const bl = ids.length - Object.keys(ex.resp).length; if (bl && !b.dataset.ok) { b.dataset.ok = 1; b.textContent = t('Quedan {0} en blanco. Pulsa otra vez para corregir', bl); return; } terminaSim(); }
  };
}
function resumenHTML(qs, ex) {
  const p = puntua(qs, ex.resp), filas = Object.entries(p.porAsig).sort((a, b) => (b[1].ac + b[1].fa + b[1].bl) - (a[1].ac + a[1].fa + a[1].bl));
  return {p, html: `<div class="om-marcador"><div><b>${p.ac}</b><span>${esc(t('aciertos'))}</span></div><div><b>${p.fa}</b><span>${esc(t('fallos'))}</span></div><div><b>${p.bl}</b><span>${esc(t('en blanco'))}</span></div><div><b>${p.neta}</b><span>${esc(t('neta'))}</span></div><div><b>${p.puntos}</b><span>${esc(t('puntos (+3/−1)'))}</span></div></div>
    <div class="table-wrap"><table><thead><tr><th>${esc(t('Asignatura'))}</th><th>${esc(t('aciertos'))}</th><th>${esc(t('fallos'))}</th><th>${esc(t('en blanco'))}</th></tr></thead><tbody>${filas.map(([id, a]) => `<tr><td>${esc(nombreAsig(id))}</td><td>${a.ac}</td><td>${a.fa}</td><td>${a.bl}</td></tr>`).join('')}</tbody></table></div>`};
}

/* ── 2 · simulacro ── */
function opcionesAsig(sel, conProbable) {
  const ops = (conProbable ? [`<option value="probable">${esc(t('Probable MIR 2027 (todas, en su proporción)'))}</option>`] : []).concat(PRED.filas.map(f => `<option value="${esc(f.id)}">${esc(nombreAsig(f.id))} · ${Math.round(f.n)}</option>`));
  const v = sel.value; sel.innerHTML = ops.join(''); if ([...sel.options].some(o => o.value === v)) sel.value = v;
}
function pintaSim() {
  opcionesAsig($('simAsig'), true); $('simAsig').value = [...$('simAsig').options].some(o => o.value === S.asigSim) ? S.asigSim : 'probable';
  const disp = DATA.preguntas.filter(utilizable).length;
  $('simInfo').textContent = t('Hay {0} preguntas disponibles para simulacros.', nf(disp)) + (DATA.real ? '' : ' ' + t('En la demostración solo hay 12 preguntas de ejemplo.'));
  clearInterval(relojT);
  const ex = S.sim, box = $('simExamen');
  if (!ex) { box.innerHTML = ''; return; }
  const qs = ex.qs.map(preg).filter(Boolean);
  if (!qs.length) { S.sim = null; box.innerHTML = ''; return; }
  if (ex.fin) {
    const {p, html} = resumenHTML(qs, ex), url = enlaceSim(ex);
    const txt = ex.anio ? t('He hecho el MIR {0} completo en OráculoMIR y he sacado una neta de {1}. ¿Te atreves?', ex.anio, p.neta) : t('He sacado una neta de {0} en un simulacro probable del MIR 2027 de {1} preguntas en OráculoMIR. ¿Me superas con el mismo examen?', p.neta, qs.length);
    box.innerHTML = `<div class="card"><h3>${esc(ex.anio ? t('Resultado del MIR {0}', ex.anio) : t('Resultado del simulacro'))}</h3>${html}<p class="help">${esc(t('Los fallos ya están en tu repaso espaciado («Mi estudio»).'))}</p><div class="actions"><button class="btn btn-primary" type="button" id="btnCompSim">${ico('ext')} ${esc(t('Compartir y retar'))}</button><a class="btn btn-ghost" href="${esc(enlaceWA(txt + '\n' + url))}" target="_blank" rel="noopener">WhatsApp</a><button class="btn btn-ghost" type="button" id="btnOtraSim">${ico('refresh')} ${esc(t('Otro simulacro'))}</button></div></div><div id="simRev"></div>`;
    $('btnCompSim').onclick = () => comparte(txt, url); $('btnOtraSim').onclick = () => { S.sim = null; guarda(); pintaSim(); };
    pintaPregunta($('simRev'), ex, 'sim'); return;
  }
  if (ex.anio) box.insertAdjacentHTML('afterbegin', '');
  pintaPregunta(box, ex, 'sim');
  if (ex.anio) box.querySelector('.om-cab').insertAdjacentHTML('afterbegin', `<span class="fa-chip ok">${esc(t('MIR {0} completo', ex.anio))}</span>`);
  if (ex.limite) {
    const tic = () => { const quedan = Math.max(0, ex.limite - (Date.now() - ex.t0) / 1000), el = $('reloj'); if (el) el.textContent = '⏱ ' + mmss(quedan); if (quedan <= 0) { clearInterval(relojT); toast(t('Se acabó el tiempo')); terminaSim(); } };
    tic(); relojT = setInterval(tic, 1000);
  }
}
const enlaceSim = ex => ex.anio ? `${BASE_URL()}?anio=${ex.anio}` : `${BASE_URL()}?sim=${encodeURIComponent(ex.semilla)}&n=${ex.qs.length}&a=${encodeURIComponent(ex.asig)}`;
function creaSim(semilla, n, asig, tiempo) {
  const qs = simulacro(DATA.preguntas, PRED.filas, n, semilla, asig === 'probable' ? null : [asig]);
  if (!qs.length) { toast(t('No hay preguntas disponibles para esa asignatura')); return false; }
  S.sim = {semilla, asig, qs: qs.map(q => q.id), resp: {}, idx: 0, fin: false, t0: Date.now(), limite: tiempo === 'mir' ? Math.round(qs.length * 270 * 60 / 210) : 0};
  if (qs.length < n) toast(t('Solo hay {0} preguntas disponibles: el simulacro tiene {0}.', qs.length));
  guarda(); return true;
}
$('btnSim').onclick = () => { S.asigSim = $('simAsig').value; if (creaSim('s' + Date.now().toString(36), +$('simN').value, $('simAsig').value, $('simTiempo').value)) pintaSim(); };
$('btnSimLink').onclick = () => {
  const ex = S.sim || {semilla: 's' + Date.now().toString(36), asig: $('simAsig').value, qs: Array(+$('simN').value)};
  comparte(t('Te reto a este simulacro del MIR 2027 en OráculoMIR: mismas preguntas para los dos. ¿Quién saca más neta?'), enlaceSim(ex));
};
function terminaSim() {
  clearInterval(relojT);
  if (S.sim && !S.sim.fin) { S.sim.fin = true; S.sim.idx = 0; S.sim.qs.forEach(id => { const q = preg(id), r = S.sim.resp[id]; if (q && r) anota(q, r === q.correcta); }); guarda(); }
  pintaSim(); window.scrollTo({top: 0});
}
/* historial personal (repaso espaciado y plan): solo preguntas con respuesta oficial */
function anota(q, acierto) { if (q && q.correcta && !q.demo) S.hist[q.id] = registra(S.hist[q.id], acierto, fechaMadrid()); }

/* ── 4 · reto diario (mismas 10 preguntas para todos hoy) ── */
function retoDeHoy() {
  const f = fechaMadrid();
  if (!S.reto || S.reto.fecha !== f) { S.reto = {fecha: f, qs: simulacro(DATA.preguntas, PRED.filas, 10, 'reto-' + f).map(q => q.id), resp: {}, idx: 0, fin: false}; guarda(); }
  return S.reto;
}
function cierraReto() {
  const ex = S.reto; if (ex.fin) return; ex.fin = true;
  const ayer = fechaMadrid(new Date(Date.parse(ex.fecha + 'T12:00:00Z') - 864e5));
  S.racha = {ultima: ex.fecha, n: S.racha.ultima === ayer ? S.racha.n + 1 : S.racha.ultima === ex.fecha ? S.racha.n : 1};
  guarda(); toast(t('Reto completado. ¡Compártelo!'));
}
function pintaReto() {
  const ex = retoDeHoy(), qs = ex.qs.map(preg).filter(Boolean);
  $('retoNum').textContent = t('Reto n.º {0} · {1}', numReto(ex.fecha), new Date(ex.fecha + 'T12:00:00').toLocaleDateString(locale(), {weekday: 'long', day: 'numeric', month: 'long'}));
  if (!qs.length) { $('retoBox').innerHTML = `<p class="empty">${esc(t('No hay preguntas disponibles.'))}</p>`; return; }
  let cab = '';
  if (ex.fin) {
    const {p, html} = resumenHTML(qs, ex), marcas = qs.map(q => !ex.resp[q.id] ? 'bl' : ex.resp[q.id] === q.correcta ? 'ok' : 'ko');
    const txt = textoCompartirReto(numReto(ex.fecha), marcas, p, diasHastaMIR(), BASE_URL() + '?reto');
    cab = `<div class="card"><h3>${esc(t('Tu reto de hoy'))} ${S.racha.n ? `<span class="fa-chip ok">🔥 ${esc(t('racha de {0} días', S.racha.n))}</span>` : ''}</h3><pre class="om-share">${esc(txt)}</pre>${html}
      <div class="actions"><button class="btn btn-primary" type="button" id="btnCompReto">${ico('ext')} ${esc(t('Compartir resultado'))}</button><a class="btn btn-ghost" href="${esc(enlaceWA(txt))}" target="_blank" rel="noopener">WhatsApp</a></div><p class="help">${esc(t('Mañana habrá un reto nuevo. Repasa abajo cada pregunta con su respuesta oficial.'))}</p></div>`;
  }
  $('retoBox').innerHTML = cab + '<div id="retoQ"></div>';
  if ($('btnCompReto')) $('btnCompReto').onclick = () => comparte($('btnCompReto').closest('.card').querySelector('pre').textContent);
  pintaPregunta($('retoQ'), ex, 'reto');
}

/* ── «¿Por qué?»: la IA explica la respuesta OFICIAL; no la puede cambiar. Si cree que hoy sería discutible, lo avisa aparte ── */
const PROMPT_EXP = q => `Eres profesor de una academia de preparación del MIR. Explica a un estudiante esta pregunta OFICIAL del MIR ${q.anio}.
La respuesta correcta es la ${q.correcta}, según la plantilla definitiva del Ministerio de Sanidad: NO la discutas ni la cambies; explica el razonamiento que lleva a ella.${q.imagen ? '\nLa pregunta lleva una imagen que tú no ves: no describas la imagen ni inventes lo que muestra; explica a partir del texto y dilo si hace falta.' : ''}
Si con las guías clínicas actuales esa respuesta te parece desfasada o discutible, dilo SOLO en el campo "aviso" (si no, déjalo vacío).
Devuelve SOLO este JSON, en ${langIA()}:
{"clave":"la idea que hay que saber, en una frase","explicacion":"por qué la ${q.correcta} es la correcta, en 3-5 frases","opciones":["por qué falla o acierta la opción 1, en una frase", "…una por opción, en orden…"],"aviso":"","repaso":"qué tema repasar"}

${q.enunciado}
${q.opciones.map((o, k) => `${k + 1}. ${o}`).join('\n')}
Respuesta oficial: ${q.correcta}`;
function expHTML(x) {
  return `<div class="om-expbox"><p><b>${esc(t('Clave'))}:</b> ${esc(x.clave || '')}</p><p>${esc(x.explicacion || '')}</p>
    ${(x.opciones || []).length ? `<ol class="om-ol">${x.opciones.map(o => `<li>${esc(o)}</li>`).join('')}</ol>` : ''}
    ${x.aviso ? `<div class="aviso"><b>${esc(t('Ojo'))}:</b> ${esc(x.aviso)}</div>` : ''}
    ${x.repaso ? `<p class="help"><b>${esc(t('Repasa'))}:</b> ${esc(x.repaso)}</p>` : ''}
    <p class="help">${esc(t('Explicación generada por IA ({0}). La respuesta es la oficial; la explicación puede contener errores.', x.prov || ''))}</p></div>`;
}
async function explica(q, box) {
  const cont = box.querySelector(`[data-exp="${CSS.escape(q.id)}"]`); if (!cont) return;
  if (S.explic[q.id]) { cont.innerHTML = cont.innerHTML ? '' : expHTML(S.explic[q.id]); return; }
  if (!pideClave()) return;
  const pr = PROMPT_EXP(q);
  if (!(await pideEnvio(pr, 0, t('Se enviarán unos {0} caracteres a {1}: solo esta pregunta oficial y su respuesta. Una llamada por pregunta; la explicación se guarda para no pagarla dos veces.', nf(pr.length), PROV[getProv()].n)))) return;
  cont.innerHTML = '<p class="help"><span class="spin"></span> ' + esc(t('Pidiendo la explicación…')) + '</p>';
  try {
    const x = await llmJSON([{role: 'system', content: 'Eres un profesor de medicina riguroso. Respondes SOLO con JSON válido.'}, {role: 'user', content: pr}], {max: 1400});
    S.explic[q.id] = {clave: String(x.clave || ''), explicacion: String(x.explicacion || ''), opciones: (x.opciones || []).map(String).slice(0, q.opciones.length), aviso: String(x.aviso || ''), repaso: String(x.repaso || ''), prov: PROV[getProv()].n};
    await guardaYa(); cont.innerHTML = expHTML(S.explic[q.id]);
  } catch (e) { cont.innerHTML = `<p class="help">${esc(e.message)}</p>`; }
}

/* ── 5 · mi estudio: repaso espaciado de fallos + plan «dónde ganas más puntos» ── */
function pintaEstudio() {
  const hoy = fechaMadrid(), pend = pendientes(S.hist, hoy).filter(id => preg(id)), resp = Object.keys(S.hist).length;
  const pl = plan(S.hist, DATA.preguntas, PRED.filas), conDatos = pl.filter(f => f.datos), total = conDatos.reduce((a, f) => a + f.enJuego, 0);
  $('repasoBox').innerHTML = `<p>${esc(t('Preguntas en tu repaso: {0}. Para hoy: {1}.', enRepaso(S.hist), pend.length))}</p>
    <div class="actions"><button class="btn btn-primary" type="button" id="btnRepaso" ${pend.length ? '' : 'disabled'}>${ico('refresh')} ${esc(pend.length ? t('Repasar {0} ahora', Math.min(30, pend.length)) : t('Nada pendiente hoy'))}</button></div>
    <p class="help">${esc(t('Cada fallo vuelve a salir al día siguiente; si lo aciertas, a los 1, 3, 7, 21 y 60 días. Tras cinco aciertos seguidos se da por dominado.'))}</p>`;
  $('btnRepaso').onclick = () => { S.prac = {tipo: 'repaso', qs: pend.slice(0, 30), resp: {}, idx: 0, fin: false}; guarda(); pintaEstudio(); };
  $('planBox').innerHTML = !resp ? `<p class="empty">${esc(t('Todavía no has respondido preguntas. Haz el reto diario o un simulacro y aquí verás dónde estás perdiendo más puntos.'))}</p>` : `
    ${conDatos.length ? `<p>${esc(t('Con tu nivel actual, fallarías unas {0} de las 200 preguntas del MIR 2027 en las asignaturas con datos. Empieza por arriba: ahí es donde más puntos ganas.', Math.round(total)))}</p>` : ''}
    <div class="table-wrap"><table class="om-tabla"><thead><tr><th>${esc(t('Asignatura'))}</th><th>${esc(t('Esperadas 2027'))}</th><th>${esc(t('Respondidas'))}</th><th>${esc(t('Fallo'))}</th><th>${esc(t('Preguntas en juego'))}</th><th></th></tr></thead><tbody>
    ${pl.map(f => `<tr><td><b>${esc(nombreAsig(f.id))}</b></td><td>${Math.round(f.esperadas)}</td><td>${f.respondidas}</td><td>${f.tasa === null ? '–' : pct(f.tasa)}</td>
      <td>${f.datos ? `<b>${f.enJuego.toFixed(1)}</b>` : `<small class="muted">${esc(t('sin datos (mín. 8)'))}</small>`}</td>
      <td><button class="btn btn-ghost btn-sm" type="button" data-practica="${esc(f.id)}">${esc(t('Practicar'))}</button></td></tr>`).join('')}</tbody></table></div>
    <p class="help">${esc(t('«Preguntas en juego» = preguntas esperadas × tu porcentaje de fallo. Cada pregunta que pasa de fallo a acierto vale 4 puntos (+3 en vez de −1).'))}</p>`;
  const box = $('pracBox');
  if (!S.prac) { box.innerHTML = ''; return; }
  const p = S.prac;
  if (p.fin) {
    const ok = p.qs.filter(id => p.resp[id] === (preg(id) || {}).correcta).length;
    box.innerHTML = `<div class="card"><h3>${esc(t('Repaso terminado: {0} de {1}', ok, p.qs.length))}</h3><div class="actions"><button class="btn btn-ghost" type="button" id="btnFinPrac">${esc(t('Cerrar'))}</button></div></div><div id="pracQ"></div>`;
    $('btnFinPrac').onclick = () => { S.prac = null; guarda(); pintaEstudio(); };
    return pintaPregunta($('pracQ'), p, 'practica');
  }
  box.innerHTML = '<div id="pracQ"></div>'; pintaPregunta($('pracQ'), p, 'practica');
}

/* ── 6 · banco y exámenes: un MIR completo de un año, y buscador ── */
function pintaBanco() {
  const ys = [...new Set(DATA.preguntas.filter(utilizable).map(q => q.anio))].sort((a, b) => b - a);
  const sel = $('bancoAnio'), v = sel.value; sel.innerHTML = ys.map(y => `<option value="${y}">MIR ${y} · ${DATA.preguntas.filter(q => q.anio === y && utilizable(q)).length} ${esc(t('preguntas'))}</option>`).join(''); if (v) sel.value = v;
  const fa = $('busAsig'), va = fa.value; fa.innerHTML = `<option value="">${esc(t('Todas'))}</option>` + DATA.asignaturas.filter(a => a.id !== 'otras').map(a => `<option value="${a.id}">${esc(nombreAsig(a.id))}</option>`).join(''); fa.value = va;
  const fy = $('busAnio'), vy = fy.value; fy.innerHTML = `<option value="">${esc(t('Todos'))}</option>` + aniosDe(DATA.conteos).reverse().map(y => `<option>${y}</option>`).join(''); fy.value = vy;
  buscaPinta();
}
let ULTIMA_BUSQUEDA = [];
function buscaPinta() {
  const tx = $('busTexto').value, r = busca(DATA.preguntas, tx, {asig: $('busAsig').value, anio: $('busAnio').value, solo: true});
  ULTIMA_BUSQUEDA = r.map(q => q.id);
  $('busRes').innerHTML = `<p class="help">${esc(t('{0} preguntas oficiales con respuesta.', nf(r.length)))}</p>${r.slice(0, 25).map(q => `<div class="om-res"><small>${esc(origenDe(q))} · ${esc(nombreAsig(q.asig))}</small><br>${esc(q.enunciado.slice(0, 220))}${q.enunciado.length > 220 ? '…' : ''}</div>`).join('')}`;
  $('btnBusPrac').disabled = !r.length;
}
$('busTexto').oninput = () => { clearTimeout(buscaPinta.t); buscaPinta.t = setTimeout(buscaPinta, 250); };
$('busAsig').onchange = buscaPinta; $('busAnio').onchange = buscaPinta;
$('btnBusPrac').onclick = () => { const ids = baraja(ULTIMA_BUSQUEDA, rng('b' + Date.now())).slice(0, 40); if (!ids.length) return; S.prac = {tipo: 'banco', qs: ids, resp: {}, idx: 0, fin: false}; guarda(); go(5); };
function creaExamenAnio(y, tiempo) {
  const qs = DATA.preguntas.filter(q => q.anio === +y && utilizable(q)).sort((a, b) => a.n - b.n);
  if (!qs.length) return false;
  S.sim = {semilla: 'anio-' + y, asig: 'probable', anio: +y, qs: qs.map(q => q.id), resp: {}, idx: 0, fin: false, t0: Date.now(), limite: tiempo === 'mir' ? Math.round(qs.length * 270 * 60 / 210) : 0};
  guarda(); return true;
}
$('btnAnio').onclick = () => { if (creaExamenAnio($('bancoAnio').value, $('anioTiempo').value)) go(2); };

/* ── 7 · validación: qué se ha comprobado de cada examen ── */
function pintaValidacion() {
  const ex = (DATA.examenes || []).filter(e => e.ok).sort((a, b) => b.anio - a.anio);
  $('valTabla').innerHTML = !ex.length ? `<p class="empty">${esc(t('Disponible cuando estén cargados los exámenes oficiales.'))}</p>` : `<div class="table-wrap"><table class="om-tabla"><thead><tr><th>MIR</th><th>${esc(t('Origen'))}</th><th>${esc(t('Preguntas'))}</th><th>${esc(t('Con respuesta'))}</th><th>${esc(t('Anuladas'))}</th><th>${esc(t('Cotejo con lo publicado'))}</th></tr></thead><tbody>
    ${ex.map(e => `<tr><td><b>${e.anio}</b></td><td>${esc(t(e.fuente === 'tercero' ? 'Copia del documento oficial' : 'Portal del Ministerio'))}</td><td>${e.preguntas}</td><td>${e.con_respuesta || 0}</td><td>${e.anuladas || 0}</td>
      <td>${e.cotejo ? (e.cotejo.coincide ? `<span class="fa-chip ok">✓ ${esc(t('coincide'))}</span>` : `<span class="fa-chip aviso">${esc(t('difiere'))}</span>`) + ` <a href="${esc(e.cotejo.fuente)}" target="_blank" rel="noopener">${esc(t('fuente'))}</a>` : '–'}</td></tr>`).join('')}</tbody></table></div>`;
  const v = VAL;
  $('valPred').textContent = v ? t('Predicción probada a ciegas en los MIR {0}: se desvía de media {1} preguntas por asignatura (repetir el año anterior: {2}; media de todos los años: {3}) y acierta {4} de las 10 asignaturas con más peso.', v.porAnio.map(o => o.anio).join(', '), v.mae.toFixed(1), v.maeAnterior.toFixed(1), v.maeMedia.toFixed(1), v.aciertoTop10.toFixed(1)) : '';
}

/* ── 3 · generador con agentes ── */
function pintaGen() {
  opcionesAsig($('genAsig'), false);
  const pv = getProv(), otros = Object.keys(PROV).filter(p => p !== pv && getKey(p));
  $('genRev').innerHTML = `<option value="">${esc(t('Mismo proveedor ({0})', PROV[pv].n))}</option>` + otros.map(p => `<option value="${p}">${esc(PROV[p].n)}</option>`).join('');
  const st = S.genStats;
  const acept = S.gen.filter(g => g.estado === 'aceptada'), dud = S.gen.filter(g => g.estado === 'dudosa');
  $('genRes').innerHTML = !S.gen.length && !st ? '' : `
    ${st ? `<div class="card"><h3>${esc(t('Última tanda'))}</h3><p>${esc(t('Redactadas: {0} · aceptadas por los tres agentes: {1} · dudosas: {2} · descartadas: {3}.', st.total, st.aceptadas, st.dudosas, st.descartadas))}</p>${st.motivos.length ? `<ul class="fa-ul">${st.motivos.map(m => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}${ctxHTML(st.contexto)}</div>` : ''}
    <div class="card"><h3>${esc(t('Preguntas aceptadas ({0})', acept.length))}</h3>${acept.length ? acept.map(cartaGen).join('') : `<p class="empty">${esc(t('Todavía ninguna.'))}</p>`}
      <div class="actions"><button class="btn btn-word" id="btnGenWord" type="button">${ico('doc')} Word</button><button class="btn btn-ghost" id="btnGenCsv" type="button">CSV</button><button class="btn btn-ghost" id="btnGenGift" type="button">Moodle (GIFT)</button><button class="btn btn-ghost" id="btnGenBorra" type="button">${ico('trash')} ${esc(t('Borrar'))}</button></div></div>
    ${dud.length ? `<div class="card"><h3>${esc(t('Dudosas: un resolutor no estuvo de acuerdo ({0})', dud.length))}</h3><p class="help">${esc(t('No las uses para estudiar sin comprobarlas en tu manual.'))}</p>${dud.map(cartaGen).join('')}</div>` : ''}`;
  if ($('btnGenWord')) { $('btnGenWord').onclick = genWord; $('btnGenCsv').onclick = genCsv; $('btnGenGift').onclick = () => { const a = S.gen.filter(g => g.estado === 'aceptada'); if (!a.length) return toast(t('No hay preguntas aceptadas')); dl('oraculomir_preguntas.gift.txt', aGIFT(a), 'text/plain;charset=utf-8'); }; $('btnGenBorra').onclick = () => { S.gen = []; S.genStats = null; guarda(); pintaGen(); }; }
}
function ctxHTML(c) {
  if (!c || !c.total) return '';
  return `<details class="om-gen"><summary><b>${esc(t('Contexto de años anteriores que recibió el redactor'))}</b> · ${esc(t('{0} preguntas oficiales de {1}', nf(c.total), nombreAsig(c.asig)))}</summary>
    <p><b>${esc(t('Temas que más se repiten'))}:</b> ${c.frecuentes.map(f => esc(`${f.tema} (${f.n} · ${f.ultimo})`)).join(', ') || '—'}</p>
    <p><b>${esc(t('Llevan 4 años o más sin salir'))}:</b> ${c.olvidados.map(f => esc(`${f.tema} (${f.ultimo})`)).join(', ') || esc(t('ninguno'))}</p>
    <p class="help">${esc(t('Recuento automático por palabras clave, más {0} preguntas oficiales recientes como ejemplo de estilo. Que un tema lleve años sin salir no significa que vaya a salir.', (c.ejemplos || []).length))}</p></details>`;
}
function cartaGen(g) {
  return `<details class="om-gen"><summary><span class="fa-chip ${g.estado === 'aceptada' ? 'ok' : 'aviso'}">${esc(t(g.estado === 'aceptada' ? '3/3 de acuerdo' : '2/3 de acuerdo'))}</span> <b>${esc(nombreAsig(g.asig))}</b> · ${esc(g.tema || '')}<br>${esc(g.enunciado)}</summary>
    <ol class="om-ol">${g.opciones.map((o, k) => `<li class="${k + 1 === g.correcta ? 'om-ok' : ''}">${esc(o)}</li>`).join('')}</ol>
    <p><b>${esc(t('Explicación'))}:</b> ${esc(g.explicacion || '')}</p><p class="help">${esc(t('Referencia que cita el redactor (compruébala)'))}: ${esc(g.referencia || t('no indicada'))}</p>
    <p class="help">${g.resolutores.map((r, k) => esc(t('Resolutor {0} ({1}): opción {2}, seguridad {3} %. {4}', k + 1, r.prov, r.opcion || '–', r.seguridad ?? '–', r.motivo || ''))).join('<br>')}</p></details>`;
}

const PROMPT_GEN = (asig, n, ejemplos, ctx) => `Eres un redactor experto de preguntas del examen MIR (España). Redacta ${n} preguntas NUEVAS de «${asig}», de tipo test con 4 opciones y una sola respuesta correcta, con el estilo y la dificultad del MIR reciente (casos clínicos breves cuando proceda).
Reglas:
- Solo contenidos con consenso firme en guías clínicas vigentes y manuales de referencia. Evita temas controvertidos, recomendaciones que hayan cambiado hace poco y cifras dudosas.
- Una sola opción claramente correcta; las otras tres, plausibles pero inequívocamente incorrectas.
- Nada de «todas las anteriores» ni «ninguna de las anteriores». Sin imágenes.
- No copies ni parafrasees las preguntas de ejemplo: solo enseñan el estilo.
- En "referencia" indica la guía o el manual en que te apoyas, sin inventar DOI, páginas ni años.
- Reparte la posición de la respuesta correcta entre 1, 2, 3 y 4.
Devuelve SOLO este JSON:
{"preguntas":[{"tema":"tema concreto","enunciado":"…","opciones":["…","…","…","…"],"correcta":1,"explicacion":"por qué es la correcta y por qué fallan las demás, en 2-4 frases","referencia":"…"}]}
El enunciado y las opciones, siempre en español. La explicación y el tema, en ${langIA()}.

${ctx && ctx.total ? `CONTEXTO DE AÑOS ANTERIORES (${ctx.total} preguntas oficiales de «${asig}» en los MIR ${ctx.desde}-${ctx.hasta}; recuento automático por palabras clave):
- Temas que más se repiten: ${ctx.frecuentes.map(f => `${f.tema} (${f.n} preguntas; última vez en ${f.ultimo})`).join('; ') || '—'}.
- Temas habituales que llevan 4 años o más sin salir: ${ctx.olvidados.map(f => `${f.tema} (última vez en ${f.ultimo})`).join('; ') || 'ninguno'}.
Usa este contexto para elegir temas con peso en el MIR, sobre todo los que más se repiten y los que llevan tiempo sin salir, pero con un enfoque distinto al de las preguntas ya puestas. No repitas ni reformules ninguna pregunta oficial.

` : ''}PREGUNTAS OFICIALES RECIENTES DE EJEMPLO (solo para el estilo y el nivel; la respuesta correcta va marcada con *; no copiar):
${ejemplos.map((q, i) => `${i + 1}. [MIR ${q.anio}] ${q.enunciado}\n${q.opciones.map((o, k) => `   ${k + 1 === q.correcta ? '*' : ' '}${k + 1}. ${o}`).join('\n')}`).join('\n\n') || '(sin ejemplos)'}`;
const ROLES = ['un internista con veinte años de experiencia clínica', 'el miembro de la comisión calificadora del MIR que revisa las impugnaciones'];
const PROMPT_RES = (k, items) => `Eres ${ROLES[k]}. Resuelve estas preguntas tipo MIR. Para cada una elige la ÚNICA opción correcta según las guías clínicas vigentes. Si ninguna opción es claramente correcta o hay más de una correcta, responde 0 y explica por qué.
Devuelve SOLO este JSON: {"respuestas":[{"id":"g1","opcion":1,"seguridad":90,"motivo":"una frase, en ${langIA()}"}]}

${items.map(x => `id: ${x.id}\n${x.enunciado}\n${x.opciones.map((o, j) => `${j + 1}. ${o}`).join('\n')}`).join('\n\n')}`;
async function conProveedor(pv, fn) {
  if (!pv || pv === getProv()) return fn();
  const prev = localStorage.getItem(APP + '_prov'); localStorage.setItem(APP + '_prov', pv);
  try { return await fn(); } finally { if (prev === null) localStorage.removeItem(APP + '_prov'); else localStorage.setItem(APP + '_prov', prev); }
}
let busy = false;
$('btnGen').onclick = async () => {
  if (busy) return; if (!pideClave()) return;
  const asig = $('genAsig').value, n = +$('genN').value, rev = $('genRev').value || '', pv1 = getProv();
  const r = rng('gen' + Date.now()), banco = DATA.preguntas.filter(q => q.asig === asig), todo = DATA.preguntas;
  const ejemplos = ejemplosRecientes(DATA.preguntas, asig, 6, r), ys = aniosDe(DATA.conteos);
  const ctx = {...temasRecurrentes(DATA.preguntas, asig, (DATA.kws || {})[asig], ys.at(-1)), desde: ys[0], hasta: ys.at(-1)};
  const prompt = PROMPT_GEN(nombreAsig(asig), n, ejemplos, ctx);
  if (!(await pideEnvio(prompt, 0))) return;
  busy = true; $('btnGen').disabled = true; const st = $('genEstado'), motivos = [];
  const paso = m => { st.innerHTML = '<span class="spin"></span> ' + esc(m); };
  try {
    paso(t('Agente 1 de 3: redactando {0} preguntas…', n));
    const raw = await llmJSON([{role: 'system', content: 'Eres un redactor riguroso de preguntas de examen médico. Respondes SOLO con JSON válido.'}, {role: 'user', content: prompt}], {max: 900 * n + 800});
    const cands = [];
    (raw.preguntas || []).slice(0, n).forEach((g, i) => {
      const x = {id: 'g' + (i + 1), asig, tema: String(g.tema || ''), enunciado: String(g.enunciado || '').trim(), opciones: (g.opciones || []).map(o => String(o).trim()), correcta: Number(g.correcta), explicacion: String(g.explicacion || ''), referencia: String(g.referencia || '')};
      const f = revisaFormato(x); if (f.length) return motivos.push(t('Pregunta {0} descartada por el código: {1}.', i + 1, f.map(m => t(m)).join(', ')));
      const pb = parecidoBanco(x, todo); if (pb) return motivos.push(t('Pregunta {0} descartada: se parece demasiado a la oficial {1} ({2}).', i + 1, pb.id, pct(pb.s)));
      cands.push(x);
    });
    const res = [];
    for (const k of [0, 1]) {
      const pv = k === 1 && rev ? rev : pv1;
      paso(t('Agente {0} de 3: resolviendo a ciegas con {1}…', k + 2, PROV[pv].n));
      if (!cands.length) break;
      const perm = cands.map(c => permuta(c, rng(c.id + k + Date.now())));
      const out = await conProveedor(pv, () => llmJSON([{role: 'system', content: 'Eres un médico especialista que resuelve preguntas tipo MIR. Respondes SOLO con JSON válido.'}, {role: 'user', content: PROMPT_RES(k, cands.map((c, j) => ({id: c.id, enunciado: c.enunciado, opciones: perm[j].opciones})))}], {max: 220 * cands.length + 400}));
      const mapa = Object.fromEntries((out.respuestas || []).map(a => [String(a.id), a]));
      res.push(cands.map((c, j) => { const a = mapa[c.id] || {}, o = Number(a.opcion); return {prov: PROV[pv].n, opcion: o >= 1 && o <= 4 ? perm[j].aOriginal(o) : 0, seguridad: a.seguridad, motivo: String(a.motivo || '')}; }));
    }
    let ac = 0, du = 0, de = motivos.length + Math.max(0, n - (raw.preguntas || []).slice(0, n).length);
    cands.forEach((c, j) => {
      c.resolutores = res.map(rr => rr[j]); c.estado = veredicto(c.correcta, c.resolutores.map(x => x.opcion));
      if (c.estado === 'descartada') { de++; motivos.push(t('Pregunta «{0}…» descartada: ninguno de los dos resolutores eligió la respuesta del redactor.', c.enunciado.slice(0, 50))); return; }
      c.id = uid('gen-'); c.fecha = new Date().toISOString(); S.gen.push(c); c.estado === 'aceptada' ? ac++ : du++;
    });
    S.genStats = {total: n, aceptadas: ac, dudosas: du, descartadas: de, motivos, contexto: {asig, total: ctx.total, frecuentes: ctx.frecuentes.slice(0, 8), olvidados: ctx.olvidados, ejemplos: ejemplos.map(q => q.id)}};
    await guardaYa(); st.textContent = t('Hecho: {0} aceptadas de {1}.', ac, n); pintaGen();
  } catch (e) { st.textContent = e.message; toast(e.message, 8000); }
  finally { busy = false; $('btnGen').disabled = false; }
};
function genMd() { return S.gen.filter(g => g.estado === 'aceptada').map((g, i) => `## ${i + 1}. ${nombreAsig(g.asig)} · ${g.tema}\n${g.enunciado}\n\n${g.opciones.map((o, k) => `${k + 1}. ${o}`).join('\n')}\n\n**${t('Respuesta')}:** ${g.correcta}. ${g.explicacion}\n\n*${t('Referencia que cita el redactor (compruébala)')}: ${g.referencia}*`).join('\n\n'); }
async function genWord() { if (!S.gen.some(g => g.estado === 'aceptada')) return toast(t('No hay preguntas aceptadas')); try { dl('oraculomir_preguntas.docx', await wordDeMarkdown(genMd(), {titulo: APP_NAME, subtitulo: t('Preguntas generadas y verificadas por tres agentes de IA'), pie: t('Generado con {0}. Preguntas no oficiales: compruébalas en tu manual.', APP_NAME)})); } catch (e) { toast(e.message, 7000); } }
function genCsv() { const a = S.gen.filter(g => g.estado === 'aceptada'); if (!a.length) return toast(t('No hay preguntas aceptadas')); dl('oraculomir_preguntas.csv', csvDe([t('asignatura'), t('tema'), t('enunciado'), '1', '2', '3', '4', t('correcta'), t('explicacion'), t('referencia')], a.map(g => [nombreAsig(g.asig), g.tema, g.enunciado, ...g.opciones, g.correcta, g.explicacion, g.referencia])), 'text/csv;charset=utf-8'); }

/* aviso previo al envío (una vez por sesión) */
let envioRes = null;
function pideEnvio(textoEnviado, masks, mensaje) {
  if (ENVIO_OK) return Promise.resolve(true);
  $('envioInfo').innerHTML = `<p class="sub" style="margin-top:0">${esc(mensaje || t('Se enviarán unos {0} caracteres a {1}. No incluye datos tuyos: solo la asignatura y preguntas oficiales de ejemplo. Son tres llamadas (redactor y dos resolutores).', nf(textoEnviado.length), PROV[getProv()].n))}</p><p class="help">${esc(t('Muestra del envío:'))}</p>`;
  $('envioTxt').textContent = textoEnviado.slice(0, 3000) + (textoEnviado.length > 3000 ? '\n…' : '');
  $('envioOk').checked = false; $('envioSi').disabled = true; $('mEnvio').classList.add('on');
  return new Promise(r => { envioRes = r; });
}
function cierraEnvio(v) { $('mEnvio').classList.remove('on'); if (envioRes) { const r = envioRes; envioRes = null; if (v) ENVIO_OK = true; r(v); } }
_cierres.mEnvio = () => cierraEnvio(false);
$('envioOk').onchange = () => { $('envioSi').disabled = !$('envioOk').checked; };
$('envioSi').onclick = () => cierraEnvio(true); $('envioNo').onclick = () => cierraEnvio(false);

/* ── arranque: datos → predicción → enlaces compartidos (?reto, ?sim=…) ── */
(async () => {
  const p = await cargaEstado(); if (p) S = {...S, ...p};
  await cargaDatos(); calcula(); iniciaUI();
  const q = new URLSearchParams(location.search);
  if (q.has('reto')) return go(4);
  if (q.get('anio') && creaExamenAnio(q.get('anio'), 'mir')) return go(2);
  if (q.get('sim')) { const a = q.get('a') || 'probable'; S.asigSim = a; if (creaSim(q.get('sim'), Math.min(200, Math.max(1, +q.get('n') || 25)), a, 'mir')) toast(t('Mismo examen que quien te ha retado. ¡Suerte!')); return go(2); }
  go(0);
})();
