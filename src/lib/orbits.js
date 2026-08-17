// Simplified circular-orbit propagation for the 6-satellite constellation —
// enough to draw a realistic ground track, field-of-view (instantaneous imaging
// swath), and field-of-regard (max reachable swath via slewing) on the map.
// Deliberately not SGP4/real astrodynamics — no TLEs exist for satellites that
// don't exist yet. This is a mock, physically-plausible sun-synchronous LEO model.

const EARTH_RADIUS_KM = 6371
const MU_EARTH = 398600.4418 // km^3/s^2, standard gravitational parameter
const EARTH_ROT_DEG_PER_SEC = 360 / 86164.0905 // sidereal day

const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

// Fixed at module load — every satellite's clock starts "now," so the constellation
// always looks live relative to when the page opened.
const EPOCH_MS = Date.now()

const ALTITUDE_KM = 500
const INCLINATION_DEG = 97.4 // sun-synchronous-like, typical for EO smallsats

// Orbital elements per satellite — same altitude/inclination (uniform fleet, per
// spec 5.6.1), spread across distinct RAAN + phase so ground tracks don't overlap.
export const SAT_ORBITS = {
  'CS-1': { altitudeKm: ALTITUDE_KM, inclinationDeg: INCLINATION_DEG, raanDeg: 0,   m0Deg: 0   },
  'CS-2': { altitudeKm: ALTITUDE_KM, inclinationDeg: INCLINATION_DEG, raanDeg: 60,  m0Deg: 40  },
  'CS-3': { altitudeKm: ALTITUDE_KM, inclinationDeg: INCLINATION_DEG, raanDeg: 120, m0Deg: 200 },
  'CS-4': { altitudeKm: ALTITUDE_KM, inclinationDeg: INCLINATION_DEG, raanDeg: 180, m0Deg: 90  },
  'CS-5': { altitudeKm: ALTITUDE_KM, inclinationDeg: INCLINATION_DEG, raanDeg: 240, m0Deg: 300 },
  'CS-6': { altitudeKm: ALTITUDE_KM, inclinationDeg: INCLINATION_DEG, raanDeg: 300, m0Deg: 150 },
}

export const SAT_COLORS = {
  'CS-1': '#e6194b',
  'CS-2': '#3cb44b',
  'CS-3': '#4363d8',
  'CS-4': '#f58231',
  'CS-5': '#911eb4',
  'CS-6': '#42d4f4',
}

// Orbital period is identical for every satellite (same altitude) — used to size
// the default ground-track window to ~1 full revolution.
const A_KM = EARTH_RADIUS_KM + ALTITUDE_KM
const PERIOD_SEC = 2 * Math.PI * Math.sqrt((A_KM ** 3) / MU_EARTH)
export const PERIOD_MIN = PERIOD_SEC / 60

// Sensor geometry: FOV is the instantaneous (near-nadir) imaging swath; FOR is
// everything reachable this pass via slewing up to the max off-nadir angle.
export const FOV_HALF_WIDTH_KM = 8
export const FOR_MAX_OFFNADIR_DEG = 30

/** Earth-central angle → ground distance (km) for a given off-nadir look angle, via the standard satellite-geometry triangle (law of sines). Returns null past the horizon. */
export function groundOffsetForNadirAngle(offNadirDeg, altitudeKm) {
  const r = EARTH_RADIUS_KM + altitudeKm
  const etaRad = offNadirDeg * DEG2RAD
  const ratio = (r / EARTH_RADIUS_KM) * Math.sin(etaRad)
  if (ratio > 1) return null
  const lambdaRad = Math.asin(ratio) - etaRad
  return EARTH_RADIUS_KM * lambdaRad
}

export const FOR_HALF_WIDTH_KM = groundOffsetForNadirAngle(FOR_MAX_OFFNADIR_DEG, ALTITUDE_KM)

function wrapLon(lon) {
  return ((lon + 180) % 360 + 360) % 360 - 180
}

/** Sub-satellite point at an absolute time (ms since epoch). Longitude is continuous/unwrapped — callers wrap it at render time so ground tracks don't jump at the antimeridian. */
function subPointRaw(satId, timeMs) {
  const orb = SAT_ORBITS[satId]
  if (!orb) return null

  const a = EARTH_RADIUS_KM + orb.altitudeKm
  const n = Math.sqrt(MU_EARTH / (a * a * a)) // mean motion, rad/s
  const tSec = (timeMs - EPOCH_MS) / 1000
  const u = (orb.m0Deg * DEG2RAD) + n * tSec // argument of latitude (circular orbit ⇒ = mean/true anomaly)

  const iRad = orb.inclinationDeg * DEG2RAD
  const latRad = Math.asin(Math.sin(iRad) * Math.sin(u))

  // Longitude traveled since the ascending node, in the orbital-plane frame.
  const deltaLambdaRad = Math.atan2(Math.cos(iRad) * Math.sin(u), Math.cos(u))

  // Earth-fixed longitude: node longitude at epoch, plus travel since the node,
  // minus how far the Earth has spun underneath since epoch.
  const earthRotRad = (EARTH_ROT_DEG_PER_SEC * tSec) * DEG2RAD
  const lonRad = (orb.raanDeg * DEG2RAD) + deltaLambdaRad - earthRotRad

  return { lat: latRad * RAD2DEG, lon: lonRad * RAD2DEG }
}

export function currentPosition(satId, date = new Date()) {
  const p = subPointRaw(satId, date.getTime())
  return p ? { lat: p.lat, lon: wrapLon(p.lon) } : null
}

/** Initial bearing (deg, 0=N/90=E) from point A to point B — standard spherical formula. */
function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * DEG2RAD, φ2 = lat2 * DEG2RAD
  const Δλ = (lon2 - lon1) * DEG2RAD
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * RAD2DEG + 360) % 360
}

/** Offset a lat/lon by a bearing + distance (km) — flat-earth approx, fine for the small (≤ a few hundred km) offsets used here. */
function offsetByBearing(lat, lon, bearingDegVal, distKm) {
  const rad = bearingDegVal * DEG2RAD
  const dNorthKm = distKm * Math.cos(rad)
  const dEastKm  = distKm * Math.sin(rad)
  const dLat = dNorthKm / 111.32
  const dLon = dEastKm / (111.32 * Math.cos(lat * DEG2RAD))
  return { lat: lat + dLat, lon: lon + dLon }
}

function sampleTrack(satId, { startMin = -0.08 * PERIOD_MIN, endMin = 0.92 * PERIOD_MIN, stepSec = 30 } = {}) {
  const now = Date.now()
  const startMs = now + startMin * 60000
  const endMs   = now + endMin * 60000
  const samples = []
  for (let t = startMs; t <= endMs; t += stepSec * 1000) {
    const p = subPointRaw(satId, t)
    samples.push({ t, lat: p.lat, lon: p.lon })
  }
  for (let idx = 0; idx < samples.length; idx++) {
    const a = samples[idx]
    const b = samples[idx + 1] || samples[idx - 1]
    a.heading = idx < samples.length - 1
      ? bearingDeg(a.lat, a.lon, b.lat, b.lon)
      : bearingDeg(b.lat, b.lon, a.lat, a.lon)
  }
  return samples
}

/** Group continuous/unwrapped samples into antimeridian-safe runs — each run shares one 360°-wrap "bucket," so it can be rendered directly without any coordinate jump. */
function splitSegments(samples) {
  const segments = []
  let current = []
  let bucket = null
  for (const s of samples) {
    const b = Math.floor((s.lon + 180) / 360)
    if (bucket === null) bucket = b
    if (b !== bucket) {
      segments.push({ bucket, points: current })
      current = []
      bucket = b
    }
    current.push(s)
  }
  if (current.length) segments.push({ bucket, points: current })
  return segments
}

function wrapWithBucket(lon, bucket) {
  return lon - bucket * 360
}

/** Build all map-ready GeoJSON features for one satellite: ground track, FOV ribbon, FOR ribbon, and current position. Handles antimeridian crossings by splitting into multiple features. */
export function buildOrbitFeatures(satId, opts) {
  const samples = sampleTrack(satId, opts)
  const segments = splitSegments(samples)

  const trackFeatures = []
  const fovFeatures = []
  const forFeatures = []

  const color = SAT_COLORS[satId]

  for (const { bucket, points } of segments) {
    if (points.length < 2) continue
    const wrapPt = p => [wrapWithBucket(p.lon, bucket), p.lat]

    trackFeatures.push({
      type: 'Feature',
      properties: { satelliteId: satId, color },
      geometry: { type: 'LineString', coordinates: points.map(wrapPt) },
    })

    const ribbon = (halfWidthKm) => {
      const left  = points.map(p => offsetByBearing(p.lat, p.lon, p.heading + 90, halfWidthKm))
      const right = points.map(p => offsetByBearing(p.lat, p.lon, p.heading - 90, halfWidthKm))
      const ring = [...left.map(wrapPt), ...right.slice().reverse().map(wrapPt), wrapPt(left[0])]
      return {
        type: 'Feature',
        properties: { satelliteId: satId, color },
        geometry: { type: 'Polygon', coordinates: [ring] },
      }
    }

    fovFeatures.push(ribbon(FOV_HALF_WIDTH_KM))
    forFeatures.push(ribbon(FOR_HALF_WIDTH_KM))
  }

  const pos = currentPosition(satId)
  const positionFeature = pos ? {
    type: 'Feature',
    properties: { satelliteId: satId, color },
    geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] },
  } : null

  return { trackFeatures, fovFeatures, forFeatures, positionFeature }
}
