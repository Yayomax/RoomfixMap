import {
  CATEGORIES,
  TECHS,
  ROOMS,
  STATUS,
  PRIORITIES,
  OPERATOR,
  GUEST,
  roomLabel,
  normalizeRoom,
} from "./data.js";
import {
  priority,
  isOpen,
  isEmergency,
  compatible,
  canStart,
} from "./engine.js";
import { read, subscribe, createTicket, updateTicket } from "./store.js";
import { floorMap } from "./map.js";
import { fixtureForTicket } from "./fixtures.js";
import {
  PEOPLE,
  crewView,
  isOverview,
  personFor,
  visibleTickets,
} from "./crew.js";
import { icon, esc } from "./icons.js";

const root = document.querySelector("#app"),
  dialog = document.querySelector("#dialog");
const params = new URLSearchParams(location.search);
const roomParam=normalizeRoom(params.get("habitacion"));
const room=Number.isInteger(roomParam)&&roomParam>=1&&roomParam<=12?roomParam:8;
const ui = {
  view: params.get("vista") === "huesped" ? "guest" : "ops",
  section: innerWidth < 650 ? "list" : "map",
  selected: null,
  selectedRoom: null,
  detailOpen: false,
  mapPopup: false,
  mapTicket: null,
  tech: TECHS.some((t) => t.id === params.get("tecnico"))
    ? params.get("tecnico")
    : "martin",
  technical: params.get("vista") === "tecnico",
  person: PEOPLE.some(
    (p) => p.id === (params.get("persona") ?? params.get("tecnico")),
  )
    ? (params.get("persona") ?? params.get("tecnico"))
    : "all",
  filter: "all",
  status: "open",
  query: "",
  zoom: 1,
  showRoute: true,
  routeFocus: null,
  guestPage: "home",
  guestTicket: null,
  step: 0,
  draft: {
    room,
    category: null,
    symptom: null,
    occupied: null,
    unusable: null,
    description: "",
    contactFirst: true,
  },
  sending: false,
};
if(ui.view==="guest") {
 params.set("habitacion",roomLabel(room));
 history.replaceState({},"",`?${params}`);
}
const fmtTime = (t) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(t);
const elapsed = (t) => {
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  return m < 1
    ? "Ahora"
    : m < 60
      ? `Hace ${m} min`
      : `Hace ${Math.floor(m / 60)} h ${m % 60} min`;
};
const badge = (t) => {
  const p = priority(t);
  return `<span class="priority ${p.level.toLowerCase()}">${p.level}<span>${PRIORITIES[p.level]}</span></span>`;
};
const status = (t) =>
  `<span class="state ${t.status}"><i></i>${STATUS[t.status]}</span>`;
const avatar = (t, size = "") =>
  `<span class="avatar ${size}" style="--avatar-color:${t.color}">${t.initials}</span>`;
const brand = () =>
  '<a class="brand" href="?vista=operaciones" data-action="ops" aria-label="RoomFix Map, centro de operaciones"><img src="assets/roomfix-logo.png" alt="RoomFix Map" width="210" height="210"></a>';
function toast(text) {
  const e = document.querySelector("#toast");
  e.textContent = text;
  e.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => e.classList.remove("show"), 4200);
}
function go(view) {
  ui.view = view;
  ui.technical = false;
  ui.person = "all";
  ui.routeFocus=null;
  ui.mapPopup = false;
  ui.mapTicket = null;
  ui.detailOpen = false;
  ui.selectedRoom = null;
  ui.selected = null;
  ui.guestPage = "home";
  history.pushState(
    {},
    "",
    view === "guest"
      ? `?vista=huesped&habitacion=${roomLabel(room)}`
      : "?vista=operaciones",
  );
  render();
  window.scrollTo({ top: 0 });
}
function sorted(tickets) {
  return [...tickets].sort(
    (a, b) =>
      Number(priority(a).level.slice(1)) - Number(priority(b).level.slice(1)) ||
      priority(b).score - priority(a).score ||
      a.createdAt - b.createdAt,
  );
}
function filtered(s) {
  return sorted(
    visibleTickets(s.tickets, ui.person).filter(
      (t) =>
        (ui.status === "all" ||
          (ui.status === "open" && isOpen(t)) ||
          (ui.status === "resolved" &&
            ["resolved", "confirmed"].includes(t.status))) &&
        (ui.filter === "all" || priority(t).level === ui.filter) &&
        `${roomLabel(t.room)} ${t.id} ${CATEGORIES[t.category].label} ${t.symptom}`
          .toLowerCase()
          .includes(ui.query.toLowerCase()),
    ),
  );
}
function profile(person, role = person.role) {
  return `<div class="person-profile">${avatar(person, "small")}<div><strong>${person.name}</strong><span>${role}</span></div></div>`;
}
function topbar() {
  const person =
    ui.technical && !isOverview(ui.person) ? personFor(ui.person) : OPERATOR;
  return `<header class="topbar">${brand()}<div class="hotel"><span class="hotel-mark">M</span><strong>Hotel Mirador</strong></div><div class="topbar-right"><div class="portal-switch"><button class="active" data-action="ops" aria-label="Operaciones">${icon("map")}<span>Operaciones</span></button><button data-action="guest">${icon("bed")}<span>Habitación</span></button></div>${profile(person, person.role ?? "Técnico")}</div></header>`;
}

function metrics(s) {
  const opened = visibleTickets(s.tickets, ui.person).filter(
    (t) => isOpen(t) && !isEmergency(t),
  );
  const high = opened.filter((t) => priority(t).level === "P1").length;
  return `<div class="ops-stats" aria-label="Resumen de incidencias"><span><b>${opened.length}</b> abierta${opened.length === 1 ? "" : "s"}</span><span class="stat-high"><i></i><b>${high}</b> alta${high === 1 ? "" : "s"}</span><span class="stat-working"><i></i><b>${opened.filter((t) => t.status === "working").length}</b> en atención</span></div>`;
}
function ticketRow(t) {
  const tech = TECHS.find((x) => x.id === t.tech);
  return `<button class="ticket-row ${ui.selected === t.id ? "selected" : ""}" data-action="ticket" data-id="${t.id}"><div class="ticket-line"><span class="room-tag">${roomLabel(t.room)}</span>${badge(t)}<span class="ticket-age">${elapsed(t.createdAt)}</span></div><div class="ticket-problem"><span class="category-symbol">${icon(CATEGORIES[t.category].icon)}</span><div><strong>${CATEGORIES[t.category].label}</strong><span>${esc(t.symptom)}</span></div></div><div class="ticket-bottom">${status(t)}<span>${tech ? `${avatar(tech, "tiny")} ${tech.name.split(" ")[0]}` : "Recepción"}</span></div></button>`;
}
function queue(s) {
  const ts = filtered(s).filter((t) => !isEmergency(t));
  return `<aside class="context-panel queue-panel"><div class="panel-heading"><h2>Incidencias <span class="count">${ts.length}</span></h2></div><div class="queue-filters"><button class="filter-chip ${ui.filter === "all" ? "active" : ""}" data-action="filter" data-filter="all">Todas</button>${["P1", "P2", "P3"].map((p) => `<button class="filter-chip ${ui.filter === p ? "active" : ""}" data-action="filter" data-filter="${p}">${p}</button>`).join("")}</div><div class="queue-list">${ts.length ? ts.map(ticketRow).join("") : `<div class="empty">${icon("check")}<h3>Sin incidencias</h3></div>`}</div></aside>`;
}
function detail(s) {
 const t=s.tickets.find(ticket=>ticket.id===ui.selected);
 if(!t)return queue(s);
 const tech=TECHS.find(person=>person.id===t.tech),suggested=TECHS.filter(person=>compatible(t,person)),error=canStart(t,s.tickets),fixture=fixtureForTicket(t);
 return `<aside class="context-panel detail-panel"><button class="back-link" data-action="clear-detail">${icon('arrow','reverse')}Incidencias</button><div class="detail-heading"><span class="eyebrow">${t.id}</span><div><h2>Habitación ${roomLabel(t.room)}</h2>${badge(t)}</div><div class="detail-equipment">${icon(CATEGORIES[t.category].icon)}${fixture.label}</div><h3>${esc(t.symptom)}</h3>${status(t)}</div><div class="detail-content">${t.description?`<p class="description">${esc(t.description)}</p>`:''}<div class="context-pairs"><div>${icon('bed')}<span>${t.occupied?'Ocupada':'Desocupada'}</span></div><div>${icon('door')}<span>${t.unusable?'No utilizable':'Utilizable'}</span></div></div><div class="responsible-person">${tech?`${avatar(tech)}<span><small>Responsable</small><strong>${tech.name}</strong></span>`:`${icon('phone')}<strong>Recepción</strong>`}</div>${isEmergency(t)?'<div class="emergency-box"><strong>Contactar con recepción</strong><p>Sin aviso externo automático.</p></div>':isOpen(t)?`<section class="access-box"><div>${icon('door')}<div><strong>${t.accessCoordinated?'Acceso coordinado':'Ingreso por coordinar'}</strong>${!t.accessCoordinated?`<p>${t.contactFirst?'Contactar antes de ingresar.':'Coordinar con recepción.'}</p>`:''}</div></div>${!t.accessCoordinated?`<button class="button small secondary" data-action="access" data-id="${t.id}">${icon('check')}Confirmar acceso</button>`:''}</section>${['assigned','blocked'].includes(t.status)?`<button class="button primary full" data-action="start" data-id="${t.id}" ${error?'disabled':''}>${icon('tool')}Iniciar atención</button>${error?`<p class="action-hint">${error}</p>`:''}`:''}${t.status==='working'?`<button class="button teal full" data-action="resolve" data-id="${t.id}">${icon('check')}Resolver</button>`:''}${['assigned','working'].includes(t.status)?`<button class="text-button" data-action="block" data-id="${t.id}">Bloquear tarea</button>`:''}${t.blockReason?`<p class="block-note">${esc(t.blockReason)}</p>`:''}<details class="assignment-editor"><summary>Editar responsable</summary><label for="assign-tech" class="sr-only">Responsable</label><div class="assign-controls"><select id="assign-tech" ${t.status==='working'?'disabled':''}>${suggested.map(person=>`<option value="${person.id}" ${t.tech===person.id?'selected':''}>${person.name}</option>`).join('')}</select><button class="button primary small" data-action="assign" data-id="${t.id}" ${t.status==='working'||!suggested.length?'disabled':''}>Guardar</button></div><button class="text-button" data-action="priority" data-id="${t.id}">Editar prioridad</button></details>`:''}${t.status==='resolved'?'<div class="resolved-note">Pendiente de confirmación del huésped.</div>':''}${t.status==='confirmed'?'<div class="resolved-note">Solución confirmada.</div>':''}<details class="history"><summary>Historial <span>${t.history.length}</span></summary><ol>${[...t.history].reverse().map(event=>`<li><time>${fmtTime(event.at)}</time><span>${esc(event.text.startsWith('Prioridad calculada:')?'Solicitud clasificada.':event.text)}</span></li>`).join('')}</ol></details></div></aside>`;
}
function peoplePicker() {
  return `<div class="people-picker" role="group" aria-label="Ver por persona"><button class="person-chip ${ui.person === "all" ? "active" : ""}" data-action="person" data-person="all" aria-pressed="${ui.person === "all"}">${icon("team")}Todos</button>${PEOPLE.map((person) => `<button class="person-chip ${ui.person === person.id ? "active" : ""}" style="--person-color:${person.color}" data-action="person" data-person="${person.id}" aria-pressed="${ui.person === person.id}">${avatar(person, "tiny")}<span>${person.name}</span>${person.available === false ? '<i class="off-dot" aria-label="Fuera de turno"></i>' : ""}</button>`).join("")}</div><label class="people-mobile" for="person-select"><span>Persona</span><select id="person-select"><option value="all" ${ui.person === "all" ? "selected" : ""}>Todos</option>${PEOPLE.map((person) => `<option value="${person.id}" ${ui.person === person.id ? "selected" : ""}>${person.name}</option>`).join("")}</select></label>`;
}
function selectPerson(person) {
  if (person !== "all" && !personFor(person)) return;
  ui.person = person;
  ui.routeFocus=null;
  ui.filter = "all";
  ui.status = "open";
  ui.query = "";
  if (TECHS.some((t) => t.id === person)) ui.tech = person;
  ui.selected = null;
  ui.selectedRoom = null;
  ui.detailOpen = false;
  ui.mapPopup = false;
  ui.mapTicket = null;
  if (ui.technical)
    history.replaceState({}, "", `?vista=tecnico&persona=${person}`);
  render();
}
function routeStrip(s) {
 const views=crewView(s.tickets,ui.person).filter(view=>view.route.length);
 return `<section class="crew-route-strip" aria-label="Orden de recorridos">${views.length?views.map(view=>`<div class="crew-route-row" style="--person-color:${view.person.color}"><button class="route-owner" data-action="person" data-person="${view.person.id}">${avatar(view.person,'tiny')}<strong>${view.person.name.split(' ')[0]}</strong></button><div class="crew-stops">${view.stops.map((stop,i)=>`<button class="crew-stop ${ui.routeFocus?.person===view.person.id&&ui.routeFocus.step===i?'active':''}" data-action="route-step" data-person="${view.person.id}" data-step="${i}" aria-pressed="${ui.routeFocus?.person===view.person.id&&ui.routeFocus.step===i}" aria-label="Ver tramo ${i+1} de ${view.person.name} hacia habitación ${roomLabel(stop.room)}"><span>${i+1}</span><strong>${roomLabel(stop.room)}</strong>${i<view.stops.length-1?icon('chevron'):''}</button>`).join('')}</div></div>`).join(''):'<span class="muted">Sin recorridos pendientes</span>'}<span class="location-caption">Ubicaciones de referencia</span></section>`;
}
function crewPanel(s) {
  const views = crewView(s.tickets, ui.person);
  return `<aside class="context-panel crew-panel ${views.length === 1 ? "solo" : ""}"><div class="panel-heading"><h2>${isOverview(ui.person) ? "Personas" : "Mi recorrido"} <span class="count">${isOverview(ui.person) ? views.length : (views[0]?.stops.length ?? 0)}</span></h2></div>${views.map((view) => `<section class="crew-card" style="--person-color:${view.person.color}"><button class="crew-card-person" data-action="person" data-person="${view.person.id}">${avatar(view.person)}<span><strong>${view.person.name}</strong><small>${view.person.role ?? "Técnico"}</small></span>${icon("chevron")}</button><div class="crew-location"><i></i><span><strong>${view.position.label}</strong><small>${view.position.status}</small></span></div>${view.person.id === OPERATOR.id ? `<div class="crew-caption">${s.tickets.filter((t) => isOpen(t) && !isEmergency(t)).length} incidencias · ${TECHS.filter((t) => t.available).length} técnicos en turno</div>` : view.stops.length ? crewStops(view) : `<div class="crew-caption">${view.person.available ? "Sin tareas listas" : ""}</div>`}${!isOverview(ui.person) && view.waiting.length ? `<div class="crew-waiting"><strong>Por preparar</strong>${view.waiting.map((t) => `<button data-action="ticket" data-id="${t.id}"><span>${roomLabel(t.room)} · ${esc(t.symptom)}</span>${status(t)}</button>`).join("")}</div>` : ""}</section>`).join("")}</aside>`;
}
function crewStops(view) {
  if (isOverview(ui.person))
    return `<div class="crew-room-chips">${view.stops.map((stop, i) => `<button data-action="ticket" data-id="${stop.tickets[0].id}" aria-label="${view.person.name}, parada ${i + 1}, habitación ${roomLabel(stop.room)}"><span>${i + 1}</span>${roomLabel(stop.room)}</button>`).join("")}</div><div class="crew-caption">${view.stops.length} paradas · ${view.route.length} tareas</div>`;
  return `<ol class="crew-task-stops">${view.stops.map((stop, i) => `<li><span class="stop-order">${i + 1}</span><div><button data-action="ticket" data-id="${stop.tickets[0].id}"><strong>Habitación ${roomLabel(stop.room)}</strong><small>${stop.tickets.length} tarea${stop.tickets.length === 1 ? "" : "s"}</small>${icon("chevron")}</button>${stop.tickets.map((t) => `<button class="crew-task-item" data-action="ticket" data-id="${t.id}">${esc(t.symptom)}${badge(t)}</button>`).join("")}</div></li>`).join("")}</ol>`;
}
function mapPopover(s) {
  if (!ui.mapPopup || !ui.selectedRoom) return "";
  const t = s.tickets.find((t) => t.id === ui.mapTicket);
  if (t && !isOpen(t)) return "";
  const r = ROOMS.find((r) => r.number === ui.selectedRoom);
  const fixture = t ? fixtureForTicket(t) : null;
  const related = t
    ? visibleTickets(s.tickets, ui.person).filter(
        (x) =>
          x.room === t.room &&
          isOpen(x) &&
          fixtureForTicket(x).id === fixture.id,
      )
    : [];
  return `<section class="map-popover" role="region" aria-label="${t ? "Falla" : "Estado"} de habitación ${roomLabel(ui.selectedRoom)}"><div class="popup-top"><span>Habitación <strong>${roomLabel(ui.selectedRoom)}</strong></span><button class="popup-close" data-action="close-map" aria-label="Cerrar información">${icon("close")}</button></div>${t ? `<div class="popup-equipment">${icon(CATEGORIES[t.category].icon)}${fixture.label}</div>${related.length > 1 ? `<label class="sr-only" for="map-ticket-choice">Problema en este equipo</label><select id="map-ticket-choice">${related.map((x) => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${esc(x.symptom)}</option>`).join("")}</select>` : `<h3>${esc(t.symptom)}</h3>`}${t.description ? `<p class="popup-description">${esc(t.description)}</p>` : ""}<div class="popup-priority">${badge(t)}<span>${TECHS.find(person=>person.id===t.tech)?.name??'Recepción'}</span></div><button class="popup-detail" data-action="map-detail" data-id="${t.id}">Ver incidencia ${icon("chevron")}</button>` : `<div class="popup-clear">${icon("check")}${isOverview(ui.person) ? "Sin incidencias" : "Sin tareas asignadas"}</div><span class="muted">${r.occupied ? "Ocupada" : "Desocupada"}</span>`}</section>`;
}
function positionMapPopover() {
  const popup = root.querySelector(".map-popover");
  if (!popup) return;
  const stage = root.querySelector(".map-stage");
  const t = read().tickets.find((t) => t.id === ui.mapTicket);
  const fixture = t ? fixtureForTicket(t) : null;
  const marker = root.querySelector(
    t
      ? `[data-map-room="${t.room}"][data-fixture="${fixture.id}"]`
      : `[data-room="${ui.selectedRoom}"]`,
  );
  if (!marker || !stage) return;
  const a = marker.getBoundingClientRect(),
    b = stage.getBoundingClientRect(),
    scroll = root.querySelector(".map-scroll").getBoundingClientRect();
  const x = a.left + a.width / 2,
    y = a.top + a.height / 2;
  popup.hidden =
    x < scroll.left || x > scroll.right || y < scroll.top || y > scroll.bottom;
  if (popup.hidden) return;
  const w = popup.offsetWidth,
    h = popup.offsetHeight;
  const above = y - b.top > h + 22;
  popup.style.left = `${Math.max(10, Math.min(b.width - w - 10, x - b.left - w / 2))}px`;
  popup.style.top = `${Math.max(10, Math.min(b.height - h - 10, y - b.top + (above ? -h - 20 : 20)))}px`;
  popup.classList.toggle("below", !above);
}
function routeCaption(s) {
 const view=crewView(s.tickets,ui.routeFocus.person)[0],stop=view?.stops[ui.routeFocus.step];
 if(!stop)return '';
 const name=view.person.name.split(' ')[0];
 if(stop.tickets.some(ticket=>ticket.status==='working'))return `${name} · En atención · ${roomLabel(stop.room)}`;
 const previous=view.stops[ui.routeFocus.step-1];
 const origin=previous?roomLabel(previous.room):view.position.node.startsWith('r')?roomLabel(view.position.node.slice(1)):'Inicio';
 return `${name} · ${ui.routeFocus.step+1}: ${origin} → ${roomLabel(stop.room)}`;
}
function mapWorkspace(s) {
  const views = crewView(s.tickets, ui.person),
    tickets = visibleTickets(s.tickets, ui.person);
  const visibleCrew = ui.showRoute
    ? views
    : views.map((view) => ({ ...view, route: [], stops: [] }));
  return `<div class="workspace ${ui.technical ? `routes-workspace ${ui.detailOpen?'with-detail':''}` : ""}"><section class="map-panel"><header class="map-heading"><h2>Planta baja <span>001–012</span></h2><button class="route-toggle ${ui.showRoute ? "active" : ""}" data-action="toggle-route" aria-pressed="${ui.showRoute}">${icon("route")}Recorridos</button></header><div class="map-mobile-hint">Deslizá para explorar</div><div class="map-stage">${floorMap(tickets, ui.selectedRoom, [], ui.zoom, ui.selected, visibleCrew, ui.person, ui.routeFocus)}${mapPopover(s)}${ui.routeFocus?`<div class="route-focus-label">${avatar(personFor(ui.routeFocus.person),'tiny')}<strong>${routeCaption(s)}</strong><button data-action="clear-route">Ver completo</button></div>`:''}<div class="zoom-controls"><button data-action="zoom-in" aria-label="Ampliar plano">${icon("plus")}</button><span>${Math.round(ui.zoom * 100)}%</span><button data-action="zoom-out" aria-label="Reducir plano" ${ui.zoom === 1 ? "disabled" : ""}>${icon("minus")}</button><button data-action="zoom-fit" aria-label="Ajustar plano a la pantalla">${icon("expand")}</button></div></div><footer class="map-legend"><span><i class="legend-dot p1-dot"></i>P1 Alta</span><span><i class="legend-dot p2-dot"></i>P2 Media</span><span><i class="legend-dot p3-dot"></i>P3 Baja</span><span><i class="legend-dot clear-dot"></i>Sin incidencias</span></footer>${ui.showRoute ? routeStrip(s) : ""}</section>${ui.detailOpen ? detail(s) : ui.technical ? crewPanel(s) : queue(s)}</div>`;
}
function listWorkspace(s) {
  const ts = filtered(s);
  return `<div class="workspace list-workspace"><section class="list-panel"><div class="list-header"><h2>Incidencias <span class="count">${ts.length}</span></h2><div class="list-filters"><label class="search-field">${icon("list")}<input id="ticket-search" type="search" placeholder="Habitación o problema" aria-label="Buscar incidencias" value="${esc(ui.query)}"></label><label><span class="sr-only">Filtrar estado</span><select id="status-filter"><option value="open" ${ui.status === "open" ? "selected" : ""}>Abiertas</option><option value="resolved" ${ui.status === "resolved" ? "selected" : ""}>Resueltas y confirmadas</option><option value="all" ${ui.status === "all" ? "selected" : ""}>Todos los estados</option></select></label><label><span class="sr-only">Filtrar prioridad</span><select id="priority-filter"><option value="all">Todas las prioridades</option>${["P0", "P1", "P2", "P3"].map((p) => `<option ${ui.filter === p ? "selected" : ""}>${p}</option>`).join("")}</select></label></div></div><div class="ticket-table"><div class="table-head"><span>Habitación / Incidencia</span><span>Prioridad</span><span>Estado</span><span>Responsable</span><span>Acceso</span></div>${
    ts
      .map((t) => {
        const tech = TECHS.find((x) => x.id === t.tech);
        return `<button class="table-row" data-action="ticket" data-id="${t.id}"><span><b class="room-tag">${roomLabel(t.room)}</b><span><strong>${esc(t.symptom)}</strong><small>${t.id} · ${elapsed(t.createdAt)}</small></span></span><span>${badge(t)}</span><span>${status(t)}</span><span>${tech ? `${avatar(tech, "tiny")}${tech.name}` : "Recepción"}</span><span class="table-access">${t.accessCoordinated ? "Coordinado" : "Por coordinar"}${icon("chevron")}</span></button>`;
      })
      .join("") ||
    '<div class="empty"><h3>No hay coincidencias</h3><p>Probá con otro filtro o habitación.</p></div>'
  }</div></section>${ui.selectedRoom ? detail(s) : ""}</div>`;
}
function teamWorkspace(s) {
  return `<section class="team-panel"><div class="section-caption"><h2>Equipo</h2></div><div class="team-grid">${TECHS.filter(
    (t) => isOverview(ui.person) || t.id === ui.person,
  )
    .map((t) => {
      const tasks = s.tickets.filter((x) => x.tech === t.id && isOpen(x));
      return `<article class="team-card">${avatar(t)}<div><h3>${t.name}</h3><span class="availability ${t.available ? "" : "off"}"><i></i>${t.available ? (tasks.some((t) => t.status === "working") ? "En una intervención" : "En turno") : "Fuera de turno"}</span></div><div class="specialties">${t.specialties.map((x) => `<span>${x}</span>`).join("")}</div><div class="team-count"><strong>${tasks.length}</strong> tarea${tasks.length === 1 ? "" : "s"} pendiente${tasks.length === 1 ? "" : "s"}</div><button class="button secondary full" data-action="tech-select" data-tech="${t.id}">Ver tareas ${icon("arrow")}</button></article>`;
    })
    .join("")}</div></section>`;
}
function technical(s) {
  return mapWorkspace(s);
}
function operations(s) {
  const p0 = s.tickets.filter((t) => isEmergency(t) && isOpen(t));
  const title = ui.technical
    ? "Vista técnica"
    : ui.section === "team"
      ? "Equipo"
      : ui.section === "list"
        ? "Incidencias"
        : "Operaciones";
  return `${topbar()}<main id="main" class="ops-main"><div class="ops-heading"><div class="ops-heading-main"><h1>${title}</h1>${!ui.technical ? metrics(s) : ""}</div><button class="button secondary" data-action="${ui.technical ? "back-map" : "technical"}">${icon(ui.technical ? "map" : "tool")}${ui.technical ? "Volver al mapa" : "Vista técnica"}</button></div>${p0.length ? `<div class="emergency-banner">${icon("alert")}<strong>P0 · Contactar con recepción</strong>${p0.map((t) => `<button data-action="ticket" data-id="${t.id}">Habitación ${roomLabel(t.room)}${icon("chevron")}</button>`).join("")}</div>` : ""}<nav class="view-tabs" aria-label="Vistas de mantenimiento">${[
    ["map", "map", "Mapa"],
    ["list", "list", "Incidencias"],
    ["team", "team", "Equipo"],
  ]
    .map(
      ([section, i, label]) =>
        `<button class="${!ui.technical && ui.section === section ? "active" : ""}" data-action="section" data-section="${section}">${icon(i)}${label}</button>`,
    )
    .join(
      "",
    )}</nav>${peoplePicker()}${ui.technical ? technical(s) : ui.section === "map" ? mapWorkspace(s) : ui.section === "list" ? listWorkspace(s) : teamWorkspace(s)}</main>`;
}
function guestHeader() {
  return `<header class="guest-header">${brand()}<div class="guest-hotel-name"><span class="hotel-mark">M</span><strong>Hotel Mirador</strong></div><div class="guest-profile">${profile(GUEST)}</div></header>`;
}
function guestHome(s) {
  const active = s.tickets.filter(
    (t) => t.room === room && t.status !== "confirmed",
  );
  return `<div class="guest-home"><section class="guest-photo"><img src="assets/hotel-room.jpg" alt="Habitación del Hotel Mirador" width="1600" height="1067"><div class="photo-shade"></div><div class="photo-top"><span class="hotel-monogram">M</span><span>Hotel Mirador</span></div><div class="photo-caption"><strong>${roomLabel(room)}</strong><div><span>${ROOMS.find((r) => r.number === room).type}</span><span>Planta baja</span></div></div></section><section class="guest-welcome"><div class="full-brand"><img src="assets/roomfix-logo.png" alt="RoomFix Map, logo completo" width="280" height="280"></div><h1>Mi habitación</h1><button class="button primary report-cta" data-action="report">${icon("plus")}Reportar un problema${icon("arrow")}</button><button class="requests-link" data-action="requests">${icon("clock")}Mis solicitudes${active.length ? `<span class="count">${active.length}</span>` : ""}${icon("chevron")}</button><button class="guest-emergency-link" data-action="emergency">${icon("phone")}Emergencia: contactar a recepción</button></section></div>`;
}
const questions = [
  "¿Qué necesita atención?",
  "¿Qué está pasando?",
  "¿La habitación está ocupada?",
  "¿Podés seguir usando la habitación?",
];
function choice(value, label, selected, ico) {
  return `<button class="answer ${selected ? "selected" : ""}" data-action="answer" data-value="${esc(value)}" aria-pressed="${selected}">${ico ? `<span class="answer-icon">${icon(ico)}</span>` : ""}<span><strong>${label}</strong></span><span class="answer-check">${selected ? icon("check") : ""}</span></button>`;
}
function guestForm() {
  const d = ui.draft;
  let choices = "";
  if (ui.step === 0)
    choices = Object.entries(CATEGORIES)
      .filter(([k]) => k !== "emergencia")
      .map(([k, v]) => choice(k, v.label, d.category === k, v.icon))
      .join("");
  if (ui.step === 1)
    choices = CATEGORIES[d.category].symptoms
      .map(([s]) => choice(s, s, d.symptom === s))
      .join("");
  if (ui.step === 2)
    choices =
      choice(
        "yes",
        "Sí, está ocupada",
        d.occupied === true,
        "bed",
        "Hay huéspedes alojados en esta habitación.",
      ) +
      choice(
        "no",
        "No, está desocupada",
        d.occupied === false,
        "door",
        "No hay huéspedes alojados en este momento.",
      );
  if (ui.step === 3)
    choices =
      choice(
        "yes",
        "Sí, puedo seguir utilizándola",
        d.unusable === false,
        "check",
        "El problema no me impide quedarme.",
      ) +
      choice(
        "no",
        "No, no puedo utilizarla",
        d.unusable === true,
        "alert",
        "Necesito una solución para poder quedarme.",
      );
  const selected =
    [d.category, d.symptom, d.occupied, d.unusable][ui.step] !== null;
  const needsText =
    ui.step === 1 &&
    ["Otro síntoma", "Describir el problema"].includes(d.symptom);
  return `<main id="main" class="guest-flow"><div class="flow-top"><button class="back-link" data-action="form-back">${icon("arrow", "reverse")}${ui.step ? "Anterior" : "Volver a mi habitación"}</button><span>Habitación <strong>${roomLabel(room)}</strong></span></div><div class="flow-progress" aria-label="Pregunta ${ui.step + 1} de 4">${[0, 1, 2, 3].map((i) => `<span class="${i <= ui.step ? "complete" : ""}"></span>`).join("")}</div><div class="flow-heading"><span class="eyebrow">Pregunta ${ui.step + 1} de 4</span><h1 tabindex="-1" id="question-title">${questions[ui.step]}</h1></div><div class="answers ${ui.step === 0 ? "category-answers" : ""}">${choices}</div>${needsText ? `<label class="description-field">¿Qué ocurre?<textarea id="description" rows="3" maxlength="240" placeholder="Por ejemplo: la cortina no se puede cerrar.">${esc(d.description)}</textarea><span>Hasta 240 caracteres</span></label>` : ""}${ui.step === 3 ? `<label class="contact-preference"><input type="checkbox" id="contact-first" ${d.contactFirst ? "checked" : ""}><span><strong>Avisarme antes de ingresar</strong></span></label>` : ""}<div class="flow-actions"><button class="button primary" data-action="next" ${!selected || (needsText && !d.description.trim()) || ui.sending ? "disabled" : ""}>${ui.step === 3 ? (ui.sending ? "Enviando…" : "Enviar solicitud") : "Continuar"}${icon("arrow")}</button></div>${ui.step === 0 ? '<button class="guest-emergency-link" data-action="emergency">¿Hay humo o una situación de peligro?</button>' : ""}</main>`;
}
function guestTrack(s) {
  const ts = s.tickets
    .filter((t) => t.room === room)
    .sort((a, b) => b.createdAt - a.createdAt);
  const t = ts.find((t) => t.id === ui.guestTicket) ?? ts[0];
  if (!t)
    return `<main id="main" class="guest-flow guest-empty"><button class="back-link" data-action="guest-home">${icon("arrow", "reverse")}Mi habitación</button><div class="empty">${icon("check")}<h1>Sin solicitudes</h1><button class="button primary" data-action="report">Reportar un problema</button></div></main>`;
  const stages = [
    "Recibida",
    "Personal asignado",
    "En atención",
    "Reparación realizada",
    "Confirmada",
  ];
  const step = {
    new: 0,
    classified: 0,
    assigned: 1,
    working: 2,
    blocked: t.tech ? 1 : 0,
    resolved: 3,
    confirmed: 4,
  }[t.status];
  const title = isEmergency(t)
    ? "Contactá a recepción"
    : t.status === "confirmed"
      ? "Solución confirmada"
      : t.status === "resolved"
        ? "Reparación realizada"
        : t.status === "working"
          ? "En atención"
          : t.reopens && t.status === "classified"
            ? "Solicitud reabierta"
            : "Solicitud recibida";
  return `<main id="main" class="guest-tracking"><button class="back-link" data-action="guest-home">${icon("arrow", "reverse")}Mi habitación</button>${ts.length > 1 ? `<label class="tracking-selector">Solicitudes<select id="guest-ticket">${ts.map((x) => `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>${x.id} · ${esc(x.symptom)}</option>`).join("")}</select></label>` : ""}<div class="tracking-layout"><section class="tracking-message"><span class="confirmation-icon">${icon(isEmergency(t) ? "alert" : t.status === "working" || t.status === "resolved" ? "tool" : "check")}</span><span class="eyebrow">${t.id} · Habitación ${roomLabel(t.room)}</span><h1>${title}</h1>${t.status === "resolved" ? "<p>¿Se solucionó el problema?</p>" : ""}<div class="reported-problem">${icon(CATEGORIES[t.category].icon)}<div><strong>${esc(t.symptom)}</strong><span>${CATEGORIES[t.category].label}</span>${t.description ? `<p>${esc(t.description)}</p>` : ""}</div></div>${t.status === "resolved" ? `<div class="confirmation-actions"><button class="button teal full" data-action="confirm" data-id="${t.id}">${icon("check")}Sí, quedó solucionado</button><button class="button secondary full" data-action="reopen" data-id="${t.id}">El problema continúa</button></div>` : ""}${isEmergency(t) ? '<div class="emergency-box"><strong>Seguí el protocolo del hotel.</strong><p>Esta pantalla no envía alertas a recepción.</p></div>' : !["resolved", "confirmed"].includes(t.status) ? `<div class="guest-access-note">${icon("door")}<p>${t.accessCoordinated ? "Ingreso coordinado." : "El hotel debe coordinar el ingreso."}</p></div>` : ""}</section>${!isEmergency(t) ? `<section class="tracking-timeline"><h2>Estado</h2><ol>${stages.map((label, i) => `<li class="${i <= step ? "done" : ""} ${i === step ? "current" : ""}"><span class="timeline-node">${i < step || (i === 4 && step === 4) ? icon("check") : i + 1}</span><div><strong>${label}</strong></div></li>`).join("")}</ol></section>` : ""}</div></main>`;
}
function guest(s) {
  return `<div class="guest-app">${guestHeader()}${ui.guestPage === "home" ? `<main id="main">${guestHome(s)}</main>` : ui.guestPage === "form" ? guestForm() : guestTrack(s)}<footer class="guest-footer"><a href="?vista=operaciones" data-action="ops">Operaciones</a></footer></div>`;
}
function render() {
  if(ui.routeFocus){
    const focused=crewView(read().tickets,ui.routeFocus.person)[0];
    const step=focused?.stops.findIndex(stop=>stop.room===ui.routeFocus.room)??-1;
    if(step<0)ui.routeFocus=null;else ui.routeFocus.step=step;
  }

  const scrollState = root.querySelector(".map-scroll");
  const mapScroll = scrollState
    ? { left: scrollState.scrollLeft, top: scrollState.scrollTop }
    : null;
  const active = document.activeElement;
  const id = active?.id;
  const start = active?.selectionStart;
  const focusAttributes = [
    "action",
    "value",
    "id",
    "room",
    "section",
    "step",
    "tech",
    "person",
  ]
    .filter((key) => active?.dataset?.[key] != null)
    .map((key) => `[data-${key}="${CSS.escape(active.dataset[key])}"]`)
    .join("");
  const focusSelector = focusAttributes
    ? active.tagName.toLowerCase() + focusAttributes
    : null;
  root.innerHTML = ui.view === "guest" ? guest(read()) : operations(read());
  const restoredScroll = root.querySelector(".map-scroll");
  if (mapScroll && restoredScroll) {
    restoredScroll.scrollLeft = mapScroll.left;
    restoredScroll.scrollTop = mapScroll.top;
  }
  positionMapPopover();
  document.body.classList.toggle("guest-view", ui.view === "guest");
  document.title = `RoomFix Map · ${ui.view === "guest" ? `Habitación ${roomLabel(room)}` : ui.technical ? "Modo técnico" : "Centro de operaciones"}`;
  if (id) {
    const el = document.getElementById(id);
    if (el) {
      el.focus({ preventScroll: true });
      if (start != null && el.setSelectionRange && el.type !== "number") {
        try {
          el.setSelectionRange(start, start);
        } catch {}
      }
    }
  } else if (focusSelector) {
    root.querySelector(focusSelector)?.focus({ preventScroll: true });
  }
}
function selectTicket(id) {
  const t = read().tickets.find((t) => t.id === id);
  if (!t) return;
  ui.selected = id;
  ui.selectedRoom = t.room;
  ui.detailOpen = true;
  ui.mapPopup = false;
  ui.mapTicket = null;
  render();
  if (innerWidth < 1000)
    document
      .querySelector(".detail-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function showDialog(content) {
  dialog.innerHTML = content;
  dialog.showModal();
}
function modalFrame(title, body, actions) {
  return `<form method="dialog" id="modal-form"><button class="icon-button modal-close" value="cancel" aria-label="Cerrar">${icon("close")}</button><h2 id="dialog-title">${title}</h2>${body}<div class="modal-actions"><button class="button secondary" value="cancel">Cancelar</button>${actions}</div><p class="modal-error" role="alert"></p></form>`;
}

function showEmergency() {
  showDialog(
    modalFrame(
      "Emergencia",
      `<div class="emergency-box">${icon("alert")}<strong>Contactá inmediatamente con recepción.</strong><p>Seguí el protocolo del hotel.</p></div><label class="modal-field">Situación<select id="emergency-symptom">${CATEGORIES.emergencia.symptoms.map(([s]) => `<option>${s}</option>`).join("")}</select></label><p class="muted">Esta pantalla no envía alertas a recepción.</p>`,
      '<button class="button danger" type="button" id="confirm-emergency">Registrar incidencia</button>',
    ),
  );
  document.querySelector("#confirm-emergency").onclick = async () => {
    try {
      const t = await createTicket({
        room,
        category: "emergencia",
        symptom: document.querySelector("#emergency-symptom").value,
        occupied: true,
        unusable: true,
        contactFirst: true,
      });
      ui.guestTicket = t.id;
      ui.guestPage = "tracking";
      dialog.close();
      render();
      toast("Incidencia P0 registrada. Contactar a recepción.");
    } catch (e) {
      toast(e.message);
    }
  };
}
function showPriority(id) {
  showDialog(
    modalFrame(
      "Ajustar prioridad",
      `<p>El cambio quedará registrado en el historial.</p><label class="modal-field">Nueva prioridad<select id="override-level">${["P1", "P2", "P3"].map((p) => `<option>${p}</option>`).join("")}</select></label><label class="modal-field">Motivo<textarea id="override-reason" required maxlength="240" rows="3" placeholder="Explicá el criterio de supervisión."></textarea></label>`,
      '<button type="button" class="button primary" id="save-priority">Guardar cambio</button>',
    ),
  );
  document.querySelector("#save-priority").onclick = async () => {
    try {
      await updateTicket(id, "override", {
        level: document.querySelector("#override-level").value,
        reason: document.querySelector("#override-reason").value,
      });
      dialog.close();
      toast("Prioridad actualizada.");
    } catch (e) {
      document.querySelector(".modal-error").textContent = e.message;
    }
  };
}
function showBlock(id) {
  showDialog(
    modalFrame(
      "Registrar un bloqueo",
      '<label class="modal-field">Motivo<textarea id="block-reason" required rows="3" maxlength="240" placeholder="Por ejemplo: esperando un repuesto."></textarea></label>',
      '<button type="button" class="button primary" id="save-block">Bloquear tarea</button>',
    ),
  );
  document.querySelector("#save-block").onclick = async () => {
    try {
      await updateTicket(id, "block", {
        reason: document.querySelector("#block-reason").value,
      });
      dialog.close();
      toast("Tarea bloqueada.");
    } catch (e) {
      document.querySelector(".modal-error").textContent = e.message;
    }
  };
}

root.addEventListener("click", async (e) => {
  const roomEl = e.target.closest("[data-room]");
  if (roomEl) {
    const roomNumber = Number(roomEl.dataset.room);
    const ticket = sorted(
      visibleTickets(read().tickets, ui.person).filter(
        (t) => t.room === roomNumber && isOpen(t),
      ),
    )[0];
    ui.selectedRoom = roomNumber;
    ui.selected = ticket?.id ?? null;
    ui.mapTicket = ticket?.id ?? null;
    ui.mapPopup = true;
    ui.detailOpen = false;
    render();
    return;
  }
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (el.tagName === "A") e.preventDefault();
  if (el.disabled) return;
  try {
    if (a === "ops") {
      go("ops");
      return;
    }
    if (a === "guest") {
      go("guest");
      return;
    }
    if (a === "section") {
      ui.section = el.dataset.section;
      ui.technical = false;
      ui.selected = null;
      ui.selectedRoom = null;
      ui.detailOpen = false;
      ui.mapPopup = false;
      ui.mapTicket = null;
      ui.filter = "all";
      ui.status = "open";
      render();
      return;
    }
    if (a === "technical" || a === "tech-select") {
      ui.technical = true;
      ui.selectedRoom = null;
      ui.detailOpen = false;
      ui.mapPopup = false;
      ui.mapTicket = null;
      ui.person = el.dataset.tech ?? "all";
      if (el.dataset.tech) ui.tech = el.dataset.tech;
      ui.showRoute = true;
      history.replaceState({}, "", `?vista=tecnico&persona=${ui.person}`);
      render();
      return;
    }
    if(a==="route-step") {
      const step=Number(el.dataset.step),person=el.dataset.person;
      const view=crewView(read().tickets,person)[0];
      if(!view?.stops[step])return;
      ui.routeFocus=ui.routeFocus?.person===person&&ui.routeFocus.step===step?null:{person,step,room:view.stops[step].room};
      ui.mapPopup=false;ui.mapTicket=null;ui.detailOpen=false;ui.selected=null;ui.selectedRoom=null;ui.showRoute=true;
      render();
      const mapScroll=root.querySelector('.map-scroll');
      const target=root.querySelector('.route-leg.is-focused .direction-arrow')??root.querySelector(`.crew-route[data-route-person="${person}"] .route-waypoint[data-step="${step}"]`);
      if(mapScroll&&target){const a=target.getBoundingClientRect(),b=mapScroll.getBoundingClientRect();mapScroll.scrollTo({left:mapScroll.scrollLeft+a.left+a.width/2-b.left-b.width/2,behavior:'smooth'});}
      root.querySelector('.map-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(a==="clear-route"){ui.routeFocus=null;render();return;}
    if (a === "person") {
      selectPerson(el.dataset.person);
      return;
    }
    if (a === "back-map") {
      ui.technical = false;
      ui.person = "all";
      history.replaceState({}, "", "?vista=operaciones");
      ui.section = "map";
      render();
      return;
    }
    if (a === "map-ticket") {
      const ticket = read().tickets.find((t) => t.id === el.dataset.id);
      if (!ticket) return;
      ui.selected = ticket.id;
      ui.selectedRoom = ticket.room;
      ui.mapTicket = ticket.id;
      ui.mapPopup = true;
      ui.detailOpen = false;
      render();
      return;
    }
    if (a === "map-detail") {
      selectTicket(el.dataset.id);
      return;
    }
    if (a === "close-map") {
      ui.mapPopup = false;
      ui.mapTicket = null;
      ui.selected = null;
      ui.selectedRoom = null;
      render();
      return;
    }
    if (a === "ticket") {
      selectTicket(el.dataset.id);
      return;
    }
    if (a === "clear-detail") {
      ui.selected = null;
      ui.selectedRoom = null;
      ui.detailOpen = false;
      ui.mapPopup = false;
      ui.mapTicket = null;
      render();
      return;
    }
    if (a === "filter") {
      ui.filter = el.dataset.filter;
      render();
      return;
    }
    if (a === "toggle-route") {
      ui.showRoute = !ui.showRoute;
      render();
      return;
    }
    if (a.startsWith("zoom-")) {
      ui.zoom =
        a === "zoom-fit"
          ? 1
          : Math.max(
              1,
              Math.min(2, ui.zoom + (a === "zoom-in" ? 0.25 : -0.25)),
            );
      render();
      return;
    }
    if (a === "emergency") {
      showEmergency();
      return;
    }
    if (a === "priority") {
      showPriority(el.dataset.id);
      return;
    }
    if (a === "block") {
      showBlock(el.dataset.id);
      return;
    }
    if (a === "report") {
      ui.guestPage = "form";
      ui.step = 0;
      ui.draft = {
        room,
        category: null,
        symptom: null,
        occupied: null,
        unusable: null,
        description: "",
        contactFirst: true,
      };
      render();
      document.querySelector("#question-title")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
      return;
    }
    if (a === "guest-home") {
      ui.guestPage = "home";
      render();
      return;
    }
    if (a === "requests") {
      ui.guestPage = "tracking";
      render();
      return;
    }
    if (a === "form-back") {
      if (ui.step > 0) ui.step--;
      else ui.guestPage = "home";
      render();
      window.scrollTo({ top: 0 });
      return;
    }
    if (a === "answer") {
      const value = el.dataset.value;
      if (ui.step === 0) {
        if (ui.draft.category !== value) {
          ui.draft.symptom = null;
          ui.draft.description = "";
        }
        ui.draft.category = value;
      }
      if (ui.step === 1) ui.draft.symptom = value;
      if (ui.step === 2) ui.draft.occupied = value === "yes";
      if (ui.step === 3) ui.draft.unusable = value === "no";
      render();
      return;
    }
    if (a === "next") {
      if (ui.step < 3) {
        ui.step++;
        render();
        window.scrollTo({ top: 0 });
        document
          .querySelector("#question-title")
          ?.focus({ preventScroll: true });
      } else {
        ui.sending = true;
        render();
        try {
          const t = await createTicket(ui.draft);
          ui.guestTicket = t.id;
          ui.guestPage = "tracking";
          toast(`Solicitud ${t.id} recibida.`);
        } finally {
          ui.sending = false;
          render();
          window.scrollTo({ top: 0 });
        }
      }
      return;
    }
    const msgs = {
      assign: "Técnico asignado.",
      access: "Acceso coordinado.",
      start: "En atención.",
      resolve: "Reparación realizada.",
      confirm: "Solución confirmada.",
      reopen: "Solicitud reabierta.",
    };
    if (msgs[a]) {
      const payload =
        a === "assign"
          ? { tech: document.querySelector("#assign-tech").value }
          : {};
      if (a === "assign") ui.tech = payload.tech;
      await updateTicket(el.dataset.id, a, payload);
      ui.routeFocus=null;
      toast(msgs[a]);
    }
  } catch (error) {
    toast(error.message);
  }
});
root.addEventListener("change", (e) => {
  const { id, value, checked } = e.target;
  if (id === "person-select") selectPerson(value);
  if (id === "map-ticket-choice") {
    ui.selected = value;
    ui.mapTicket = value;
    render();
  }
  if (id === "route-tech" || id === "technical-tech") {
    ui.tech = value;
    render();
  }
  if (id === "contact-first") ui.draft.contactFirst = checked;
  if (id === "guest-ticket") {
    ui.guestTicket = value;
    render();
  }
  if (id === "status-filter") {
    ui.status = value;
    render();
  }
  if (id === "priority-filter") {
    ui.filter = value;
    render();
  }
});
root.addEventListener("input", (e) => {
  if (e.target.id === "description") {
    ui.draft.description = e.target.value;
    const b = root.querySelector('[data-action="next"]');
    if (b) b.disabled = !ui.draft.description.trim();
  }
  if (e.target.id === "ticket-search") {
    ui.query = e.target.value;
    render();
  }
});
root.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.mapPopup) {
    ui.mapPopup = false;
    ui.mapTicket = null;
    render();
    return;
  }
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("svg [role=button]")
  ) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
dialog.addEventListener("click", (e) => {
  if (e.target.closest("[data-close-dialog]")) dialog.close();
  if (e.target === dialog) {
    const b = dialog.getBoundingClientRect();
    if (
      e.clientX < b.left ||
      e.clientX > b.right ||
      e.clientY < b.top ||
      e.clientY > b.bottom
    )
      dialog.close();
  }
});
window.addEventListener("popstate", () => {
  const current = new URLSearchParams(location.search);
  ui.view = current.get("vista") === "huesped" ? "guest" : "ops";
  ui.technical = current.get("vista") === "tecnico";
  const scope = current.get("persona") ?? current.get("tecnico");
  ui.person = personFor(scope) ? scope : "all";
  ui.selected = null;
  ui.selectedRoom = null;
  ui.mapTicket = null;
  ui.mapPopup = false;
  ui.detailOpen = false;
  ui.guestPage = "home";
  render();
});
window.addEventListener("roomfix-storage-error", () =>
  toast(
    "No se pudo guardar en este navegador. Los cambios se mantienen sólo mientras la pantalla esté abierta.",
  ),
);
subscribe(render);
render();
setInterval(() => {
  if (
    ui.view === "ops" &&
    !dialog.open &&
    !document.activeElement?.matches("input,textarea,select")
  )
    render();
}, 60000);

root.addEventListener(
  "scroll",
  () => requestAnimationFrame(positionMapPopover),
  true,
);
window.addEventListener("resize", positionMapPopover);
