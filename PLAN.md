# RoomFix Map · decisiones de implementación

## Fuentes y alcance

Se revisaron RoomFix Map.docx, sus tablas y siete figuras, el prompt adjunto y las cuatro imágenes de Imagenes. Las indicaciones posteriores del usuario fijan el alcance actual: hotel pequeño, sólo **planta baja, habitaciones 001–012**, menos texto, interfaz legible y reparto automático interno.

La pantalla de habitación corresponde a Valentina Ruiz; operaciones, a Sofía Méndez. El escenario prepara once incidencias y tres fallas en la 008. Se preservan datos existentes y archivos originales. El MVP funciona localmente, sin publicación ni conexión hotelera.

## Interacción

El mapa es la superficie principal. Cada punto identifica el equipo averiado y abre problema, prioridad y responsable. Las acciones completas se muestran a pedido. No hay slogans, controles de demostración/reinicio ni explicación del algoritmo en la interfaz. El logo completo original aparece en la habitación.

La vista técnica ocupa todo el ancho cuando el detalle está cerrado. Todos reúne recorridos de colores; cada persona tiene una vista individual. Cada tramo tiene un carril y una flecha. Accesos separados evitan superponer los colores. Las paradas numeradas y su secuencia inferior permiten aislar un tramo y mostrar origen → destino. En celular, el plano tiene desplazamiento propio y centra el tramo elegido. Recepción y Depósito reemplazan el núcleo de circulación entre pisos.

La asignación interna pondera especialidad y turno, trabajo pendiente, criticidad, posición actual y recorrido futuro. Fija intervenciones activas y cambios manuales. Se ejecuta al cargar y en cada modificación del estado. Las incidencias ordinarias reciben responsable aun sin acceso coordinado. Editar responsable queda plegado; esa elección se conserva. P0 se deriva a recepción por una vía separada.

El ingreso debe coordinarse antes de atender. Se permite una intervención activa por técnico. Las tareas bloqueadas o pendientes de acceso quedan fuera del camino. La reapertura conserva identificador e historial, vuelve a repartir y requiere nuevo acceso. Las ubicaciones representan puesto habitual o última habitación atendida, sin GPS.

## Diseño y arquitectura

Azul #174de8, turquesa #0b948b, tinta #172d3a, papel #f5f7f9, paredes #a6b5c0 y naranja #bc5a29. Manrope local, números tabulares, plano SVG con mobiliario, puertas y baños. Movimiento reducido respetado. Logo original encuadrado con CSS y fotografía local ilustrativa.

HTML, CSS y módulos JavaScript sin framework ni build. dispatch.js reparte responsables; crew.js ordena paradas; routes.js genera tramos y flechas; map.js dibuja el plano. engine.js valida transiciones y prioridades. store.js persiste y sincroniza mediante localStorage, BroadcastChannel y storage, con Web Locks cuando está disponible.

La migración convierte habitaciones antiguas 201–212 a 001–012 una sola vez y preserva reportes, estados e historial. Los enlaces antiguos se normalizan. No se reponen ejemplos resueltos al recargar.

## Comprobación

Pruebas de reglas, asignación, migración, recorridos y ubicación de fallas. Navegador: flujo completo entre dos pestañas y anchos 375/768/1024/1440. Se comprueban marcadores, formularios, scroll, desbordamiento y consola. Las pruebas que modifican incidencias usan localhost para conservar el escenario del usuario en 127.0.0.1. Resultados en VERIFICACION.md.
