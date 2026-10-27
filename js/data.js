export const roomLabel = value => String(Number(value)).padStart(3,"0");
export function normalizeRoom(value) {
 const room=Number(value);
 return room>=201&&room<=212?room-200:room;
}
export function migrateRooms(state) {
 if(state.roomScheme==="ground-floor")return state;
 const migrated=structuredClone(state);
 for(const ticket of migrated.tickets)ticket.room=normalizeRoom(ticket.room);
 migrated.roomScheme="ground-floor";
 return migrated;
}
export const CATEGORIES = {
  clima: {
    label: "Aire acondicionado",
    specialty: "Climatización",
    icon: "wind",
    symptoms: [
      ["No enciende", 1],
      ["No enfría", 0.85],
      ["Hace ruido", 0.35],
      ["Pierde agua", 0.7],
      ["Otro síntoma", 0.5],
    ],
  },
  luz: {
    label: "Iluminación",
    specialty: "Electricidad",
    icon: "bulb",
    symptoms: [
      ["La luz no enciende", 0.5],
      ["Una lámpara está rota", 0.25],
      ["La luz parpadea", 0.4],
      ["Otro síntoma", 0.5],
    ],
  },
  agua: {
    label: "Baño / agua",
    specialty: "Plomería",
    icon: "drop",
    symptoms: [
      ["Hay una pérdida de agua", 0.8],
      ["No sale agua", 1],
      ["El inodoro no funciona", 1],
      ["Otro síntoma", 0.5],
    ],
  },
  equipo: {
    label: "Equipamiento",
    specialty: "General",
    icon: "bed",
    symptoms: [
      ["El televisor no funciona", 0.25],
      ["La cerradura falla", 1],
      ["El mobiliario está dañado", 0.4],
      ["Otro síntoma", 0.5],
    ],
  },
  otro: {
    label: "Otro problema",
    specialty: "General",
    icon: "more",
    symptoms: [["Describir el problema", 0.5]],
  },
  emergencia: {
    label: "Humo o situación de peligro",
    specialty: null,
    icon: "alert",
    symptoms: [
      ["Humo o fuego", 1],
      ["Riesgo eléctrico", 1],
      ["Una persona está lesionada", 1],
      ["Fuga peligrosa", 1],
    ],
  },
};
export const TECHS = [
  {
    id: "martin",
    name: "Martín López",
    initials: "ML",
    specialties: ["Climatización", "Electricidad", "General"],
    color: "#174de8",
    available: true,
    base: { node: "c0", label: "Pasillo · 001 / 007" },
  },
  {
    id: "lucia",
    name: "Lucía Torres",
    initials: "LT",
    specialties: ["Plomería", "General"],
    color: "#0b948b",
    available: true,
    base: { node: "c5", label: "Pasillo · 006 / 012" },
  },
  {
    id: "diego",
    name: "Diego Ruiz",
    initials: "DR",
    specialties: ["Electricidad", "General"],
    color: "#8264b5",
    available: false,
    base: { node: "c5", x: 959, y: 190, label: "Servicio" },
  },
];
export const ROOMS = Array.from({ length: 12 }, (_, i) => ({
  number: 1 + i,
  occupied: ![1, 3, 5, 8, 11].includes(i),
  type: [0, 5, 6, 11].includes(i) ? "Suite" : "Doble superior",
}));
export const STATUS = {
  new: "Nuevo",
  classified: "Clasificado",
  assigned: "Asignado",
  working: "En atención",
  resolved: "Resuelto",
  confirmed: "Confirmado",
  blocked: "Bloqueado",
};
export const PRIORITIES = {
  P0: "Emergencia",
  P1: "Alta",
  P2: "Media",
  P3: "Baja",
};
export const OPERATOR = {
  id: "sofia",
  name: "Sofía Méndez",
  initials: "SM",
  role: "Supervisora de mantenimiento",
  color: "#ab621b",
  base: { node: "core", x: 103, y: 105, label: "Control" },
};
export const GUEST = {
  name: "Valentina Ruiz",
  initials: "VR",
  role: "Huésped",
  color: "#087f78",
};
export function seed(now = Date.now()) {
  const ticket = (
    id,
    room,
    category,
    symptom,
    mins,
    occupied,
    unusable,
    status,
    tech,
    coordinated,
  ) => ({
    id,
    room,
    category,
    symptom,
    description: "",
    occupied,
    unusable,
    contactFirst: true,
    accessCoordinated: coordinated,
    status,
    tech,
    createdAt: now - mins * 60000,
    updatedAt: now - mins * 60000,
    history: [
      { at: now - mins * 60000, text: "Reporte creado desde la habitación." },
      {
        at: now - mins * 60000,
        text: "Prioridad calculada y solicitud clasificada.",
      },
      ...(tech
        ? [
            {
              at: now - (mins - 2) * 60000,
              text: `Asignado a ${TECHS.find((t) => t.id === tech).name}.`,
            },
          ]
        : []),
      ...(status === "working"
        ? [
            {
              at: now - 12 * 60000,
              text: "Acceso coordinado. Atención iniciada.",
            },
          ]
        : []),
    ],
  });
  return prepareScenario(
    {
      version: 1,
      revision: now,
      tickets: [
        ticket(
          "RF-1041",
          4,
          "agua",
          "Hay una pérdida de agua",
          32,
          false,
          false,
          "classified",
          null,
          false,
        ),
        ticket(
          "RF-1040",
          2,
          "luz",
          "Una lámpara está rota",
          54,
          false,
          false,
          "assigned",
          "martin",
          true,
        ),
        ticket(
          "RF-1039",
          11,
          "agua",
          "No sale agua",
          76,
          true,
          false,
          "working",
          "lucia",
          true,
        ),
      ],
    },
    now,
  );
}

// La ampliación se aplica una sola vez y conserva las solicitudes existentes.
export function prepareScenario(state, now = Date.now()) {
  state=migrateRooms(state);
  if (state.scenarioVersion >= 2) return state;
  const prepared = structuredClone(state);
  const examples = [
    [8, "clima", "No enciende", 55, true, false, "martin"],
    [8, "luz", "La luz parpadea", 40, true, false, "martin"],
    [8, "agua", "Hay una pérdida de agua", 28, true, false, "lucia"],
    [5, "clima", "No enfría", 22, true, true, "martin"],
    [9, "agua", "El inodoro no funciona", 18, false, true, "lucia"],
    [6, "equipo", "El televisor no funciona", 37, false, false, null],
    [3, "equipo", "La cerradura falla", 15, true, true, "martin"],
    [12, "agua", "No sale agua", 11, false, false, "lucia"],
  ];
  let nextId = Math.max(
    1041,
    ...prepared.tickets.map((t) => Number(t.id.slice(3)) || 0),
  );
  for (const [
    room,
    category,
    symptom,
    mins,
    occupied,
    unusable,
    tech,
  ] of examples) {
    if (
      prepared.tickets.some(
        (t) =>
          t.room === room &&
          t.category === category &&
          t.symptom === symptom &&
          !["resolved", "confirmed"].includes(t.status),
      )
    )
      continue;
    const at = now - mins * 60000;
    prepared.tickets.push({
      id: `RF-${++nextId}`,
      room,
      category,
      symptom,
      description: "",
      occupied,
      unusable,
      contactFirst: true,
      accessCoordinated: !!tech,
      status: tech ? "assigned" : "classified",
      tech,
      createdAt: at,
      updatedAt: at,
      history: [
        { at, text: "Reporte creado desde la habitación." },
        { at, text: "Prioridad calculada y solicitud clasificada." },
        ...(tech
          ? [
              {
                at: at + 60000,
                text: `Asignado a ${TECHS.find((t) => t.id === tech).name}. Acceso coordinado.`,
              },
            ]
          : []),
      ],
    });
  }
  prepared.scenarioVersion = 2;
  return prepared;
}
