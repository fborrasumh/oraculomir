# OráculoMIR

Qué asignaturas caerán en el MIR 2027 (sábado 23 de enero de 2027), estimado a partir de los exámenes MIR oficiales, con simulacros de preguntas oficiales y un generador de preguntas nuevas revisadas por varios agentes de IA. Aplicación web de un solo fichero.

**Usar la app:** https://fborrasumh.github.io/oraculomir/
**Idiomas:** español (por defecto), inglés y portugués. Se cambia en el selector de la barra superior o con `?lang=en` / `?lang=pt` en la URL. Las preguntas del MIR se muestran siempre en español.

## Qué hace

1. **Predicción por asignatura.** Cuenta cuántas preguntas ha tenido cada asignatura en cada MIR, las convierte en proporción del examen y estima cuántas tendrá en 2027 sobre 200, con un intervalo del 80 %.
   - Método: media ponderada en la que los años recientes pesan más (semivida de 4 años), más la mitad de la tendencia lineal.
2. **Cuánto fiarse.** Se hace una validación a ciegas en los tres últimos MIR: cada uno se predice solo con los años anteriores y se compara con lo que salió.
   - El método se mide frente a dos referencias sencillas: repetir el año anterior y la media de todos los años.
   - Si no las mejora, la app lo dice y recomienda usar el resultado solo como orden de prioridad.
3. **Simulacro probable.** Usa preguntas oficiales en la proporción que predice el modelo, cada una con la respuesta de la plantilla definitiva.
   - Puntúa como el MIR: +3 por acierto, −1 por fallo, 0 en blanco, y calcula la neta.
   - Reloj opcional al ritmo del MIR: 270 minutos para 210 preguntas.
   - Gratis y sin clave.
4. **Reto diario.** Diez preguntas oficiales, las mismas para todo el mundo cada día.
   - Racha de días seguidos.
   - Resultado en emojis para compartir sin desvelar las respuestas.
5. **Generador con agentes**, con la clave de IA de cada persona:
   - **Agente 1** redacta preguntas nuevas de la asignatura elegida. Recibe tres preguntas oficiales solo como muestra de estilo.
   - **Agentes 2 y 3** resuelven a ciegas, cada uno con las opciones barajadas de otra forma. El segundo puede usar otro proveedor de IA.
   - **El código** comprueba el formato (4 opciones distintas, clave entre 1 y 4, sin «todas/ninguna de las anteriores») y descarta las preguntas que se parecen demasiado a una oficial.
   - Una pregunta solo se **acepta** si los dos resolutores eligen la misma respuesta que el redactor. Si discrepa uno queda **dudosa**; si discrepan los dos se **descarta**.
   - Las preguntas aceptadas se exportan a Word, CSV y Moodle (GIFT).

6. **Examen MIR 2027 completo con IA** (paso 4): 25, 50, 100 o 200 preguntas nuevas, repartidas por asignatura según la predicción.
   - Cada tanda pasa por redactor + 2 resolutores a ciegas + comprobaciones del código, y no repite preguntas dentro del mismo examen.
   - Se puede continuar si se corta. Lo que los agentes descartan se completa, si se quiere, con preguntas oficiales marcadas.
   - Se hace como simulacro con reloj y puntuación MIR, y se descarga en Word o Moodle (GIFT).
   - 200 preguntas cuestan unas 90 llamadas con la clave de cada persona; la app lo estima antes de empezar.
7. **«¿Por qué?» en cada pregunta corregida**, con la clave de IA de cada persona. La IA explica la respuesta **oficial** y no puede cambiarla; si con las guías actuales le parece discutible, lo dice aparte. La explicación se guarda para no pagarla dos veces.
8. **Mi estudio:**
   - **Repaso espaciado de fallos:** cada fallo vuelve a salir al día siguiente y, si se acierta, a los 1, 3, 7, 21 y 60 días.
   - **Plan «dónde ganas más puntos»:** preguntas esperadas en 2027 × tu porcentaje de fallo en cada asignatura.
9. **Banco y exámenes:** el MIR de un año concreto completo (también con enlace `?anio=2019`) y un buscador por palabras, asignatura y año.
10. **Imágenes:** 154 preguntas con su imagen (2012, 2013, 2022, 2023, 2024 y 2026). Cada imagen se asigna por su rótulo, sea de texto o leído dentro de la imagen; los años cuyo orden no se puede confirmar quedan sin imágenes.
11. **Avisar de un error** desde cada pregunta: abre una incidencia de GitHub ya rellenada.
12. **Instalable y sin conexión** (manifest + service worker): una vez abierta, funciona sin internet.
13. **Página «Cómo se valida»**, con el cotejo de cada examen frente a lo publicado.

## Lo que no hace (límites reales)

- **No predice preguntas concretas**, solo cuántas tendrá cada asignatura. El simulacro entrena el formato y el ritmo; no adivina el examen.
- **La clasificación por asignatura es automática**, por palabras clave (`data/asignaturas.json`), y se equivoca en algunas preguntas, sobre todo en las que tocan dos asignaturas. La portada muestra la parte sin clasificar.
- **Que tres agentes coincidan no garantiza que una pregunta generada sea correcta.** Reduce los errores, pero varios modelos pueden equivocarse a la vez. Las únicas respuestas con respaldo oficial son las de las preguntas oficiales.
- **Las preguntas con imagen y las anuladas no entran en los simulacros**: no se extraen los cuadernillos de imágenes.
- Herramienta independiente, sin relación con el Ministerio de Sanidad.

## Datos que hay ahora

| Años | Origen | Respuestas |
|---|---|---|
| 2022-2026 | Portal FSE del Ministerio (API de su web: cuaderno versión 0 y hoja de respuestas definitiva) | Oficiales |
| 2016-2021 | Copias de terceros de los PDF oficiales (examenesmir.com, consalud.es) | Plantilla definitiva copiada |
| 2009, 2011-2013, 2015 | Cuadernos e impresiones de la consulta oficial de respuestas correctas del Ministerio, guardados en una carpeta pública de Google Drive | Plantilla definitiva copiada |
| 2014 | Cuaderno + respuestas cruzadas por texto con una transcripción de terceros (oposicionesgratis.com) | Validadas con las 8 anuladas y los 2 cambios publicados; 4 preguntas dudosas quedan sin respuesta |
| 2010 | Cuaderno sí; la única transcripción de la plantilla choca con lo publicado (da respuesta a la 52, anulada) | Sin respuestas: cuenta para la predicción, no entra en simulacros |
| 2007-2008 | No encontrados en ninguna fuente accesible | — |

Todo lo que no viene del portal se marca en la app como «tomada de una copia del cuaderno oficial».

Comprobaciones antes de aceptar un año copiado:
- El año del examen se toma del propio cuaderno: «PRUEBAS SELECTIVAS 2012» es el MIR de enero de 2013.
- La plantilla debe ser del mismo año.
- No se puede usar el mismo fichero para dos años.
- No se admiten más de 15 anuladas.
- La plantilla debe cubrir al menos el 90 % de las preguntas.
- No se leen plantillas escaneadas.

Las anuladas coinciden con lo publicado en prensa en los años contrastados (2016-2021 y 2023).

En total hay 4.027 preguntas de 18 exámenes; 3.358 se pueden usar en simulacros. El informe (`data/informe.md`) coteja automáticamente las anuladas y los cambios de respuesta publicados de 9 años (`data/verificacion.json`). La asignatura de cada pregunta la asigna `gpt-6-luna` (`scripts/mir_clasifica_ia.py`, secreto `OPENAI_API_KEY`); si no hay clave, se usan palabras clave.

## Datos: cómo se traen los exámenes al repositorio

El flujo **Actions → «Datos MIR» → Run workflow** (`.github/workflows/datos-mir.yml`) hace estos pasos:

1. `scripts/mir_fetch.py --api` abre el portal FSE con Chromium para obtener su token anónimo y pide a su API, convocatoria a convocatoria, el cuaderno de la versión 0 y la hoja de respuestas definitiva.
2. `scripts/mir_externos.py` completa los años que el portal ya no ofrece con las URL de `data/fuentes_externas.json`. Comprueba que cada cuaderno sea un PDF de Medicina con las preguntas esperadas y que la plantilla cubra al menos el 90 % de ellas.
3. `scripts/mir_datos.py` extrae el texto (también de páginas a dos columnas), separa preguntas y opciones (4 o 5, según el año), lee la respuesta oficial, clasifica cada pregunta y escribe `data/mir.json` (lo que lee la app) y `data/informe.md` (año a año: preguntas, respuestas leídas, anuladas y huecos).

El portal es una aplicación web sin lista pública de enlaces, así que el descubrimiento es heurístico. Si algún año falla:

- Mira las capturas del portal en el artefacto `portal-debug` de la ejecución.
- Escribe a mano la URL en `data/fuentes.json` con `"origen": "manual"`.
- Relanza el flujo con el paso `descargar`.

**Revisa a mano al menos 20 preguntas por año contra el PDF antes de dar los datos por buenos.** Mientras no exista `data/mir.json`, la app funciona en **modo demostración**: recuentos ficticios y 12 preguntas escritas para la demo, ambos marcados como tales.

## Privacidad

- La predicción, los simulacros, el reto diario, la racha y la clave de IA se quedan en el navegador.
- El generador envía al proveedor elegido la asignatura y unas preguntas oficiales de ejemplo, nunca datos de la persona. Antes del primer envío muestra lo que va a salir.
- Cada tanda son tres llamadas a la IA, que cada persona paga con su propia clave.

## Para que se difunda (diseño)

- **Gratis y sin registro:** predicción, simulacros y reto no piden clave. La fricción de la clave solo aparece en el generador.
- **Reto diario igual para todos**, con resultado en emojis (estilo Wordle) y racha: da algo que comparar cada día en los grupos de WhatsApp de la promoción.
- **«Te reto con este mismo examen»:** el enlace `?sim=<semilla>&n=<n>` reproduce exactamente el mismo simulacro en otro móvil.
- **Imagen de la predicción** (1080×1350), lista para Instagram y X, con el enlace de la app.
- **Cuenta atrás** hasta el 23 de enero en la portada.
- **Honestidad como argumento:** la tarjeta «¿Cuánto fiarse?» enseña el acierto a ciegas en lugar de prometer.

## Desarrollo y pruebas

```bash
python3 scripts/i18n_fuente.py     # regenera src/i18n.js (diccionarios en/pt)
python3 build.py                   # monta index.html
node tests/test_nucleo.js          # predicción, validación, muestreo, puntuación, comprobaciones del generador
python3 tests/test_datos.py        # extracción de cuadernos y plantillas (textos de prueba)
python3 tests/smoke_test.py        # app completa en Chromium con IA simulada
```

## Autoría

- Fernando Borrás Rocher (Universidad Miguel Hernández de Elche) · ORCID [0000-0002-5519-4573](https://orcid.org/0000-0002-5519-4573)
- Antonio F. Compañ Rosique (Universidad Miguel Hernández de Elche) · ORCID [0000-0002-8166-396X](https://orcid.org/0000-0002-8166-396X)

Basada en ConvocatorIA (Fernando Borrás Rocher), adaptada al examen MIR.

Fuente de las preguntas oficiales: cuadernos de examen y plantillas definitivas de respuestas publicados por el Ministerio de Sanidad (portal de Formación Sanitaria Especializada).

## Cómo citar

Borrás Rocher, F., y Compañ Rosique, A. F. (2026). *OráculoMIR* (v1.0.0) [Software]. https://github.com/fborrasumh/oraculomir (DOI en trámite)

## Licencia

Código: MIT. Véase [LICENSE](LICENSE). Las preguntas oficiales pertenecen a su fuente (Ministerio de Sanidad) y se reproducen citándola.
