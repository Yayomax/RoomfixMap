import test from "node:test";
import assert from "node:assert/strict";
import { fixtureForTicket, faultGroups } from "../js/fixtures.js";
import { CATEGORIES, TECHS, seed, prepareScenario } from "../js/data.js";
import { crewView, visibleTickets, personPosition } from "../js/crew.js";
import {
  priority,
  newTicket,
  transition,
  canStart,
  compatible,
  routeFor,
  routePoints,
} from "../js/engine.js";
const now = 1800000000000;
const make = (overrides = {}) =>
  newTicket(
    {
      room: 8,
      category: "clima",
      symptom: "No enciende",
      occupied: true,
      unusable: false,
      contactFirst: true,
      ...overrides,
    },
    "RF-1042",
    now,
  );
test("el punto del aire coincide con el equipo en ambas alas", () => {
  const upper = fixtureForTicket(make({ room: 2 }));
  const lower = fixtureForTicket(make({ room: 8 }));
  assert.equal(upper.id, "air");
  assert.deepEqual([upper.x, upper.y], [381, 96]);
  assert.deepEqual([lower.x, lower.y], [381, 514]);
  assert.equal(upper.localY, lower.localY);
});
test("las fallas se ubican en lámpara, grifería e inodoro", () => {
  assert.equal(
    fixtureForTicket(
      make({ category: "luz", symptom: "Una lámpara está rota" }),
    ).id,
    "lamp",
  );
  assert.equal(
    fixtureForTicket(
      make({ category: "agua", symptom: "Hay una pérdida de agua" }),
    ).id,
    "tap",
  );
  assert.equal(
    fixtureForTicket(
      make({ category: "agua", symptom: "El inodoro no funciona" }),
    ).id,
    "toilet",
  );
});
test("equipamiento identifica el objeto y el texto libre usa una zona general", () => {
  for (const [symptom, id] of [
    ["El televisor no funciona", "tv"],
    ["La cerradura falla", "lock"],
    ["El mobiliario está dañado", "bed"],
    ["Otro síntoma", "general"],
  ]) {
    assert.equal(
      fixtureForTicket(
        make({
          category: "equipo",
          symptom,
          description: "Equipo para revisar",
        }),
      ).id,
      id,
    );
  }
  assert.equal(
    fixtureForTicket(
      make({
        category: "otro",
        symptom: "Describir el problema",
        description: "Revisar la habitación",
      }),
    ).id,
    "general",
  );
});
test("un punto agrupa reportes del mismo equipo y prioriza el más urgente", () => {
  const low = make({ occupied: false, symptom: "Hace ruido" });
  const high = { ...make(), id: "RF-1043" };
  const other = {
    ...make({ category: "luz", symptom: "Una lámpara está rota" }),
    id: "RF-1044",
  };
  const groups = faultGroups([low, high, other], now);
  assert.equal(groups.length, 2);
  assert.deepEqual(
    groups.find((g) => g.id === "air").tickets.map((t) => t.id),
    ["RF-1043", "RF-1042"],
  );
});
test("resolver retira el punto y reabrir lo devuelve al mismo equipo", () => {
  const open = make();
  assert.equal(faultGroups([{ ...open, status: "resolved" }], now).length, 0);
  assert.equal(faultGroups([{ ...open, status: "confirmed" }], now).length, 0);
  const [reopened] = faultGroups([{ ...open, status: "classified" }], now);
  assert.equal(reopened.id, "air");
  assert.equal(reopened.room, 8);
});
test("caso obligatorio de aire: 65 puntos, P1", () => {
  const p = priority(make(), now);
  assert.equal(p.score, 65);
  assert.equal(p.level, "P1");
});
test("caso obligatorio de lámpara: 10 puntos, P3", () => {
  const p = priority(
    make({
      category: "luz",
      symptom: "Una lámpara está rota",
      occupied: false,
    }),
    now,
  );
  assert.equal(p.score, 10);
  assert.equal(p.level, "P3");
});
test("antigüedad limitada a ocho horas, sin valores negativos", () => {
  const t = make();
  assert.equal(priority(t, now - 100).A, 0);
  assert.equal(priority(t, now + 28800000).A, 1);
  assert.equal(priority(t, now + 999999999).score, 80);
});
test("tabla explícita, límites de 30 y 60 puntos", () => {
  const t = make({
    category: "luz",
    symptom: "Una lámpara está rota",
    occupied: false,
    unusable: true,
  });
  assert.equal(priority(t, now).level, "P2");
  const p = priority(
    make({ category: "luz", symptom: "La luz no enciende", occupied: true }),
    now + 28800000,
  );
  assert.equal(p.score, 60);
  assert.equal(p.level, "P1");
});
test("todas las categorías y síntomas tienen gravedad entre 0 y 1", () => {
  for (const c of Object.values(CATEGORIES))
    for (const [, g] of c.symptoms) assert.ok(g >= 0 && g <= 1);
});
test("P0 fuera del puntaje, asignación y ruta ordinarios", () => {
  const t = make({ category: "emergencia", symptom: "Riesgo eléctrico" });
  assert.equal(priority(t, now).level, "P0");
  assert.equal(priority(t, now).score, null);
  assert.throws(() => transition(t, "assign", { tech: "martin" }, [t], now));
  assert.throws(() =>
    transition(t, "override", { level: "P3", reason: "prueba" }, [t], now),
  );
  assert.deepEqual(
    routeFor(
      [{ ...t, tech: "martin", status: "assigned", accessCoordinated: true }],
      "martin",
      now,
    ),
    [],
  );
});
test("asignación compatible, supervisada y con trazabilidad", () => {
  const t = make();
  assert.equal(t.tech, null);
  assert.equal(compatible(t, TECHS[1]), false);
  assert.throws(() => transition(t, "assign", { tech: "lucia" }, [t], now));
  const a = transition(t, "assign", { tech: "martin" }, [t], now);
  assert.equal(a.status, "assigned");
  assert.match(a.history.at(-1).text, /Martín/);
});
test("fuera de turno no admite nuevas asignaciones", () => {
  const t = make({ category: "luz", symptom: "La luz no enciende" });
  assert.throws(() => transition(t, "assign", { tech: "diego" }, [t], now));
});
test("asignar no autoriza acceso; iniciar exige coordinación", () => {
  let t = transition(make(), "assign", { tech: "martin" }, [], now);
  assert.match(canStart(t, [t]), /acceso/);
  assert.deepEqual(routeFor([t], "martin", now), []);
  t = transition(t, "access", {}, [t], now);
  assert.equal(canStart(t, [t]), null);
  assert.equal(routeFor([t], "martin", now).length, 1);
});
test("máximo una reparación activa por técnico", () => {
  let t = transition(make(), "assign", { tech: "martin" }, [], now);
  t = transition(t, "access", {}, [t], now);
  const other = { ...t, id: "RF-1043", room: 10, status: "working" };
  assert.match(canStart(t, [t, other]), /ya tiene/);
  assert.throws(() => transition(t, "start", {}, [t, other], now));
});
test("ciclo completo y confirmación", () => {
  let t = make();
  for (const [a, p] of [
    ["assign", { tech: "martin" }],
    ["access", {}],
    ["start", {}],
    ["resolve", {}],
    ["confirm", {}],
  ])
    t = transition(t, a, p, [t], now);
  assert.equal(t.status, "confirmed");
  assert.equal(t.history.length, 7);
  assert.throws(() => transition(t, "start", {}, [t], now));
});
test("reapertura conserva identidad e historial, renueva el permiso de acceso", () => {
  let t = {
    ...make(),
    status: "resolved",
    tech: "martin",
    accessCoordinated: true,
  };
  const n = transition(t, "reopen", {}, [t], now);
  assert.equal(n.id, t.id);
  assert.equal(n.status, "classified");
  assert.equal(n.tech, null);
  assert.equal(n.accessCoordinated, false);
  assert.equal(n.history.length, t.history.length + 1);
  assert.match(n.history.at(-1).text, /Reapertura 1/);
});
test("corrección manual exige motivo e identifica regla original", () => {
  const t = make();
  assert.throws(() =>
    transition(t, "override", { level: "P3", reason: " " }, [t], now),
  );
  const n = transition(
    t,
    "override",
    { level: "P2", reason: "Revisión técnica" },
    [t],
    now,
  );
  assert.equal(priority(n, now).level, "P2");
  assert.equal(priority(n, now).automatic, "P1");
  assert.match(n.history.at(-1).text, /Revisión técnica/);
});
test("P1 nueva se ubica delante de lámpara P3; conserva intervención en curso", () => {
  const t = {
    ...make(),
    status: "assigned",
    tech: "martin",
    accessCoordinated: true,
  };
  const lamp = {
    ...make({
      room: 2,
      category: "luz",
      symptom: "Una lámpara está rota",
      occupied: false,
    }),
    id: "RF-1040",
    status: "assigned",
    tech: "martin",
    accessCoordinated: true,
  };
  assert.deepEqual(
    routeFor([lamp, t], "martin", now).map((x) => x.room),
    [8, 2],
  );
  lamp.status = "working";
  assert.deepEqual(
    routeFor([lamp, t], "martin", now).map((x) => x.room),
    [2, 8],
  );
});
test("misma prioridad usa distancia; ruta pasa sólo por pasillo y puertas", () => {
  const a = {
    ...make({ room: 6 }),
    status: "assigned",
    tech: "martin",
    accessCoordinated: true,
  };
  const b = { ...a, id: "RF-1043", room: 1 };
  const route = routeFor([a, b], "martin", now);
  assert.deepEqual(
    route.map((x) => x.room),
    [1, 6],
  );
  const pts = routePoints(route);
  for (let i = 1; i < pts.length; i++) {
    assert.ok(
      pts[i][0] === pts[i - 1][0] ||
        (pts[i][1] === 305 && pts[i - 1][1] === 305),
    );
    assert.ok(pts[i][1] >= 270 && pts[i][1] <= 340);
  }
});
test("bloqueo requiere motivo, queda visible, excluido del recorrido", () => {
  const t = {
    ...make(),
    status: "assigned",
    tech: "martin",
    accessCoordinated: true,
  };
  assert.throws(() => transition(t, "block", { reason: "" }, [t], now));
  const b = transition(t, "block", { reason: "Esperando repuesto" }, [t], now);
  assert.equal(b.blockReason, "Esperando repuesto");
  assert.deepEqual(routeFor([b], "martin", now), []);
});
test("validación impide campos incompletos y síntomas desconocidos", () => {
  assert.throws(() => make({ occupied: null }));
  assert.throws(() => make({ room: 300 }));
  assert.throws(() => make({ symptom: "No existe" }));
  assert.throws(() => make({ symptom: "Otro síntoma", description: "" }));
});
test("escenario preparado: once incidencias, tres equipos de la 8 y equipo mixto", () => {
  const s = seed(now);
  assert.equal(s.tickets.length, 11);
  assert.deepEqual(
    s.tickets
      .filter((t) => t.room === 8)
      .map((t) => fixtureForTicket(t).id)
      .sort(),
    ["air", "lamp", "tap"],
  );
  assert.equal(s.scenarioVersion, 2);
  assert.equal(s.tickets.filter((t) => t.status === "working").length, 1);
  assert.equal(
    s.tickets.some((t) => priority(t, now).level === "P2"),
    true,
  );
  assert.equal(
    s.tickets.some((t) => priority(t, now).level === "P3"),
    true,
  );
});
test("ampliar el escenario conserva reportes existentes y no duplica casos abiertos", () => {
  const original = {
    version: 1,
    revision: now,
    tickets: [{ ...make(), id: "RF-8000", description: "Reporte del usuario" }],
  };
  const prepared = prepareScenario(original, now);
  assert.equal(original.tickets.length, 1);
  assert.deepEqual(prepared.tickets[0], original.tickets[0]);
  assert.equal(
    prepared.tickets.filter((t) => t.room === 8 && t.category === "clima")
      .length,
    1,
  );
  assert.equal(
    new Set(prepared.tickets.map((t) => t.id)).size,
    prepared.tickets.length,
  );
  assert.ok(
    prepared.tickets.slice(1).every((t) => Number(t.id.slice(3)) > 8000),
  );
});
test("la preparación no repone tareas después de resolverlas o recargar", () => {
  const prepared = seed(now);
  prepared.tickets[0].status = "resolved";
  const again = prepareScenario(prepared, now + 60000);
  assert.equal(again, prepared);
  assert.equal(again.tickets[0].status, "resolved");
  assert.equal(again.tickets.length, 11);
});
test("Todos y Sofía muestran el equipo; la vista individual muestra sólo su persona y tareas", () => {
  const tickets = seed(now).tickets;
  const everyone = crewView(tickets, "all", now);
  assert.equal(everyone.length, 4);
  assert.equal(new Set(everyone.map((v) => v.person.color)).size, 4);
  assert.deepEqual(
    crewView(tickets, "sofia", now).map((v) => v.person.id),
    everyone.map((v) => v.person.id),
  );
  assert.deepEqual(
    crewView(tickets, "martin", now).map((v) => v.person.id),
    ["martin"],
  );
  assert.ok(
    visibleTickets(tickets, "martin").every((t) => t.tech === "martin"),
  );
  assert.equal(visibleTickets(tickets, "sofia").length, tickets.length);
});
test("el recorrido arranca en la ubicación del técnico y conserva la intervención activa primero", () => {
  const tickets = seed(now).tickets;
  const [view] = crewView(tickets, "lucia", now);
  assert.equal(view.position.node, "r11");
  assert.deepEqual(view.points[0], [720, 384]);
  assert.equal(view.route[0].status, "working");
  assert.equal(view.stops[0].room, 11);
  for (const [x, y] of view.points.slice(1)) {
    assert.ok(y >= 270 && y <= 340);
    assert.ok(x >= 103 && x <= 845);
  }
});
test("varias reparaciones en la misma habitación comparten una parada sin perder tareas", () => {
  const tickets = seed(now).tickets;
  const [view] = crewView(tickets, "martin", now);
  assert.equal(view.stops.filter((stop) => stop.room === 8).length, 1);
  assert.equal(view.stops.find((stop) => stop.room === 8).tickets.length, 2);
  assert.equal(
    view.route.length,
    tickets.filter((t) => t.tech === "martin" && t.accessCoordinated).length,
  );
  assert.equal(crewView(tickets, "diego", now)[0].route.length, 0);
});
test("al iniciar y resolver se actualiza la ubicación de referencia", () => {
  const tickets = seed(now).tickets;
  const ticket = tickets.find((t) => t.room === 3);
  const active = transition(ticket, "start", {}, tickets, now);
  const withActive = tickets.map((t) => (t.id === ticket.id ? active : t));
  assert.equal(personPosition(TECHS[0], withActive).node, "r3");
  const resolved = transition(active, "resolve", {}, withActive, now + 60000);
  const position = personPosition(
    TECHS[0],
    withActive.map((t) => (t.id === ticket.id ? resolved : t)),
  );
  assert.equal(position.node, "r3");
  assert.equal(position.status, "Disponible");
});
test("una tarea bloqueada o sin acceso queda visible fuera del recorrido", () => {
  const tickets = seed(now).tickets;
  const assigned = tickets.find((t) => t.tech === "martin");
  for (const overrides of [
    { accessCoordinated: false },
    { status: "blocked", blockReason: "Repuesto" },
  ]) {
    const changed = tickets.map((t) =>
      t.id === assigned.id ? { ...t, ...overrides } : t,
    );
    const [view] = crewView(changed, "martin", now);
    assert.ok(view.waiting.some((t) => t.id === assigned.id));
    assert.equal(
      view.route.some((t) => t.id === assigned.id),
      false,
    );
    assert.equal(
      view.pending,
      tickets.filter((t) => t.tech === "martin").length,
    );
  }
});
