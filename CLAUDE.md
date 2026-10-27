# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

- Servir la app: `npm start` (`python serve.py`) o `INICIAR.bat`. Los módulos ES requieren HTTP; no abrir `index.html` con `file://`.
- Pruebas: `npm test` (`node --test tests/engine.test.js tests/dispatch.test.js`, Node 18+). Una sola prueba: `node --test --test-name-pattern="<texto>" tests/engine.test.js`.
- No hay build, lint ni dependencias de runtime. HTML + CSS + módulos JS sin framework.
- Vistas por query string: `?vista=operaciones`, `?vista=huesped&habitacion=008`.

## Arquitectura

MVP local de mantenimiento para un hotel ficticio (planta baja, habitaciones 001–012). Tres vistas (habitación/huésped, operaciones, técnico) comparten un único estado en `localStorage`.

- `js/store.js`: única vía de escritura. `mutate(fn)` clona el estado, aplica `fn`, **re-ejecuta `dispatchTickets` sobre todas las incidencias**, sube `revision` y guarda. Sincroniza pestañas con `BroadcastChannel` + evento `storage`; usa Web Locks si existen. Sin storage cae a memoria. Clave `roomfix-map-v1`.
- `js/engine.js`: reglas puras: prioridades (P0–P3), validaciones, transiciones de estado (`transition`), grafo del plano. Reglas clave: una reparación activa por técnico; acceso debe coordinarse antes de atender; reabrir conserva id e historial, reasigna y exige nuevo acceso.
- `js/dispatch.js`: asignación automática de responsable (especialidad, turno, carga, criticidad, ubicación, recorrido). Respeta intervenciones activas y cambios manuales. P0 queda fuera del reparto (vía recepción). El algoritmo/puntuación no se muestra en la UI.
- `js/data.js`: datos semilla (11 incidencias, 3 en la 008), `prepareScenario` y migración 201–212 → 001–012 (una sola vez, preserva ids/estado/historial).
- `js/fixtures.js`: ubicación de fallas en el plano y agrupación por equipo. `js/crew.js`: personas, posiciones y orden de paradas. `js/routes.js`: geometría de tramos/flechas. `js/map.js`: plano SVG. `js/app.js`: vistas e interacciones. `js/icons.js`: íconos.
- Estilos: `styles.css` + `refinements.css` (este último se carga después y sobreescribe).

## Cuentas y permisos

Sesión por pestaña (`sessionStorage`, clave `roomfix-session`): Sofía (admin), Martín, Lucía; sin clave. `engine.authorize(ticket, action, actor)` se aplica en `store.updateTicket(..., actor)`: start/resolve/block sólo el técnico a cargo; assign/access/override sólo Sofía; confirm/reopen/cancel/comment sólo el huésped (`GUEST.id`). El técnico ve sólo sus tareas (`ui.person` = su id). No existe vista técnica.

## Convenciones del proyecto

- UI y textos en español rioplatense (voseo). Menos texto en interfaz; sin slogans, controles de reinicio ni explicación del algoritmo.
- Los reportes guardados se conservan; no reponer ejemplos resueltos al recargar.
- Pruebas manuales en navegador que modifiquen incidencias: usar `localhost`, para no tocar el escenario del usuario en `127.0.0.1` (orígenes con storage separado).
- Documentos de contexto: `PLAN.md` (decisiones), `DEMO.md`, `VERIFICACION.md` (controles hechos), `REGLAS-GENERALES-DISENO-Y-DESARROLLO-IA.txt` (pautas de diseño: dirección visual propia, evitar UI genérica). Paleta: azul #174de8, turquesa #0b948b, tinta #172d3a, papel #f5f7f9, naranja #bc5a29; Manrope local.
- `.roomfix-review/` (capturas) está ignorado por git. No tocar `RoomFix Map V2.docx` ni `Imagenes/` (originales).
