# Verificación realizada · 17 de octubre de 2026

Revisión en el navegador integrado de Codex. Las operaciones de prueba se hicieron en localhost:8765; el escenario de presentación de 127.0.0.1:8765 conserva sus once incidencias. Se actualizaron sus tres pestañas sin reiniciar datos. Documentos e imágenes originales conservados.

## Código y reglas

**43 pruebas aprobadas, 0 fallidas**: 30 de engine y 13 de dispatch, mediante npm test. Sintaxis de módulos modificados verificada con node --check. No hay build ni dependencias de ejecución.

Las pruebas existentes cubren prioridad, umbrales, antigüedad, P0, especialidad y turno, acceso, una intervención activa, bloqueo, resolución/confirmación/reapertura, ajustes con motivo, trayectos, entradas inválidas, equipos y agrupación de fallas. También cubren escenario, personas, posiciones y conservación de datos.

Las trece pruebas nuevas cubren numeración y enlaces antiguos, migración sin pérdida, reparto de todos los casos ordinarios, compatibilidad, cercanía, equilibrio de carga, criticidad, trabajo futuro, preservación de atención/bloqueo/cambios manuales, reapertura, estabilidad en diez ejecuciones, exclusión de P0 y geometría de flechas/carriles. Tras separar los accesos de los colores se repitieron las trece pruebas, todas aprobadas.

## Comprobaciones en navegador

| Comprobación | Resultado observado |
| --- | --- |
| Escenario de presentación | Once incidencias en planta baja; tres equipos afectados en 008. Los once casos muestran responsable. |
| Migración | Habitaciones 001–012; enlace de huésped 208 normalizado a habitacion=008. |
| Todos e individual | Cuatro personas, dos recorridos de colores, selección individual y Diego fuera de turno sin camino. |
| Tramos | Una parada destaca el tramo y atenúa los demás; muestra persona, origen y destino. Ver completo restaura el conjunto. |
| Mobile | Elegir un tramo centra su flecha dentro del plano y vuelve al encabezado del mapa. La flecha queda visible. |
| Reporte nuevo | RF-1052, televisor de 008, recibió P2 y Martín sin asignación manual. Se sincronizó en la otra pestaña. |
| Acceso y atención | Iniciar estaba deshabilitado antes de Confirmar acceso; después permitió atender y actualizó la vista del huésped. |
| Resolución y reapertura | Resolver retiró el caso; El problema continúa lo reabrió ya asignado y con acceso pendiente de coordinar. |
| Cambio manual | Editar responsable permitió elegir Lucía; recargar conservó la elección. |
| Contenido | Sin Piso 2, Sin asignar ni explicación de puntuación en las vistas revisadas. |
| Consola | Sin errores ni advertencias en la revisión final. |

## Responsive y capturas

Mapa revisado a **375, 768, 1024 y 1440 px**: el ancho del documento no superó el viewport disponible. En 1440, el panel del mapa ocupa aproximadamente 1369 px. El plano conserva desplazamiento interno en celular. Personas usa cuatro columnas en escritorio, dos en tablet y una en celular. La pantalla de huésped a 375 px quedó centrada, con logo completo y sin desbordamiento.

Capturas finales en .roomfix-review: planta-baja-1440.png y planta-baja-375.png. Las capturas anteriores se conservan como referencia histórica y pueden mostrar la numeración anterior.

## Límites

Posiciones de referencia, sin GPS. Tamaños emulados en navegador; no se probaron dispositivos físicos, teclado virtual real ni una auditoría completa WCAG. Sincronización entre pestañas del mismo origen y navegador, sin comunicación entre computadoras. Sin Web Locks no se garantizan escrituras exactamente simultáneas en navegadores antiguos. Perfiles ficticios, sin autenticación, permisos reales ni alertas externas.
