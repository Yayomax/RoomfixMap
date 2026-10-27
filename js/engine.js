import { CATEGORIES, TECHS, OPERATOR, GUEST } from "./data.js";
export const isOpen = (t) =>
  !["resolved", "confirmed", "cancelled"].includes(t.status);
export const canCancel = (t) =>
  ["new", "classified", "assigned", "blocked"].includes(t.status);
const TECH_ACTIONS = ["start", "resolve", "block"];
const ADMIN_ACTIONS = ["assign", "access", "override"];
const GUEST_ACTIONS = ["confirm", "reopen", "cancel", "comment"];
// Cada acción pertenece a un rol: sólo el técnico a cargo avanza la reparación.
export function authorize(t, action, actor) {
  if (TECH_ACTIONS.includes(action) && (!actor || actor !== t.tech))
    throw Error("Sólo el técnico a cargo puede cambiar el estado de la tarea.");
  if (ADMIN_ACTIONS.includes(action) && actor !== OPERATOR.id)
    throw Error("Sólo supervisión puede realizar esta acción.");
  if (GUEST_ACTIONS.includes(action) && actor !== GUEST.id)
    throw Error("Sólo el huésped puede realizar esta acción.");
}
export const isEmergency = (t) => t.category === "emergencia";
export function priority(t, now = Date.now()) {
  if (isEmergency(t))
    return {
      level: "P0",
      score: null,
      G: 1,
      O: +t.occupied,
      B: +t.unusable,
      A: 0,
    };
  const G =
    CATEGORIES[t.category]?.symptoms.find(([s]) => s === t.symptom)?.[1] ?? 0.5;
  const O = +t.occupied,
    B = +t.unusable,
    A = Math.min(1, Math.max(0, (now - t.createdAt) / 28800000));
  const score = 40 * G + 25 * O + 20 * B + 15 * A;
  return {
    level:
      t.override?.level ?? (score >= 60 ? "P1" : score >= 30 ? "P2" : "P3"),
    score,
    G,
    O,
    B,
    A,
    automatic: score >= 60 ? "P1" : score >= 30 ? "P2" : "P3",
  };
}
export function compatible(t, tech) {
  return (
    !!tech?.available &&
    !isEmergency(t) &&
    tech.specialties.includes(CATEGORIES[t.category]?.specialty)
  );
}
export function canStart(t, tickets) {
  if (isEmergency(t)) return "Una emergencia requiere el protocolo del hotel.";
  if (!["assigned", "blocked"].includes(t.status))
    return "La tarea debe estar asignada.";
  if (
    !compatible(
      t,
      TECHS.find((x) => x.id === t.tech),
    )
  )
    return "Asigná un técnico disponible y compatible.";
  if (!t.accessCoordinated)
    return "Primero coordiná el acceso a la habitación.";
  if (
    tickets.some(
      (x) => x.id !== t.id && x.tech === t.tech && x.status === "working",
    )
  )
    return "El técnico ya tiene una intervención en atención.";
  return null;
}
export function transition(t, action, payload, tickets, now = Date.now()) {
  const next = structuredClone(t);
  let text;
  if (action === "assign") {
    if (
      !["classified", "assigned", "blocked"].includes(t.status) ||
      !compatible(
        t,
        TECHS.find((x) => x.id === payload.tech),
      )
    )
      throw Error("No se puede asignar este técnico a la incidencia.");
    next.tech = payload.tech;
    next.status = "assigned";
    text = `Asignado a ${TECHS.find((x) => x.id === payload.tech).name}.`;
  } else if (action === "access") {
    if (!isOpen(t) || isEmergency(t))
      throw Error("No se puede coordinar el acceso para este estado.");
    next.accessCoordinated = true;
    text = "Acceso coordinado por el personal del hotel.";
  } else if (action === "start") {
    const error = canStart(t, tickets);
    if (error) throw Error(error);
    next.status = "working";
    delete next.blockReason;
    text = "Atención iniciada.";
  } else if (action === "resolve") {
    if (t.status !== "working") throw Error("Primero iniciá la atención.");
    next.status = "resolved";
    text = "Reparación realizada. Pendiente de confirmación del huésped.";
  } else if (action === "confirm") {
    if (t.status !== "resolved")
      throw Error("La reparación todavía no está resuelta.");
    next.status = "confirmed";
    text = "Solución confirmada por el huésped.";
  } else if (action === "reopen") {
    if (t.status !== "resolved")
      throw Error("Esta solicitud no puede reabrirse ahora.");
    next.status = "classified";
    next.tech = null;
    delete next.assignmentMode;
    next.accessCoordinated = false;
    next.reopens = (t.reopens ?? 0) + 1;
    delete next.override;
    text = `El huésped indica que el problema continúa. Reapertura ${next.reopens}, vinculada a ${t.id}.`;
  } else if (action === "override") {
    if (
      isEmergency(t) ||
      !isOpen(t) ||
      !["P1", "P2", "P3"].includes(payload.level) ||
      !payload.reason?.trim()
    )
      throw Error("Indicá una prioridad y un motivo. P0 no admite cambios.");
    next.override = { level: payload.level, reason: payload.reason.trim() };
    text = `Supervisión cambió la prioridad a ${payload.level}: ${payload.reason.trim()}`;
  } else if (action === "block") {
    if (!["working", "assigned"].includes(t.status) || !payload.reason?.trim())
      throw Error("Indicá el motivo del bloqueo.");
    next.status = "blocked";
    next.blockReason = payload.reason.trim();
    text = `Trabajo bloqueado: ${next.blockReason}`;
  } else if (action === "cancel") {
    if (!canCancel(t))
      throw Error("La solicitud ya no puede cancelarse: la atención comenzó.");
    next.status = "cancelled";
    text = "El huésped canceló la solicitud.";
  } else if (action === "comment") {
    const comment = payload.text?.trim().slice(0, 240);
    if (!isOpen(t) || isEmergency(t) || !comment)
      throw Error("Escribí un comentario para una solicitud abierta.");
    next.comments = [...(t.comments ?? []), { at: now, text: comment }];
    text = "El huésped agregó un comentario.";
  } else throw Error("Acción desconocida.");
  next.updatedAt = now;
  next.history.push({ at: now, text });
  return next;
}
export function newTicket(input, id, now = Date.now()) {
  if (
    !Number.isInteger(input.room) ||
    input.room < 1 ||
    input.room > 12 ||
    !CATEGORIES[input.category]?.symptoms.some(([s]) => s === input.symptom)
  )
    throw Error("Revisá la habitación y el problema seleccionado.");
  if (
    typeof input.occupied !== "boolean" ||
    typeof input.unusable !== "boolean"
  )
    throw Error("Completá las cuatro preguntas.");
  if (
    ["Otro síntoma", "Describir el problema"].includes(input.symptom) &&
    !input.description?.trim()
  )
    throw Error("Describí brevemente qué ocurre.");
  const t = {
    ...input,
    description: (input.description ?? "").slice(0, 240),
    id,
    status: "new",
    tech: null,
    accessCoordinated: false,
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, text: "Reporte creado desde la habitación." }],
  };
  const p = priority(t, now);
  t.status = "classified";
  t.history.push({
    at: now,
    text: isEmergency(t)
      ? "Emergencia registrada. Contactar con recepción; sin aviso externo."
      : `Prioridad calculada: ${p.score.toFixed(0)} puntos, ${p.level}. Solicitud clasificada.`,
  });
  return t;
}
// Grafo: núcleo -> nodos del pasillo -> accesos de las habitaciones.
export function roomPoint(room) {
  const i = (room - 1) % 6,
    doorY = room <= 6 ? 270 : 340;
  return { x: 220 + i * 125, y: doorY, doorY };
}
export const FLOOR_GRAPH = { nodes: { core: [103, 305] }, edges: [] };
for (let i = 0; i < 6; i++) {
  FLOOR_GRAPH.nodes[`c${i}`] = [220 + i * 125, 305];
  FLOOR_GRAPH.edges.push([i ? `c${i - 1}` : "core", `c${i}`]);
  for (const room of [1 + i, 7 + i]) {
    const p = roomPoint(room);
    FLOOR_GRAPH.nodes[`r${room}`] = [p.x, p.doorY];
    FLOOR_GRAPH.edges.push([`c${i}`, `r${room}`]);
  }
}
// El grafo es un árbol: el camino transitable entre dos accesos es único.
export function graphPath(from, to) {
  const pending = [[from]],
    seen = new Set([from]);
  while (pending.length) {
    const path = pending.shift(),
      last = path.at(-1);
    if (last === to) return path;
    for (const edge of FLOOR_GRAPH.edges) {
      const next =
        edge[0] === last ? edge[1] : edge[1] === last ? edge[0] : null;
      if (next && !seen.has(next)) {
        seen.add(next);
        pending.push([...path, next]);
      }
    }
  }
  return [];
}
export function corridorDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - 305) + Math.abs(b.y - 305);
}
export function routeFor(
  tickets,
  techId,
  now = Date.now(),
  startNode = "core",
) {
  const tech = TECHS.find((t) => t.id === techId);
  if (!tech?.available) return [];
  const active = tickets.find(
    (t) => t.tech === techId && t.status === "working",
  );
  let pending = tickets.filter(
    (t) =>
      t.tech === techId &&
      ["assigned", "working"].includes(t.status) &&
      t.accessCoordinated &&
      compatible(t, tech),
  );
  const start = FLOOR_GRAPH.nodes[startNode] ?? FLOOR_GRAPH.nodes.core;
  let pos = { x: start[0], y: start[1] };
  const result = [];
  if (active && pending.includes(active)) {
    result.push(active);
    pos = roomPoint(active.room);
    pending = pending.filter((t) => t !== active);
  }
  while (pending.length) {
    pending.sort(
      (a, b) =>
        Number(priority(a, now).level.slice(1)) -
          Number(priority(b, now).level.slice(1)) ||
        corridorDistance(pos, roomPoint(a.room)) -
          corridorDistance(pos, roomPoint(b.room)) ||
        a.createdAt - b.createdAt,
    );
    const t = pending.shift();
    result.push(t);
    pos = roomPoint(t.room);
  }
  return result;
}
export function routePoints(route, startNode = "core") {
  let from = FLOOR_GRAPH.nodes[startNode] ? startNode : "core";
  const points = [FLOOR_GRAPH.nodes[from]];
  for (const t of route) {
    const to = `r${t.room}`;
    points.push(
      ...graphPath(from, to)
        .slice(1)
        .map((id) => FLOOR_GRAPH.nodes[id]),
    );
    from = to;
  }
  return points;
}
