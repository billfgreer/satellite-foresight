import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAPLIBRE_STYLE } from '../lib/constants.js'
import { bboxToPolygon, statusMeta } from '../lib/tasking.js'
import { SAT_ORBITS, SAT_COLORS, buildOrbitFeatures } from '../lib/orbits.js'
import { KSAT_STATIONS } from '../lib/groundStations.js'
import styles from './SchedulerMapPanel.module.css'

const SOURCE_ID = 'tasking-areas'
const MARKER_SOURCE_ID = 'tasking-area-centers'
const CANDIDATE_SOURCE_ID = 'candidate-area'
const KSAT_SOURCE_ID = 'ksat-stations'
const SAT_IDS = Object.keys(SAT_ORBITS)

const KSAT_GEOJSON = {
  type: 'FeatureCollection',
  features: KSAT_STATIONS.map(s => ({
    type: 'Feature',
    properties: { name: s.name },
    geometry: { type: 'Point', coordinates: s.center },
  })),
}

// Orbit overlays refresh on a timer rather than every render — LEO satellites
// move ~7.5 km/s, so a few seconds of staleness is invisible at world scale.
const ORBIT_REFRESH_MS = 20_000

const emptyFC = () => ({ type: 'FeatureCollection', features: [] })

function buildGeoJSON(tasks) {
  return {
    type: 'FeatureCollection',
    features: tasks.map(t => ({
      type: 'Feature',
      geometry: bboxToPolygon(t.bbox),
      properties: { id: t.id, color: statusMeta(t.status).color },
    })),
  }
}

// Circle layers need Point geometry — this is the always-visible marker dot
// counterpart to the true-scale squares above.
function buildMarkerGeoJSON(tasks) {
  return {
    type: 'FeatureCollection',
    features: tasks.map(t => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: t.center },
      properties: { id: t.id, color: statusMeta(t.status).color },
    })),
  }
}

function buildCandidateGeoJSON(bbox) {
  if (!bbox) return emptyFC()
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: bboxToPolygon(bbox), properties: {} }] }
}

export default function SchedulerMapPanel({
  tasks, hoveredId, selectedId, onTaskClick, onHoverEnter, onHoverLeave,
  placingRequest, onTogglePlacing, onMapClickForRequest, candidateBbox,
}) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const initialised  = useRef(false)
  // map.isStyleLoaded() flickers false whenever tiles are still streaming in —
  // not a reliable "ready" signal. This flips once, in the load handler below,
  // and stays true for the component's lifetime.
  const mapReadyRef  = useRef(false)
  const tasksRef     = useRef(tasks)
  const onClickRef   = useRef(onTaskClick)
  const placingRef   = useRef(placingRequest)
  const onMapClickForRequestRef = useRef(onMapClickForRequest)

  const [enabledSats, setEnabledSats] = useState(() => Object.fromEntries(SAT_IDS.map(id => [id, true])))
  const [showTrack, setShowTrack]     = useState(true)
  const [showFov, setShowFov]         = useState(true)
  const [showFor, setShowFor]         = useState(true)
  const [showKsat, setShowKsat]       = useState(true)
  const enabledRef = useRef({ enabledSats, showTrack, showFov, showFor })
  useEffect(() => {
    enabledRef.current = { enabledSats, showTrack, showFov, showFor }
  }, [enabledSats, showTrack, showFov, showFor])

  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { onClickRef.current = onTaskClick }, [onTaskClick])
  useEffect(() => { placingRef.current = placingRequest }, [placingRequest])
  useEffect(() => { onMapClickForRequestRef.current = onMapClickForRequest }, [onMapClickForRequest])

  useEffect(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = placingRequest ? 'crosshair' : ''
  }, [placingRequest])

  const refreshOrbits = useCallback(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    const { enabledSats: en, showTrack: st, showFov: sf, showFor: sr } = enabledRef.current

    const trackFC = emptyFC(), fovFC = emptyFC(), forFC = emptyFC(), posFC = emptyFC()
    for (const satId of SAT_IDS) {
      if (!en[satId]) continue
      const { trackFeatures, fovFeatures, forFeatures, positionFeature } = buildOrbitFeatures(satId)
      if (st) trackFC.features.push(...trackFeatures)
      if (sf) fovFC.features.push(...fovFeatures)
      if (sr) forFC.features.push(...forFeatures)
      if (positionFeature) posFC.features.push(positionFeature)
    }
    map.getSource('orbit-for')?.setData(forFC)
    map.getSource('orbit-fov')?.setData(fovFC)
    map.getSource('orbit-track')?.setData(trackFC)
    map.getSource('orbit-pos')?.setData(posFC)
  }, [])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAPLIBRE_STYLE,
      center: [0, 15],
      zoom: 2,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    mapRef.current = map

    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: buildGeoJSON(tasksRef.current) })
      map.addSource(MARKER_SOURCE_ID, { type: 'geojson', data: buildMarkerGeoJSON(tasksRef.current) })

      map.addLayer({
        id: 'ta-fill', type: 'fill', source: SOURCE_ID,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .28 },
      })
      map.addLayer({
        id: 'ta-line', type: 'line', source: SOURCE_ID,
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.75 },
      })
      map.addLayer({
        id: 'ta-hover', type: 'line', source: SOURCE_ID,
        filter: ['==', 'id', ''],
        paint: { 'line-color': '#ffffff', 'line-width': 3 },
      })
      map.addLayer({
        id: 'ta-selected', type: 'fill', source: SOURCE_ID,
        filter: ['==', 'id', ''],
        paint: { 'fill-color': 'rgba(255,255,255,.35)', 'fill-opacity': 1 },
      })

      // A 5.2km square is sub-pixel at world zoom — this fixed-size marker dot
      // guarantees every tasking area is actually visible on first load, not
      // just once you zoom in on it.
      map.addLayer({
        id: 'ta-marker', type: 'circle', source: MARKER_SOURCE_ID,
        paint: {
          'circle-radius': 5,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      })

      // ── Orbit overlays — inserted before the tasking-area layers so scheduled
      // collections stay visually on top of the orbital context underneath them.
      map.addSource('orbit-for', { type: 'geojson', data: emptyFC() })
      map.addSource('orbit-fov', { type: 'geojson', data: emptyFC() })
      map.addSource('orbit-track', { type: 'geojson', data: emptyFC() })
      map.addSource('orbit-pos', { type: 'geojson', data: emptyFC() })

      map.addLayer({
        id: 'orbit-for-fill', type: 'fill', source: 'orbit-for',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .09 },
      }, 'ta-fill')
      map.addLayer({
        id: 'orbit-for-line', type: 'line', source: 'orbit-for',
        paint: { 'line-color': ['get', 'color'], 'line-width': .75, 'line-opacity': .5, 'line-dasharray': [2, 2] },
      }, 'ta-fill')
      map.addLayer({
        id: 'orbit-fov-fill', type: 'fill', source: 'orbit-fov',
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': .3 },
      }, 'ta-fill')
      map.addLayer({
        id: 'orbit-track-line', type: 'line', source: 'orbit-track',
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.5 },
      }, 'ta-fill')
      map.addLayer({
        id: 'orbit-pos-halo', type: 'circle', source: 'orbit-pos',
        paint: { 'circle-radius': 8, 'circle-color': ['get', 'color'], 'circle-opacity': .25 },
      }, 'ta-fill')
      map.addLayer({
        id: 'orbit-pos-dot', type: 'circle', source: 'orbit-pos',
        paint: { 'circle-radius': 4, 'circle-color': ['get', 'color'], 'circle-stroke-width': 1.5, 'circle-stroke-color': '#fff' },
      }, 'ta-fill')
      map.addLayer({
        id: 'orbit-pos-label', type: 'symbol', source: 'orbit-pos',
        layout: {
          'text-field': ['get', 'satelliteId'], 'text-size': 10, 'text-offset': [0, -1.1],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
      }, 'ta-fill')

      // ── KSAT ground stations — static reference layer for where a satellite
      // would actually hand off imagery during the Downlink stage.
      map.addSource(KSAT_SOURCE_ID, { type: 'geojson', data: KSAT_GEOJSON })
      map.addLayer({
        id: 'ksat-dot', type: 'circle', source: KSAT_SOURCE_ID,
        paint: {
          'circle-radius': 5, 'circle-color': '#111111',
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff',
        },
      })
      map.addLayer({
        id: 'ksat-ring', type: 'circle', source: KSAT_SOURCE_ID,
        paint: { 'circle-radius': 9, 'circle-color': 'transparent', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#111111', 'circle-stroke-opacity': .5 },
      })
      map.addLayer({
        id: 'ksat-label', type: 'symbol', source: KSAT_SOURCE_ID,
        layout: {
          'text-field': ['concat', 'KSAT · ', ['get', 'name']], 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': '#111111', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
      })

      // ── Candidate tasking request — the square a user is currently placing/
      // evaluating. Drawn on top of everything else so it's unmistakable.
      map.addSource(CANDIDATE_SOURCE_ID, { type: 'geojson', data: emptyFC() })
      map.addLayer({
        id: 'candidate-fill', type: 'fill', source: CANDIDATE_SOURCE_ID,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': .15 },
      })
      map.addLayer({
        id: 'candidate-line', type: 'line', source: CANDIDATE_SOURCE_ID,
        paint: { 'line-color': '#111111', 'line-width': 2.5, 'line-dasharray': [1.5, 1.5] },
      })

      refreshOrbits()

      const handleTaClick = e => {
        if (placingRef.current) return // placing mode takes over all clicks — see generic handler below
        const f = e.features?.[0]
        const task = tasksRef.current.find(t => t.id === f?.properties.id)
        if (task) onClickRef.current?.(task)
      }
      map.on('click', 'ta-fill', handleTaClick)
      map.on('click', 'ta-marker', handleTaClick)
      map.on('mouseenter', 'ta-fill', () => { if (!placingRef.current) map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'ta-fill', () => { if (!placingRef.current) map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'ta-marker', () => { if (!placingRef.current) map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'ta-marker', () => { if (!placingRef.current) map.getCanvas().style.cursor = '' })

      const ksatPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: true, offset: 10 })
      map.on('click', 'ksat-dot', e => {
        if (placingRef.current) return
        const name = e.features?.[0]?.properties?.name
        if (!name) return
        ksatPopup.setLngLat(e.features[0].geometry.coordinates).setHTML(`<strong>KSAT ground station</strong><br/>${name}`).addTo(map)
      })
      map.on('mouseenter', 'ksat-dot', () => { if (!placingRef.current) map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'ksat-dot', () => { if (!placingRef.current) map.getCanvas().style.cursor = '' })

      // Generic click — only acts while placing a new tasking request, regardless
      // of what's underneath the click (an empty spot or an existing tasking area).
      map.on('click', e => {
        if (!placingRef.current) return
        onMapClickForRequestRef.current?.(e.lngLat)
      })

      // Fit to all tasking areas on first load
      if (tasksRef.current.length) {
        const lngs = tasksRef.current.flatMap(t => [t.bbox[0], t.bbox[2]])
        const lats = tasksRef.current.flatMap(t => [t.bbox[1], t.bbox[3]])
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 80, duration: 0, maxZoom: 6 }
        )
      }

      mapReadyRef.current = true
    })

    const interval = setInterval(refreshOrbits, ORBIT_REFRESH_MS)

    return () => {
      clearInterval(interval)
      map.remove()
      mapRef.current = null
      mapReadyRef.current = false
      initialised.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => {
      map.getSource(SOURCE_ID)?.setData(buildGeoJSON(tasks))
      map.getSource(MARKER_SOURCE_ID)?.setData(buildMarkerGeoJSON(tasks))
    }
    if (mapReadyRef.current) update()
    else map.once('load', update)
  }, [tasks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    const vis = showKsat ? 'visible' : 'none'
    for (const id of ['ksat-dot', 'ksat-ring', 'ksat-label']) {
      try { map.setLayoutProperty(id, 'visibility', vis) } catch {}
    }
  }, [showKsat])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => { map.getSource(CANDIDATE_SOURCE_ID)?.setData(buildCandidateGeoJSON(candidateBbox)) }
    if (mapReadyRef.current) update()
    else map.once('load', update)
  }, [candidateBbox])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    map.setFilter('ta-hover', ['==', 'id', hoveredId || ''])
  }, [hoveredId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    map.setFilter('ta-selected', ['==', 'id', selectedId || ''])
  }, [selectedId])

  // Selecting a task (card click or map click) flies the map to its AOI.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current || !selectedId) return
    const task = tasksRef.current.find(t => t.id === selectedId)
    if (!task?.bbox) return
    const [w, s, e, n] = task.bbox
    map.fitBounds([[w, s], [e, n]], { padding: 120, maxZoom: 11, duration: 800 })
  }, [selectedId])

  // Re-render orbit overlays immediately whenever a toggle changes (don't wait for the timer).
  useEffect(() => { refreshOrbits() }, [enabledSats, showTrack, showFov, showFor, refreshOrbits])

  function toggleSat(satId) {
    setEnabledSats(prev => ({ ...prev, [satId]: !prev[satId] }))
  }

  return (
    <div className={styles.wrap}>
      <div ref={containerRef} className={styles.map} />

      <div className={styles.requestControl}>
        <button
          className={`${styles.requestBtn} ${placingRequest ? styles.requestBtnActive : ''}`}
          onClick={onTogglePlacing}
        >
          {placingRequest ? '✕ Cancel' : '＋ Add Tasking Request'}
        </button>
        {placingRequest && <div className={styles.requestHint}>Click anywhere on the map to place a 5×5km request</div>}
      </div>

      <div className={styles.orbitPanel}>
        <div className={styles.orbitPanelTitle}>Constellation Overlays</div>
        <div className={styles.orbitLayerToggles}>
          <label className={styles.orbitCheck}>
            <input type="checkbox" checked={showTrack} onChange={() => setShowTrack(v => !v)} />
            Ground track
          </label>
          <label className={styles.orbitCheck}>
            <input type="checkbox" checked={showFov} onChange={() => setShowFov(v => !v)} />
            Field of view
          </label>
          <label className={styles.orbitCheck}>
            <input type="checkbox" checked={showFor} onChange={() => setShowFor(v => !v)} />
            Field of regard
          </label>
          <label className={styles.orbitCheck}>
            <input type="checkbox" checked={showKsat} onChange={() => setShowKsat(v => !v)} />
            KSAT ground stations
          </label>
        </div>
        <div className={styles.orbitSatList}>
          {SAT_IDS.map(satId => (
            <label key={satId} className={styles.orbitSatRow}>
              <input type="checkbox" checked={!!enabledSats[satId]} onChange={() => toggleSat(satId)} />
              <span className={styles.orbitSwatch} style={{ background: SAT_COLORS[satId] }} />
              {satId}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#FFE000' }} />Backlog</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#FF1870' }} />Tasked</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#F97316' }} />Captured, processing</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#00C8D7' }} />Delivered</span>
      </div>
    </div>
  )
}
