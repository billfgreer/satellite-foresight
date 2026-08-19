// KSAT (Kongsberg Satellite Services) ground stations — a real, publicly
// documented global ground-station network. Shown as map context for the
// Downlink pipeline stage: this is roughly where a satellite would actually
// hand off captured imagery to the ground. Coordinates are approximate.

export const KSAT_STATIONS = [
  { id: 'svalbard',        name: 'Svalbard, Norway',            center: [15.6, 78.23] },
  { id: 'tromso',          name: 'Tromsø, Norway',              center: [18.96, 69.65] },
  { id: 'trollsat',        name: 'TrollSat, Antarctica',        center: [2.53, -72.01] },
  { id: 'puntaarenas',     name: 'Punta Arenas, Chile',         center: [-70.85, -53.14] },
  { id: 'singapore',       name: 'Singapore',                   center: [103.8, 1.35] },
  { id: 'hartebeesthoek',  name: 'Hartebeesthoek, South Africa', center: [27.68, -25.89] },
  { id: 'inuvik',          name: 'Inuvik, Canada',              center: [-133.7, 68.36] },
  { id: 'awarua',          name: 'Awarua, New Zealand',         center: [168.38, -46.53] },
]
