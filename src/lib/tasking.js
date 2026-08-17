// Satellite Scheduler — mock tasking data for the 6-satellite constellation.
// No real tasking system exists yet (see common-space-spec.md 5.6) — everything
// here is a static, in-memory fixture, fully independent of any STAC catalog
// or the Disaster Commons imagery viewer. Timestamps are generated relative to
// page-load time so the demo always reads as "live."

const HOUR = 3_600_000
const NOW  = Date.now()

function hoursFromNow(h) {
  return h == null ? null : new Date(NOW + h * HOUR).toISOString()
}

// ─── Constellation ────────────────────────────────────────────────────────────

export const SATELLITES = ['CS-1', 'CS-2', 'CS-3', 'CS-4', 'CS-5', 'CS-6'].map(id => ({
  id, sensor: 'Optical', nativeGsd: 0.8,
}))

export const TASKING_AREA_KM = 5.2

// ─── Status pipeline ──────────────────────────────────────────────────────────

export const STATUS_META = {
  'Requested':          { color: '#FFE000', group: 'pending',   label: 'Requested' },
  'Tasked':             { color: '#FFE000', group: 'pending',   label: 'Tasked' },
  'Captured':           { color: '#00C8D7', group: 'inflight',  label: 'Captured' },
  'Downlinked':         { color: '#00C8D7', group: 'inflight',  label: 'Downlinked' },
  'Awaiting Telemetry': { color: '#00C8D7', group: 'inflight',  label: 'Awaiting Telemetry' },
  'Processing':         { color: '#00C8D7', group: 'inflight',  label: 'Processing' },
  'Delivered':          { color: '#22c55e', group: 'delivered', label: 'Delivered' },
  'Delayed':            { color: '#f2994a', group: 'delayed',   label: 'Delayed / Rescheduled' },
}

export const STATUS_GROUPS = [
  { id: 'all',       label: 'All' },
  { id: 'pending',   label: 'Pending' },
  { id: 'inflight',  label: 'In Flight' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'delayed',   label: 'Delayed' },
]

export function statusMeta(status) {
  return STATUS_META[status] || { color: '#94a3b8', group: 'pending', label: status }
}

// ─── Unique IDs (spec 5.6.7) ──────────────────────────────────────────────────

function dateStamp(iso) {
  const d = new Date(iso)
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

export function makeTaskId(requestedAtIso, seq) {
  return `CS-TSK-${dateStamp(requestedAtIso)}-${String(seq).padStart(4, '0')}`
}

export function makeImageId(taskId) {
  return taskId.replace('CS-TSK-', 'CS-IMG-')
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

/** Offset a [lng, lat] center point by a distance in km. */
function destPoint([lng, lat], dxKm, dyKm) {
  const dLat = dyKm / 111.32
  const dLng = dxKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return [lng + dLng, lat + dLat]
}

/** Fixed-size square bbox (spec 5.6.2) centered on a point, given a side length in km. */
export function squareBbox(center, kmSize = TASKING_AREA_KM) {
  const [lng, lat] = center
  const dLat = kmSize / 111.32 / 2
  const dLng = kmSize / (111.32 * Math.cos(lat * Math.PI / 180)) / 2
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat]
}

export function bboxToPolygon(bbox) {
  const [w, s, e, n] = bbox
  return {
    type: 'Polygon',
    coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
  }
}

// ─── Derived fields ───────────────────────────────────────────────────────────

export function confidenceFor(cloudCoverPct) {
  if (cloudCoverPct == null) return null
  if (cloudCoverPct <= 15) return 'High'
  if (cloudCoverPct <= 35) return 'Medium'
  return 'Low'
}

export function resolutionFor(nadirDeg, nativeGsd = 0.8) {
  if (nadirDeg == null) return null
  return +(nativeGsd / Math.cos(nadirDeg * Math.PI / 180)).toFixed(2)
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function relativeFromNow(iso) {
  if (!iso) return null
  const diffMs = new Date(iso).getTime() - Date.now()
  const future = diffMs > 0
  const mins = Math.round(Math.abs(diffMs) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`
  const hrs = Math.floor(mins / 60), rem = mins % 60
  const hStr = rem ? `${hrs}h ${rem}m` : `${hrs}h`
  return future ? `in ${hStr}` : `${hStr} ago`
}

export function formatLocal(iso, timeZone) {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-US', {
    timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) + ' local'
}

// ─── Linked targets ───────────────────────────────────────────────────────────
// Standalone list of named targets a tasking area can be linked to. Deliberately
// NOT sourced from any STAC catalog or the Disaster Commons events list — this
// app knows nothing about STAC. A real integration would swap this out for
// whatever system originates tasking requests (internal ops tooling, a partner
// feed, a public request form, etc).

const TARGETS = [
  { id: 'venezuela-earthquake-2026', name: 'Venezuela Earthquakes 2026', center: [-68.472, 10.435], timeZone: 'America/Caracas' },
  { id: 'texas-flooding-2025',       name: 'Texas Hill Country Floods 2025', center: [-99.1, 29.9], timeZone: 'America/Chicago' },
  { id: 'nigeria-flooding-2025',     name: 'Nigeria Flooding 2025',       center: [7.0, 6.0], timeZone: 'Africa/Lagos' },
  { id: 'myanmar-earthquake-2025',   name: 'Myanmar Earthquake 2025',    center: [96.1, 21.9], timeZone: 'Asia/Yangon' },
  { id: 'philippines-typhoon-2026',  name: 'Philippines Typhoon Watch 2026', center: [121.774, 12.879], timeZone: 'Asia/Manila' },
  { id: 'chile-wildfire-2026',       name: 'Valparaíso Wildfire Watch 2026', center: [-71.6, -33.05], timeZone: 'America/Santiago' },
]

// Every collection here is a live, forward-looking schedule entry — the whole
// point of the Scheduler is "what's coming," so nothing is seeded further than
// FUTURE_CAP_HOURS out, and anything already past its capture stage is recent
// (captured within the last day or two), not stale history.
const FUTURE_CAP_HOURS = 4 * 24 // 4 days

// ─── Mock tasking areas ───────────────────────────────────────────────────────
// Deliberately spans every pipeline status, and includes two targets — the
// Venezuela earthquake and the Philippines typhoon watch — each with 3 tiled
// tasking areas assigned to different satellites, the multi-satellite
// coordination story from spec 5.6.2.

const RAW_TASKS = [
  {
    seq: 1, targetId: 'venezuela-earthquake-2026', dxKm: -8, dyKm: 6,
    satelliteId: 'CS-2', status: 'Tasked', cloudCoverPct: 8, nadirDeg: 4.2,
    hours: { requestedAt: -2, taskedAt: -1, captureAt: 3 },
    note: 'Tile 1 of 3 — coordinated coverage of the earthquake-affected coastline',
  },
  {
    seq: 2, targetId: 'venezuela-earthquake-2026', dxKm: 0, dyKm: 6,
    satelliteId: 'CS-5', status: 'Captured', cloudCoverPct: 14, nadirDeg: 11,
    hours: { requestedAt: -20, taskedAt: -18, captureAt: -2, downlinkAt: 0.5 },
    note: 'Tile 2 of 3 — coordinated coverage of the earthquake-affected coastline',
  },
  {
    seq: 3, targetId: 'venezuela-earthquake-2026', dxKm: 8, dyKm: 6,
    satelliteId: 'CS-6', status: 'Awaiting Telemetry', cloudCoverPct: 21, nadirDeg: 15,
    hours: { requestedAt: -24, taskedAt: -22, captureAt: -6, downlinkAt: -5, telemetryEtaAt: 2 },
    note: 'Tile 3 of 3 — coordinated coverage of the earthquake-affected coastline',
  },
  {
    seq: 4, targetId: 'texas-flooding-2025', dxKm: 0, dyKm: 0,
    satelliteId: null, status: 'Requested', cloudCoverPct: null, nadirDeg: null,
    hours: { requestedAt: -0.5 },
    note: 'Awaiting satellite assignment',
  },
  {
    seq: 5, targetId: 'texas-flooding-2025', dxKm: 6, dyKm: -4,
    satelliteId: 'CS-3', status: 'Processing', cloudCoverPct: 9, nadirDeg: 6,
    hours: { requestedAt: -8, taskedAt: -7, captureAt: -3, downlinkAt: -2.5, telemetryEtaAt: -2, processingCompleteAt: 0.75, availableAt: 1.25 },
    note: null,
  },
  {
    seq: 6, targetId: 'nigeria-flooding-2025', dxKm: 0, dyKm: 0,
    satelliteId: 'CS-4', status: 'Tasked', cloudCoverPct: 11, nadirDeg: 7,
    hours: { requestedAt: -4, taskedAt: -3, captureAt: 30 },
    note: null,
  },
  {
    seq: 7, targetId: 'nigeria-flooding-2025', dxKm: 5, dyKm: 3,
    satelliteId: 'CS-1', status: 'Delayed', cloudCoverPct: 62, nadirDeg: 9,
    hours: { requestedAt: -10, taskedAt: -9, captureAt: 14 },
    note: 'Weather — cloud cover forecast rose above usable threshold; retasked for next clear pass',
  },
  {
    seq: 8, targetId: 'myanmar-earthquake-2025', dxKm: 0, dyKm: 0,
    satelliteId: 'CS-6', status: 'Tasked', cloudCoverPct: 18, nadirDeg: 13,
    hours: { requestedAt: -1, taskedAt: -0.5, captureAt: 7 },
    note: null,
  },
  {
    seq: 9, targetId: 'philippines-typhoon-2026', dxKm: 0, dyKm: 0,
    satelliteId: null, status: 'Requested', cloudCoverPct: null, nadirDeg: null,
    hours: { requestedAt: -0.2 },
    note: 'Tile 1 of 3 — coordinated coverage of the projected landfall track — awaiting satellite assignment',
  },
  {
    seq: 10, targetId: 'philippines-typhoon-2026', dxKm: 6, dyKm: -3,
    satelliteId: 'CS-4', status: 'Tasked', cloudCoverPct: 24, nadirDeg: 18,
    hours: { requestedAt: -3, taskedAt: -2, captureAt: 50 },
    note: 'Tile 2 of 3 — coordinated coverage of the projected landfall track',
  },
  {
    seq: 11, targetId: 'philippines-typhoon-2026', dxKm: -5, dyKm: 4,
    satelliteId: 'CS-1', status: 'Captured', cloudCoverPct: 31, nadirDeg: 22,
    hours: { requestedAt: -16, taskedAt: -15, captureAt: -4, downlinkAt: 1 },
    note: 'Tile 3 of 3 — coordinated coverage of the projected landfall track',
  },
  {
    seq: 12, targetId: 'chile-wildfire-2026', dxKm: 0, dyKm: 0,
    satelliteId: 'CS-5', status: 'Tasked', cloudCoverPct: 4, nadirDeg: 10,
    hours: { requestedAt: -5, taskedAt: -4, captureAt: 80 },
    note: null,
  },
  {
    seq: 13, targetId: 'chile-wildfire-2026', dxKm: 4, dyKm: -2,
    satelliteId: 'CS-2', status: 'Processing', cloudCoverPct: 6, nadirDeg: 8,
    hours: { requestedAt: -12, taskedAt: -11, captureAt: -5, downlinkAt: -4.5, telemetryEtaAt: -4, processingCompleteAt: 3, availableAt: 4 },
    note: null,
  },
]

function buildTask(spec) {
  const target = TARGETS.find(t => t.id === spec.targetId)
  if (!target) return null

  const maxHours = Math.max(...Object.values(spec.hours))
  if (maxHours > FUTURE_CAP_HOURS) {
    console.warn(`tasking.js: seq ${spec.seq} has a timestamp ${maxHours}h out — exceeds the ${FUTURE_CAP_HOURS}h (4-day) cap for scheduled collections`)
  }

  const center = destPoint(target.center, spec.dxKm, spec.dyKm)
  const bbox   = squareBbox(center)

  const timestamps = Object.fromEntries(
    Object.entries(spec.hours).map(([k, h]) => [k, hoursFromNow(h)])
  )

  const taskId  = makeTaskId(timestamps.requestedAt, spec.seq)
  const imageId = spec.status === 'Delivered' ? makeImageId(taskId) : null

  return {
    id: taskId,
    imageId,
    eventId: target.id,
    eventName: target.name,
    timeZone: target.timeZone,
    center,
    bbox,
    satelliteId: spec.satelliteId,
    status: spec.status,
    cloudCoverPct: spec.cloudCoverPct,
    nadirDeg: spec.nadirDeg,
    resolutionM: resolutionFor(spec.nadirDeg),
    confidence: confidenceFor(spec.cloudCoverPct),
    note: spec.note,
    timestamps,
  }
}

export const MOCK_TASKS = RAW_TASKS.map(buildTask).filter(Boolean)

/** The single most relevant upcoming/estimate timestamp for a task — used for sorting and countdowns. */
export function nextMilestone(task) {
  const t = task.timestamps
  return t.availableAt || t.processingCompleteAt || t.telemetryEtaAt
    || t.downlinkAt || t.captureAt || t.taskedAt || t.requestedAt
}
