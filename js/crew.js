import { OPERATOR, TECHS, roomLabel } from "./data.js";
import {
  FLOOR_GRAPH,
  routeFor,
  routePoints,
  roomPoint,
  isOpen,
} from "./engine.js";

export const PEOPLE = [OPERATOR, ...TECHS];
export const isOverview = (scope) => scope === "all" || scope === OPERATOR.id;
export const personFor = (scope) =>
  PEOPLE.find((person) => person.id === scope);
export function visibleTickets(tickets, scope) {
  return isOverview(scope)
    ? tickets
    : tickets.filter((ticket) => ticket.tech === scope);
}
export function personPosition(person, tickets) {
  if (person.id === OPERATOR.id || !person.available) {
    const point = FLOOR_GRAPH.nodes[person.base.node];
    return {
      node: person.base.node,
      x: person.base.x ?? point[0],
      y: person.base.y ?? point[1],
      label: person.base.label,
      status: person.id === OPERATOR.id ? "Supervisión" : "Fuera de turno",
    };
  }
  const active = tickets.find(
    (ticket) => ticket.tech === person.id && ticket.status === "working",
  );
  const last =
    active ??
    tickets
      .filter(
        (ticket) =>
          ticket.tech === person.id &&
          ["resolved", "confirmed"].includes(ticket.status),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (last) {
    const point = roomPoint(last.room);
    return {
      node: `r${last.room}`,
      x: point.x,
      y: point.y + (last.room > 6 ? 44 : -44),
      label: `Habitación ${roomLabel(last.room)}`,
      status: active ? "En atención" : "Disponible",
    };
  }
  const point = FLOOR_GRAPH.nodes[person.base.node];
  return {
    node: person.base.node,
    x: point[0],
    y: point[1],
    label: person.base.label,
    status: "Disponible",
  };
}
export function crewView(tickets, scope = "all", now = Date.now()) {
  const people = isOverview(scope)
    ? PEOPLE
    : PEOPLE.filter((person) => person.id === scope);
  return people.map((person) => {
    const position = personPosition(person, tickets);
    const ranked =
      person.id === OPERATOR.id
        ? []
        : routeFor(tickets, person.id, now, position.node);
    // La prioridad decide el orden de habitaciones; se completan juntas sus tareas.
    const stops = [];
    for (const ticket of ranked) {
      const stop = stops.find((stop) => stop.room === ticket.room);
      if (stop) stop.tickets.push(ticket);
      else stops.push({ room: ticket.room, tickets: [ticket] });
    }
    const route = stops.flatMap((stop) => stop.tickets);
    const points = routePoints(
      stops.map((stop) => stop.tickets[0]),
      position.node,
    );
    if (
      route.length &&
      (position.x !== points[0][0] || position.y !== points[0][1])
    )
      points.unshift([position.x, position.y]);
    const waiting = tickets.filter(
      (ticket) =>
        ticket.tech === person.id &&
        isOpen(ticket) &&
        !route.some((ready) => ready.id === ticket.id),
    );
    return {
      person,
      position,
      route,
      stops,
      points,
      waiting,
      pending: route.length + waiting.length,
    };
  });
}
