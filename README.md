# RoomFix Map

MVP local de mantenimiento para un hotel pequeño: **planta baja, habitaciones 001–012**. Pantalla de habitación, operaciones y vista técnica comparten el mismo estado.

## Iniciar

Requiere Python 3. Desde esta carpeta:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

También se puede abrir `INICIAR.bat`. Mantené la terminal abierta.

- [Operaciones](http://127.0.0.1:8765/?vista=operaciones)
- [Habitación 008](http://127.0.0.1:8765/?vista=huesped&habitacion=008)
- [Vista técnica: todos](http://127.0.0.1:8765/?vista=tecnico&persona=all)
- [Vista individual: Martín](http://127.0.0.1:8765/?vista=tecnico&persona=martin)

Usá el mismo origen en todas las pestañas. `localhost` y `127.0.0.1` conservan datos separados. Los módulos necesitan HTTP; no abrir index.html directamente. No se requiere Internet, instalar paquetes ni compilar. Si Windows bloquea el puerto, elegí otro y actualizá todas las URLs.

## Funcionamiento

Operaciones pertenece a Sofía Méndez. La pantalla de habitación pertenece a Valentina Ruiz y muestra el logo completo original. El escenario inicial contiene **11 incidencias**, incluidas tres en la **008**: aire, lámpara y grifería. Los reportes guardados se conservan; resolver y recargar no repone los ejemplos.

El reporte usa cuatro preguntas. Recibe prioridad y responsable automáticamente. La asignación interna considera especialidad, turno, carga, criticidad, ubicación y recorrido previsto. Conserva las intervenciones activas y los cambios manuales. **Editar responsable** permite modificar la elección. El algoritmo y su puntuación no aparecen en la interfaz.

El responsable se asigna aunque falte coordinar el ingreso. **Confirmar acceso** sigue siendo una acción independiente. Se admite una reparación activa por técnico, bloqueo, resolución, confirmación del huésped y reapertura con el mismo identificador e historial. Reabrir vuelve a asignar responsable y requiere coordinar nuevamente el acceso.

Los puntos del plano corresponden al equipo afectado. Tocarlos muestra problema, prioridad y responsable; **Ver incidencia** abre las acciones. Reportes del mismo equipo comparten un punto con contador y selector. Si no se deduce un equipo, se usa una zona general.

**Todos** reúne personas y caminos de colores. Cada técnico tiene una vista individual. El mapa ocupa el ancho disponible; las paradas numeradas agrupan tareas de una habitación. Cada tramo tiene su flecha. Tocá una parada o la secuencia inferior para resaltar el tramo y ver origen y destino; **Ver completo** restaura el conjunto. En celular el plano tiene desplazamiento interno y centra el tramo elegido.

Las rutas incluyen tareas con acceso coordinado; las bloqueadas o pendientes de acceso aparecen en **Por preparar**. La intervención en curso queda primero. Las posiciones son referencias del puesto habitual o última habitación atendida, sin GPS. Diego figura fuera de turno y sin recorrido.

## Persistencia

localStorage conserva los datos; BroadcastChannel y el evento storage sincronizan pestañas del mismo origen. Web Locks serializa las modificaciones cuando está disponible. Sin Web Locks no se garantizan escrituras exactamente simultáneas en navegadores antiguos. Sin almacenamiento permitido, el estado sólo dura en memoria.

Las sesiones anteriores migran de 201–212 a 001–012 sin perder identificadores, estados ni historial. Los enlaces antiguos de habitación se normalizan. No hay controles de reinicio en la interfaz.

## Archivos

- js/data.js: datos, escenario y migración.
- js/engine.js: prioridades, validaciones, transiciones y grafo.
- js/dispatch.js: asignación interna de responsables.
- js/store.js: persistencia, sincronización y asignación en cada modificación.
- js/fixtures.js: ubicación y agrupación de fallas.
- js/crew.js: personas, posiciones y orden de paradas.
- js/routes.js: geometría de tramos y flechas.
- js/map.js: plano SVG; js/app.js: vistas e interacciones.
- styles.css y refinements.css: diseño adaptable.
- DEMO.md: presentación; VERIFICACION.md: controles realizados.

## Pruebas y alcance

Con Node.js 18 o posterior:

```powershell
npm test
```

Son 43 pruebas de reglas, migración, asignación y recorridos. Node sólo se necesita para verificarlas; la aplicación no tiene dependencias de ejecución.

El hotel, plano y perfiles son ficticios. No hay backend, autenticación, permisos reales entre habitaciones ni alertas externas. P0 usa una vía excepcional: contactar con recepción y seguir el protocolo del hotel; queda fuera del reparto y recorrido ordinarios. Prioridades y rutas son reglas del MVP, sin optimización global ni seguimiento físico. No se publicó ni se usaron servicios pagos.

Se conservan los documentos originales y la carpeta Imagenes. Logo original mediante encuadre CSS. Manrope local, con licencia OFL en assets/FONT-LICENSE.txt. [Fotografía ilustrativa de Unsplash](https://images.unsplash.com/photo-1611892440504-42a792e24d32), bajo su [licencia](https://unsplash.com/license).
