// Tasking feasibility — given a candidate tasking area, find every upcoming
// opportunity (satellite + time) where it falls within a satellite's field of
// regard, the off-nadir angle each would require, a mock cloud-cover forecast,
// and any conflicts against already-scheduled collections.

import {
  SAT_ORBITS, ALTITUDE_KM, FOR_HALF_WIDTH_KM,
  subPointRaw, offNadirAngleForGroundOffset, haversineKm,
} from './orbits.js'
import { FUTURE_CAP_HOURS, confidenceFor, resolutionFor, makeTaskId } from './tasking.js'

const STEP_SEC = 15
const SATELLITE_BUSY_BUFFER_MIN = 15

// ─── Mock cloud-cover forecast ────────────────────────────────────────────────
// No real weather feed exists — this is a deterministic pseudo-random forecast
// (same location + day always gives the same answer) with a mild tropical bias,
// standing in for whatever forecast provider a real system would integrate.

function mockCloudCoverPct(lat, lon, timeMs) {
  const dayIndex = Math.floor(timeMs / 86_400_000)
  const raw = Math.sin(lat * 12.9898 + lon * 78.233 + dayIndex * 37.719) * 43758.5453
  const frac = raw - Math.floor(raw)
  const tropicalBias = Math.max(0, 1 - Math.abs(lat) / 50) * 20
  return Math.max(0, Math.min(97, Math.round(frac * 55 + tropicalBias)))
}

// ─── Opportunities ────────────────────────────────────────────────────────────

/**
 * Find every upcoming pass (within lookaheadHours, default = the same 4-day cap
 * used for scheduled collections) where the AOI falls within a satellite's field
 * of regard. Returns one entry per pass — the closest-approach moment, which is
 * the best-geometry (lowest off-nadir) instant within that pass's reachable window.
 */
export function findOpportunities(aoiCenter, { lookaheadHours = FUTURE_CAP_HOURS, stepSec = STEP_SEC } = {}) {
  const [aoiLon, aoiLat] = aoiCenter
  const now = Date.now()
  const endMs = now + lookaheadHours * 3600_000
  const satIds = Object.keys(SAT_ORBITS)
  const passes = []

  for (const satId of satIds) {
    let best = null
    for (let t = now; t <= endMs; t += stepSec * 1000) {
      const p = subPointRaw(satId, t)
      const distKm = haversineKm(aoiLat, aoiLon, p.lat, p.lon)
      if (distKm <= FOR_HALF_WIDTH_KM) {
        if (!best || distKm < best.distKm) best = { t, distKm }
      } else if (best) {
        passes.push({ satId, ...best })
        best = null
      }
    }
    if (best) passes.push({ satId, ...best })
  }

  passes.sort((a, b) => a.t - b.t)

  return passes.map(p => {
    const offNadirDeg = +offNadirAngleForGroundOffset(p.distKm, ALTITUDE_KM).toFixed(1)
    const cloudCoverPct = mockCloudCoverPct(aoiLat, aoiLon, p.t)
    return {
      satelliteId: p.satId,
      timeIso: new Date(p.t).toISOString(),
      distanceKm: +p.distKm.toFixed(1),
      offNadirDeg,
      resolutionM: resolutionFor(offNadirDeg),
      cloudCoverPct,
      confidence: confidenceFor(cloudCoverPct),
    }
  })
}

export function averageCloudCover(opportunities) {
  if (!opportunities.length) return null
  const sum = opportunities.reduce((s, o) => s + o.cloudCoverPct, 0)
  return Math.round(sum / opportunities.length)
}

// ─── Conflicts ────────────────────────────────────────────────────────────────

export function bboxesOverlap(a, b) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
}

/**
 * Two independent conflict checks against already-scheduled collections:
 *  - satellite-busy: the same satellite is already committed to a different
 *    target too close in time to also do this one (can't be in two places).
 *  - overlap: the new AOI's footprint overlaps an existing tasking area outright
 *    (likely-redundant tasking — the "someone already tasked this" problem
 *    from spec section 1).
 */
export function findConflicts(opportunity, existingTasks, aoiBbox) {
  const conflicts = []
  const oppMs = new Date(opportunity.timeIso).getTime()

  for (const task of existingTasks) {
    if (task.satelliteId === opportunity.satelliteId) {
      const busy = Object.values(task.timestamps).some(iso =>
        iso && Math.abs(new Date(iso).getTime() - oppMs) / 60000 < SATELLITE_BUSY_BUFFER_MIN
      )
      if (busy) {
        conflicts.push({
          type: 'satellite-busy',
          taskId: task.id,
          detail: `${opportunity.satelliteId} is already committed to ${task.id} around this time`,
        })
      }
    }
    if (aoiBbox && task.bbox && bboxesOverlap(aoiBbox, task.bbox)) {
      conflicts.push({
        type: 'overlap',
        taskId: task.id,
        detail: `Overlaps existing tasking area ${task.id}`,
      })
    }
  }
  return conflicts
}

// ─── Approximate local time (no real timezone lookup for arbitrary AOIs) ─────

export function approxUtcOffsetHours(lon) {
  return Math.round(lon / 15)
}

export function formatAtOffset(iso, offsetHours) {
  if (!iso) return null
  const shifted = new Date(new Date(iso).getTime() + offsetHours * 3600_000)
  const label = shifted.toLocaleString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  return `${label} (UTC${offsetHours >= 0 ? '+' : ''}${offsetHours})`
}

// ─── Turning an opportunity into a real scheduled task ───────────────────────

export function createTaskFromOpportunity(opportunity, aoiCenter, aoiBbox, seq) {
  const nowIso = new Date().toISOString()
  const [lon] = aoiCenter
  return {
    id: makeTaskId(nowIso, seq),
    imageId: null,
    timeZone: null,
    utcOffsetHours: approxUtcOffsetHours(lon),
    center: aoiCenter,
    bbox: aoiBbox,
    satelliteId: opportunity.satelliteId,
    status: 'Tasked',
    cloudCoverPct: opportunity.cloudCoverPct,
    nadirDeg: opportunity.offNadirDeg,
    resolutionM: opportunity.resolutionM,
    confidence: opportunity.confidence,
    note: 'Created via the tasking feasibility tool',
    timestamps: { requestedAt: nowIso, taskedAt: nowIso, captureAt: opportunity.timeIso },
  }
}
