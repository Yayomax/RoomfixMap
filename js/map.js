import { ROOMS, CATEGORIES, roomLabel } from "./data.js";
import { isOpen, priority, routePoints } from "./engine.js";
import { esc } from "./icons.js";
import { faultGroups } from "./fixtures.js";
import { routeGeometry } from "./routes.js";
const palette = {
  P0: ["#fce5e5", "#c32e38"],
  P1: ["#ffede4", "#bf5321"],
  P2: ["#fff5d8", "#9e7517"],
  P3: ["#e9efff", "#4169bd"],
};
function furniture(x, y, flip) {
  return `<g transform="translate(${x},${y}) ${flip ? "translate(0,200) scale(1,-1)" : ""}" class="furniture">
 <path d="M16 2v5h88V2M22 8h76" stroke="#85b9cc" stroke-width="3"/>
 <g class="fixture-air"><rect x="84" y="18" width="31" height="16" rx="2" fill="#f4f8fa"/><path d="M88 25h23m-23 4h23"/></g>
 <rect x="16" y="52" width="55" height="83" rx="4" fill="#fff"/><path d="M16 77h55M16 84h55"/><rect x="21" y="57" width="20" height="14" rx="2"/><rect x="46" y="57" width="20" height="14" rx="2"/>
 <rect x="7" y="58" width="6" height="17" rx="1"/><rect x="74" y="58" width="6" height="17" rx="1"/><circle cx="77" cy="66" r="6" fill="#f7fafb"/>
 <g class="fixture-tv"><rect x="86" y="55" width="28" height="35" rx="2" fill="#f4f8fa"/><path d="M90 60h20v24H90m10 6v7m-8 0h16"/></g><rect x="15" y="153" width="31" height="10" rx="2"/><path d="M22 165v13h15v-13"/>
 <path d="M82 117h41M82 117v83M82 155h10"/><rect x="89" y="123" width="26" height="25" rx="2"/><circle cx="102" cy="135" r="5"/><rect x="90" y="164" width="23" height="28" rx="4"/><path d="M94 170h15M102 178v8"/>
 </g>`;
}
function room(room, tickets, selected, route) {
  const x = 157 + ((room.number - 1) % 6) * 125,
    y = room.number <= 6 ? 70 : 340,
    flip = room.number > 6;
  const ts = tickets.filter((t) => t.room === room.number && isOpen(t));
  const t = ts.sort(
    (a, b) =>
      Number(priority(a).level.slice(1)) - Number(priority(b).level.slice(1)),
  )[0];
  const p = t ? priority(t) : null;
  const [fill, color] = p ? palette[p.level] : ["#f7fafb", "#6d8992"];
  const sel = selected === room.number;
  return `<g class="map-room ${sel ? "selected" : ""}" role="button" tabindex="0" data-room="${room.number}" aria-label="Habitación ${roomLabel(room.number)}, ${t ? `${p.level}, ${CATEGORIES[t.category].label}, ${t.symptom}` : "sin incidencias"}" aria-pressed="${sel}"><title>Habitación ${roomLabel(room.number)} · ${room.occupied ? "Ocupada" : "Desocupada"}${t ? " · " + esc(t.symptom) : ""}</title>
 <rect class="room-fill" x="${x + 2}" y="${y + 2}" width="121" height="196" fill="${sel ? "#e3f4f1" : fill}"/>
 ${furniture(x, y, flip)}
 <path d="${flip ? `M${x + 46} ${y}H${x}V${y + 200}H${x + 125}V${y}H${x + 80}` : `M${x + 46} ${y + 200}H${x}V${y}H${x + 125}V${y + 200}H${x + 80}`}" stroke="${sel ? "#0b948b" : "#8397a5"}" stroke-width="${sel ? 3.5 : 2.5}" fill="none"/>
 <g stroke="#9aadb7" stroke-width="1" fill="none">${flip ? `<path d="M${x + 46} ${y}v34a34 34 0 0 0 34-34"/>` : `<path d="M${x + 46} ${y + 200}v-34a34 34 0 0 1 34 34"/>`}</g>
 <text x="${x + 13}" y="${y + (flip ? 185 : 33)}" fill="${sel ? "#087e75" : "#203c4a"}" class="room-number">${roomLabel(room.number)}</text>
 </g>`;
}
function crewDrawing(view,index,views,focus) {
 const {person,stops}=view;
 if(!view.route.length)return '';
 const legs=routeGeometry(view,index,views.length);
 return `<g class="crew-route" data-route-person="${person.id}" role="group" aria-label="Recorrido de ${person.name}: ${stops.map(stop=>roomLabel(stop.room)).join(', ')}">${legs.map(leg=>{
  if(!leg.points.length)return '';
  const chosen=focus?.person===person.id&&focus.step===leg.index;
  const dim=focus&&!chosen;
  const points=leg.points.map(point=>point.join(',')).join(' ');
  return `<g class="route-leg ${dim?'is-muted':''} ${chosen?'is-focused':''}" data-leg-index="${leg.index}"><polyline points="${points}" fill="none" stroke="white" stroke-width="6.5" stroke-linejoin="round"/><polyline class="crew-line" points="${points}" fill="none" stroke="${person.color}" stroke-width="${chosen?4.5:2.7}" stroke-linejoin="round" stroke-linecap="round"/>${leg.arrow?`<path class="direction-arrow" d="M-9-5 7 0-9 5-5 0Z" transform="translate(${leg.arrow.x},${leg.arrow.y}) rotate(${leg.arrow.angle}) ${chosen?'scale(1.4)':''}" fill="${person.color}" stroke="white" stroke-width=".9"/>`:''}</g>`;
 }).join('')}${stops.map((stop,i)=>{
  const shared=views.some(other=>other!==view&&other.stops.some(s=>s.room===stop.room));
  const x=220+((stop.room-1)%6)*125+(shared?(index%2?19:-19):0),y=stop.room<=6?281:329;
  const chosen=focus?.person===person.id&&focus.step===i;
  return `<g class="route-waypoint ${chosen?'selected':''}" role="button" tabindex="0" data-action="route-step" data-person="${person.id}" data-step="${i}" aria-label="Ver tramo ${i+1} de ${person.name} hacia habitación ${roomLabel(stop.room)}" aria-pressed="${chosen}"><circle cx="${x}" cy="${y}" r="${chosen?18:15}" fill="${person.color}" stroke="white" stroke-width="3"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="white" font-size="14" font-weight="800">${i+1}</text></g>`;
 }).join('')}</g>`;
}
function personMarker(view, scope) {
  const { person, position } = view;
  const name = person.name.split(" ")[0],
    w = Math.max(58, name.length * 8 + 18);
  return `<g class="person-marker ${scope === person.id ? "selected" : ""} ${position.status === "Fuera de turno" ? "off" : ""}" role="img" transform="translate(${position.x},${position.y})" aria-label="${person.name}, ${position.status}, ${position.label}"><title>${person.name} · ${position.status} · ${position.label}</title><circle r="25" fill="transparent"/><circle class="person-halo" r="22" fill="${person.color}" opacity=".14"/><circle r="17" fill="${person.color}" stroke="white" stroke-width="3"/><text y="4" text-anchor="middle" fill="white" font-size="11" font-weight="800">${person.initials}</text><rect x="${-w / 2}" y="23" width="${w}" height="23" rx="7" fill="white" stroke="${person.color}" stroke-width="1"/><text y="39" text-anchor="middle" fill="${person.color}" font-size="13" font-weight="700">${name}</text></g>`;
}
export function floorMap(
  tickets,
  selected,
  route = [],
  zoom = 1,
  selectedTicket = null,
  crew = [],
  scope = "all",
  focus = null,
) {
  const pts = routePoints(route);
  return `<div class="map-scroll ${zoom > 1 ? "zoomed" : ""}"><svg id="floorplan" class="floorplan" style="--map-zoom:${zoom}" viewBox="0 0 1100 610" role="group" aria-label="Plano de planta baja, habitaciones 001 a 012">
 <defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#d6e0e5"/></pattern><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0v6" stroke="#e2e8ec" stroke-width="2"/></pattern></defs>
 <rect width="1100" height="610" fill="url(#grid)"/>
 <g fill="none" stroke="#c5d2db" stroke-width="1"><path d="M157 47H907M157 40v14M907 40v14M157 561H907M157 555v12M907 555v12"/><path d="M1034 70V540M1028 70h12M1028 540h12"/></g><text x="532" y="40" class="plan-label" text-anchor="middle">Planta baja</text><text x="532" y="579" class="plan-label" text-anchor="middle">001–012 · Hotel Mirador</text>
 <path d="M55 270H997V340H55Z" fill="#edf2f4" stroke="#a6b5bf" stroke-width="2"/>
 <path d="M64 305H985" stroke="#d7e1e7" stroke-dasharray="4 8"/>
 <rect x="55" y="172" width="90" height="98" fill="#edf2f4" stroke="#95a7b3" stroke-width="2.5"/>
 <g fill="none" stroke="#9babb5" stroke-width="1"><rect x="66" y="185" width="68" height="64"/><rect x="76" y="198" width="48" height="17" rx="2"/><path d="M82 215v20m36-20v20M94 190h13v8"/></g><text x="100" y="263" text-anchor="middle" class="plan-label">Recepción</text>
 <rect x="55" y="340" width="90" height="128" fill="#edf2f4" stroke="#95a7b3" stroke-width="2.5"/><g stroke="#98aab4" fill="none"><rect x="68" y="355" width="64" height="95"/><path d="M68 382h64m-64 34h64m-42-60v93"/></g><text x="100" y="486" text-anchor="middle" class="plan-label">Depósito</text>
 <rect x="922" y="154" width="75" height="116" fill="#edf2f4" stroke="#95a7b3" stroke-width="2.5"/><path d="M936 165h46v68h-46ZM936 182h46m-46 17h46m-46 17h46" stroke="#aebcc5" fill="none"/><text x="959" y="252" text-anchor="middle" class="plan-label">Servicio</text>
 <g stroke="#739b8e" fill="#dbece4"><circle cx="959" cy="390" r="15"/><path d="m951 380 16 20m-1-20-15 19"/><circle cx="102" cy="118" r="15"/><path d="m94 108 16 20m-1-20-15 19"/></g>
 ${ROOMS.map((r) => room(r, tickets, selected, route)).join("")}
 <rect x="55" y="70" width="90" height="80" rx="4" fill="#fffaf3" stroke="#c7b49c" stroke-width="1.5"/><text x="100" y="61" class="plan-label" text-anchor="middle">Control</text>
 ${
   crew.length
     ? crew
         .filter((view) => view.route.length)
         .map((view, index, all) => crewDrawing(view, index, all, focus))
         .join("")
     : route.length
       ? `<g class="route-drawing" aria-label="Recorrido sugerido: ${route.map((t) => t.room).join(", ")}"><polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="white" stroke-width="9" stroke-linejoin="round"/><polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#0b948b" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="103" cy="305" r="7" fill="#0b948b" stroke="white" stroke-width="3"/>${route
           .map((t, i) => {
             const x = 220 + ((t.room - 1) % 6) * 125,
               y = t.room <= 6 ? 281 : 329;
             return `<g><circle cx="${x}" cy="${y}" r="12" fill="#0b948b" stroke="white" stroke-width="2.5"/><text x="${x}" y="${y + 4}" fill="white" text-anchor="middle" font-size="12" font-weight="800">${i + 1}</text></g>`;
           })
           .join("")}</g>`
       : ""
 }
 <g class="fault-markers">${faultGroups(tickets)
   .map((group) => {
     const ticket = group.tickets[0];
     const level = priority(ticket).level;
     const active = group.tickets.some((t) => t.id === selectedTicket);
     return `<g class="fault-marker ${active ? "active" : ""}" role="button" tabindex="0" data-action="map-ticket" data-id="${ticket.id}" data-map-room="${group.room}" data-fixture="${group.id}" transform="translate(${group.x},${group.y})" aria-label="Habitación ${roomLabel(group.room)}, ${esc(group.label)}, ${esc(ticket.symptom)}, ${level}${group.tickets.length > 1 ? `, ${group.tickets.length} incidencias` : ""}" aria-pressed="${active}"><title>${roomLabel(group.room)} · ${esc(group.label)} · ${esc(ticket.symptom)} · ${level}</title><circle class="marker-target" r="24" fill="transparent"/><circle class="marker-halo" r="16" fill="${palette[level][1]}" opacity=".17"/><circle class="marker-dot" r="10" fill="${palette[level][1]}" stroke="white" stroke-width="2.5"/><path d="M0-4v5m0 3v.1" stroke="white" stroke-width="2" stroke-linecap="round"/>${group.tickets.length > 1 ? `<circle cx="13" cy="-13" r="8" fill="#203e4c" stroke="white" stroke-width="1.5"/><text x="13" y="-10" text-anchor="middle" font-size="10" fill="white">${group.tickets.length}</text>` : ""}</g>`;
   })
   .join("")}</g>
 <g class="people-locations" aria-label="Ubicaciones de referencia">${crew.map((view) => personMarker(view, scope)).join("")}</g>
 <g transform="translate(1047,24)"><path d="m0 33 9-25 9 25-9-6Z" fill="#546e7f"/><text x="9" y="0" text-anchor="middle" class="plan-label">N</text></g>
 <g transform="translate(55,562)"><path d="M0 0v6h60V0M30 0v6" fill="none" stroke="#7d919d"/><text x="30" y="21" text-anchor="middle" class="plan-label">0 — 2 m</text></g>
 </svg></div>`;
}
