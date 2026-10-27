import { seed, prepareScenario } from "./data.js";
import { newTicket, transition, authorize } from "./engine.js";
import { dispatchTickets } from "./dispatch.js";
const KEY = "roomfix-map-v1";
let memory;
let channel;
const listeners = new Set();
try {
  channel = new BroadcastChannel(KEY);
} catch {}
export function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    if (value?.version === 1 && Array.isArray(value.tickets)) {
      memory = value;
      return value;
    }
  } catch {}
  return memory ?? (memory = seed());
}
function notify() {
  listeners.forEach((fn) => fn(read()));
}
function save(value) {
  memory = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    window.dispatchEvent(new CustomEvent("roomfix-storage-error"));
  }
  channel?.postMessage({ revision: value.revision });
  notify();
}
async function mutate(fn) {
  const run = () => {
    const s = structuredClone(read());
    const result = fn(s);
    s.tickets = dispatchTickets(s.tickets);
    s.revision = Math.max(Date.now(), s.revision + 1);
    save(s);
    return result?.id ? s.tickets.find(ticket=>ticket.id===result.id) : result;
  };
  return navigator.locks ? navigator.locks.request(KEY, run) : run();
}
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const updateTicket = (id, action, payload = {}, actor) =>
  mutate((s) => {
    const i = s.tickets.findIndex((t) => t.id === id);
    if (i < 0) throw Error("No se encontró la solicitud.");
    authorize(s.tickets[i], action, actor);
    s.tickets[i] = transition(s.tickets[i], action, payload, s.tickets);
    if(action==="assign")s.tickets[i].assignmentMode="manual";
    return s.tickets[i];
  });
export const createTicket = (input) =>
  mutate((s) => {
    const id = `RF-${Math.max(1041, ...s.tickets.map((t) => Number(t.id.slice(3)))) + 1}`;
    const t = newTicket(input, id);
    s.tickets.push(t);
    return t;
  });
window.addEventListener("storage", (e) => {
  if (e.key === KEY) notify();
});
channel?.addEventListener("message", () => notify());
try {
  const current = read();
  const prepared = prepareScenario(current);
  const dispatched = {...prepared,tickets:dispatchTickets(prepared.tickets)};
  if (JSON.stringify(dispatched)!==JSON.stringify(current) || !localStorage.getItem(KEY)) save(dispatched);
} catch {
  memory ??= seed();
}
