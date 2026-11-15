/* ══ Datos: el banco oficial (data/mir.json, lo genera la GitHub Action) o, si aún no existe, un DEMO marcado como ficticio ══ */
const ASIGS_BASE = [
  ['cardio', 'Cardiología'], ['neumo', 'Neumología'], ['digestivo', 'Digestivo y Cirugía general'], ['nefro', 'Nefrología'], ['endocrino', 'Endocrinología y Nutrición'],
  ['hemato', 'Hematología'], ['infecciosas', 'Enfermedades infecciosas y Microbiología'], ['reuma', 'Reumatología'], ['neuro', 'Neurología y Neurocirugía'], ['onco', 'Oncología y Cuidados paliativos'],
  ['derma', 'Dermatología'], ['oftalmo', 'Oftalmología'], ['orl', 'Otorrinolaringología'], ['gine', 'Ginecología y Obstetricia'], ['pedia', 'Pediatría'], ['psiq', 'Psiquiatría'],
  ['trauma', 'Traumatología y Cirugía ortopédica'], ['uro', 'Urología'], ['anestesia', 'Anestesiología, Urgencias y Cuidados intensivos'], ['preventiva', 'Medicina preventiva y Salud pública'],
  ['estadistica', 'Estadística y Epidemiología'], ['farmaco', 'Farmacología'], ['inmuno', 'Inmunología y Alergología'], ['genetica', 'Genética'], ['geriatria', 'Geriatría'],
  ['bioetica', 'Bioética y Medicina legal'], ['basicas', 'Anatomía, Fisiología y Bioquímica'], ['patologia', 'Anatomía patológica'], ['radio', 'Radiología y Medicina nuclear'], ['otras', 'Sin clasificar']
].map(([id, nombre]) => ({id, nombre}));

/* DEMO · preguntas ESCRITAS PARA LA DEMOSTRACIÓN (no son preguntas oficiales del MIR); sirven para probar la app sin datos */
const DEMO_PREG = [
  ['cardio', 'Varón de 58 años con dolor torácico opresivo de 2 horas de evolución y elevación del segmento ST en derivaciones inferiores. Llega a un hospital con sala de hemodinámica disponible. ¿Cuál es la estrategia de reperfusión de elección?', ['Angioplastia primaria.', 'Fibrinólisis y alta a las 24 horas.', 'Tratamiento médico y ergometría diferida.', 'Cirugía de revascularización urgente.'], 1],
  ['pedia', 'Lactante de 4 meses con rinorrea, tos y sibilancias desde hace 2 días, saturación del 96 % y buena tolerancia oral. Se diagnostica de bronquiolitis aguda leve. ¿Cuál es el tratamiento indicado?', ['Corticoides orales durante 5 días.', 'Medidas de soporte: lavados nasales, hidratación y vigilancia.', 'Amoxicilina oral.', 'Salbutamol nebulizado pautado cada 4 horas.'], 2],
  ['estadistica', 'En la evaluación de una prueba diagnóstica, ¿cómo se define la sensibilidad?', ['Proporción de sanos con resultado negativo.', 'Proporción de positivos que están realmente enfermos.', 'Proporción de enfermos con resultado positivo.', 'Proporción de negativos que están realmente sanos.'], 3],
  ['gine', 'Gestante de 34 semanas con preeclampsia con criterios de gravedad. Además del control de la tensión arterial, ¿qué fármaco se administra para prevenir la eclampsia?', ['Sulfato de magnesio.', 'Furosemida.', 'Diazepam en perfusión continua.', 'Ácido acetilsalicílico a dosis altas.'], 1],
  ['endocrino', 'Paciente con cetoacidosis diabética en tratamiento con sueroterapia. Antes y durante la perfusión de insulina, ¿qué ion debe vigilarse estrechamente porque la insulina lo desplaza al interior de la célula?', ['Sodio.', 'Calcio.', 'Potasio.', 'Cloro.'], 3],
  ['neumo', 'Politraumatizado con disnea intensa, hipotensión, ingurgitación yugular, ausencia de murmullo vesicular en el hemitórax derecho y desviación traqueal. ¿Cuál es la actuación inmediata?', ['Radiografía de tórax antes de cualquier maniobra.', 'Descompresión torácica urgente con aguja o toracostomía.', 'Intubación orotraqueal y ventilación con presión positiva sin más.', 'Tomografía computarizada torácica urgente.'], 2],
  ['hemato', 'Mujer de 35 años con astenia y anemia microcítica. ¿Qué parámetro de laboratorio es el más útil para confirmar una ferropenia en ausencia de inflamación?', ['Ferritina sérica baja.', 'Hierro sérico elevado.', 'Transferrina baja.', 'Reticulocitos elevados.'], 1],
  ['neuro', 'Paciente con ictus isquémico agudo sin contraindicaciones. ¿Hasta cuántas horas desde el inicio de los síntomas se acepta de forma general la trombólisis intravenosa con alteplasa en la ventana estándar?', ['1 hora.', '2 horas.', '4,5 horas.', '24 horas.'], 3],
  ['psiq', 'Paciente con trastorno bipolar estable con litio. ¿Cuál de estos fármacos tiende a elevar la litemia y obliga a vigilar los niveles?', ['Hidroclorotiazida.', 'Paracetamol.', 'Omeprazol.', 'Levotiroxina.'], 1],
  ['nefro', 'Paciente con potasio sérico de 7,2 mEq/L y ondas T picudas con ensanchamiento del QRS en el electrocardiograma. ¿Cuál es la primera medida para proteger el miocardio?', ['Gluconato cálcico intravenoso.', 'Resinas de intercambio por vía oral.', 'Furosemida intravenosa.', 'Restricción de potasio en la dieta.'], 1],
  ['derma', 'En el melanoma cutáneo localizado, sin afectación ganglionar, ¿cuál es el factor pronóstico más importante?', ['El diámetro de la lesión.', 'El espesor tumoral o índice de Breslow.', 'El color de la lesión.', 'La edad de aparición del nevus previo.'], 2],
  ['bioetica', 'Según la legislación española de autonomía del paciente, ¿qué documento permite a una persona dejar por escrito los cuidados que desea recibir si en el futuro no puede expresar su voluntad?', ['El parte de lesiones.', 'El documento de instrucciones previas.', 'El certificado médico oficial.', 'La hoja de reclamaciones.'], 2]
].map(([asig, enunciado, opciones, correcta], i) => ({id: 'demo-' + (i + 1), anio: 0, n: i + 1, asig, enunciado, opciones, correcta, anulada: false, imagen: false, demo: true}));

/* DEMO · recuentos FICTICIOS de 2015 a 2026 (no son datos reales): solo para ver la predicción funcionando */
function demoConteos() {
  const base = {digestivo: 18, cardio: 14, infecciosas: 14, gine: 14, pedia: 13, neuro: 12, estadistica: 12, neumo: 10, hemato: 9, endocrino: 9, psiq: 9, nefro: 7, reuma: 7, trauma: 7, preventiva: 6, derma: 6, uro: 5, anestesia: 5, oftalmo: 4, orl: 4, onco: 4, farmaco: 4, bioetica: 4, basicas: 4, inmuno: 3, genetica: 3, geriatria: 3, patologia: 2, radio: 2};
  const r = rng('demo-oraculomir'), c = {};
  for (let y = 2015; y <= 2026; y++) {
    c[y] = {};
    for (const k in base) { const tr = k === 'geriatria' || k === 'genetica' ? (y - 2015) * 0.35 : k === 'trauma' ? -(y - 2015) * 0.25 : 0; c[y][k] = Math.max(0, Math.round(base[k] * 1.05 + tr + (r() - 0.5) * 5)); }
  }
  return c;
}

let DATA = {real: false, asignaturas: ASIGS_BASE, preguntas: DEMO_PREG, conteos: demoConteos(), examenes: [], generado: null};
const nombreAsig = id => t((DATA.asignaturas.find(a => a.id === id) || {nombre: id}).nombre);
/* Carga data/mir.json (mismo origen, en GitHub Pages). Abierta como fichero local o sin datos todavía → DEMO */
async function cargaDatos() {
  try {
    const r = await fetch('data/mir.json', {cache: 'no-cache'});
    if (!r.ok) throw 0;
    const j = await r.json();
    const ps = (j.preguntas || []).filter(q => q && q.enunciado && q.anio);
    if (ps.length < 100) throw 0;
    DATA = {real: true, asignaturas: j.asignaturas || ASIGS_BASE, preguntas: ps, conteos: conteos(ps), examenes: j.examenes || [], generado: j.generado || null, clasificacion: j.clasificacion || ''};
  } catch { /* se queda el DEMO */ }
  return DATA;
}
