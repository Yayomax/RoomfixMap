import { priority, isOpen } from "./engine.js";

// Coordenadas del equipamiento del plano: el mismo modelo se refleja en
// las habitaciones inferiores. Los reportes de texto libre quedan en una zona general.
const FIXTURES = {
  air: { id: "air", label: "Aire acondicionado", x: 99, y: 26 },
  lamp: { id: "lamp", label: "Lámpara", x: 77, y: 66 },
  tap: { id: "tap", label: "Grifería", x: 102, y: 135 },
  toilet: { id: "toilet", label: "Inodoro", x: 102, y: 178 },
  tv: { id: "tv", label: "Televisor", x: 100, y: 73 },
  lock: { id: "lock", label: "Cerradura", x: 46, y: 182 },
  bed: { id: "bed", label: "Mobiliario", x: 43, y: 102 },
  general: { id: "general", label: "Zona general", x: 64, y: 151 },
};

export function fixtureForTicket(ticket) {
  let key = "general";
  if (ticket.category === "clima") key = "air";
  if (ticket.category === "luz") key = "lamp";
  if (ticket.category === "agua")
    key = ticket.symptom === "El inodoro no funciona" ? "toilet" : "tap";
  if (ticket.category === "equipo")
    key =
      ticket.symptom === "El televisor no funciona"
        ? "tv"
        : ticket.symptom === "La cerradura falla"
          ? "lock"
          : ticket.symptom === "El mobiliario está dañado"
            ? "bed"
            : "general";
  const fixture = FIXTURES[key];
  const roomX = 157 + ((ticket.room - 1) % 6) * 125;
  const lower = ticket.room > 6;
  return {
    ...fixture,
    room: ticket.room,
    localX: fixture.x,
    localY: fixture.y,
    x: roomX + fixture.x,
    y: (lower ? 340 : 70) + (lower ? 200 - fixture.y : fixture.y),
  };
}

export function faultGroups(tickets, now = Date.now()) {
  const groups = new Map();
  for (const ticket of tickets.filter(isOpen)) {
    const fixture = fixtureForTicket(ticket);
    const key = `${ticket.room}-${fixture.id}`;
    if (!groups.has(key)) groups.set(key, { ...fixture, tickets: [] });
    groups.get(key).tickets.push(ticket);
  }
  for (const group of groups.values()) {
    group.tickets.sort(
      (a, b) =>
        Number(priority(a, now).level.slice(1)) -
          Number(priority(b, now).level.slice(1)) || a.createdAt - b.createdAt,
    );
  }
  return [...groups.values()];
}
