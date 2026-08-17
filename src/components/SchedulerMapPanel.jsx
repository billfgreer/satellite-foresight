import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MAPLIBRE_STYLE } from '../lib/constants.js'
import { bboxToPolygon, statusMeta } from '../lib/tasking.js'
import { SAT_ORBITS, SAT_COLORS, buildOrbitFeatures } from '../lib/orbits.js'
import styles from './SchedulerMapPanel.module.css'

const SOURCE_ID = 'tasking-areas'
const SAT_IDS = Object.keys(SAT_ORBITS)

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

export default function SchedulerMapPanel({ tasks, hoveredId, selectedId, onTaskClick, onHoverEnter, onHoverLeave }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const initialised  = useRef(false)
  const tasksRef     = useRef(tasks)
  const onClickRef   = useRef(onTaskClick)

  const [enabledSats, setEnabledSats] = useState(() => Object.fromEntries(SAT_IDS.map(id => [id, true])))
  const [showTrack, setShowTrack]     = useState(true)
  const [showFov, setShowFov]         = useState(true)
  const [showFor, setShowFor]         = useState(true)
  const enabledRef = useRef({ enabledSats, showTrack, showFov, showFor })
  useEffect(() => {
    enabledRef.current = { enabledSats, showTrack, showFov, showFor }
  }, [enabledSats, showTrack, showFov, showFor])

  useEffect(() => { tasksRef.current = tasks }, [tasks])
  useEffect(() => { onClickRef.current = onTaskClick }, [onTaskClick])

  const refreshOrbits = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
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

      refreshOrbits()

      map.on('click', 'ta-fill', e => {
        const f = e.features?.[0]
        const task = tasksRef.current.find(t => t.id === f?.properties.id)
        if (task) onClickRef.current?.(task)
      })
      map.on('mouseenter', 'ta-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'ta-fill', () => { map.getCanvas().style.cursor = '' })

      // Fit to all tasking areas on first load
      if (tasksRef.current.length) {
        const lngs = tasksRef.current.flatMap(t => [t.bbox[0], t.bbox[2]])
        const lats = tasksRef.current.flatMap(t => [t.bbox[1], t.bbox[3]])
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 80, duration: 0, maxZoom: 6 }
        )
      }
    })

    const interval = setInterval(refreshOrbits, ORBIT_REFRESH_MS)

    return () => {
      clearInterval(interval)
      map.remove()
      mapRef.current = null
      initialised.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const update = () => { map.getSource(SOURCE_ID)?.setData(buildGeoJSON(tasks)) }
    if (map.isStyleLoaded()) update()
    else map.once('load', update)
  }, [tasks])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.setFilter('ta-hover', ['==', 'id', hoveredId || ''])
  }, [hoveredId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    map.setFilter('ta-selected', ['==', 'id', selectedId || ''])
  }, [selectedId])

  // Re-render orbit overlays immediately whenever a toggle changes (don't wait for the timer).
  useEffect(() => { refreshOrbits() }, [enabledSats, showTrack, showFov, showFor, refreshOrbits])

  function toggleSat(satId) {
    setEnabledSats(prev => ({ ...prev, [satId]: !prev[satId] }))
  }

  return (
    <div className={styles.wrap}>
      <div ref={containerRef} className={styles.map} />

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
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#FFE000' }} />Pending</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#00C8D7' }} />In Flight</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#22c55e' }} />Delivered</span>
        <span className={styles.legendItem}><span className={styles.dot} style={{ background: '#f2994a' }} />Delayed</span>
      </div>
    </div>
  )
}
