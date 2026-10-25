import { useState, useMemo, useCallback, useEffect } from 'react'
import Header from './components/Header.jsx'
import SchedulerMapPanel from './components/SchedulerMapPanel.jsx'
import SchedulerPanel from './components/SchedulerPanel.jsx'
import TaskingCallout from './components/TaskingCallout.jsx'
import TaskingFeasibilityPanel from './components/TaskingFeasibilityPanel.jsx'
import { MOCK_TASKS, squareBbox, REQUEST_AREA_KM } from './lib/tasking.js'
import { findOpportunities, createTaskFromOpportunity } from './lib/feasibility.js'
import styles from './App.module.css'

let customTaskSeq = 9000 // separate range from the seeded RAW_TASKS seq numbers

// Foresight has no backend of its own, so a task "sent" from another app
// (e.g. common-space-accounts, once a tasking request is approved) arrives
// as a base64-encoded JSON blob in the `?import=` query param, decoded here
// on load. See common-space-accounts' supabase/functions/_shared/foresight.ts
// for the encoder and the exact Task shape this expects.
function decodeImportedTask(encoded) {
  try {
    const binary = atob(encoded)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const task = JSON.parse(json)
    if (
      !task ||
      typeof task.id !== 'string' ||
      !Array.isArray(task.center) ||
      !Array.isArray(task.bbox)
    ) {
      return null
    }
    return task
  } catch {
    return null
  }
}

export default function App() {
  const [tasks, setTasks]         = useState(MOCK_TASKS)
  const [hoveredId, setHoveredId] = useState(null)
  const [openTask, setOpenTask]   = useState(null)

  const [placingRequest, setPlacingRequest] = useState(false)
  const [candidate, setCandidate]           = useState(null) // { center, bbox }

  // One-time check for an imported task on initial load (see
  // decodeImportedTask above). Runs once; the `import` param is then
  // stripped from the URL so a refresh doesn't attempt to reimport it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get('import')
    if (encoded) {
      const task = decodeImportedTask(encoded)
      if (task) {
        setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]))
      }
      params.delete('import')
      const newSearch = params.toString()
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const opportunities = useMemo(
    () => candidate ? findOpportunities(candidate.center) : [],
    [candidate]
  )

  const handleMapClickForRequest = useCallback((lngLat) => {
    const center = [lngLat.lng, lngLat.lat]
    const bbox = squareBbox(center, REQUEST_AREA_KM)
    setCandidate({ center, bbox })
    setPlacingRequest(false)
  }, [])

  const handleClearCandidate = useCallback(() => setCandidate(null), [])

  const handleScheduleOpportunity = useCallback((opportunity) => {
    if (!candidate) return
    const newTask = createTaskFromOpportunity(opportunity, candidate.center, candidate.bbox, customTaskSeq++)
    setTasks(prev => [...prev, newTask])
    setCandidate(null)
  }, [candidate])

  return (
    <div className={styles.screen}>
      <Header />
      <div className={styles.body}>
        <SchedulerMapPanel
          tasks={tasks}
          hoveredId={hoveredId}
          selectedId={openTask?.id}
          onTaskClick={setOpenTask}
          onHoverEnter={setHoveredId}
          onHoverLeave={() => setHoveredId(null)}
          placingRequest={placingRequest}
          onTogglePlacing={() => setPlacingRequest(v => !v)}
          onMapClickForRequest={handleMapClickForRequest}
          candidateBbox={candidate?.bbox ?? null}
        />
        <SchedulerPanel
          tasks={tasks}
          hoveredId={hoveredId}
          selectedId={openTask?.id}
          onOpen={setOpenTask}
          onHoverEnter={setHoveredId}
          onHoverLeave={() => setHoveredId(null)}
        />
      </div>
      {openTask && <TaskingCallout task={openTask} onClose={() => setOpenTask(null)} />}
      {candidate && (
        <TaskingFeasibilityPanel
          candidate={candidate}
          opportunities={opportunities}
          existingTasks={tasks}
          onClose={handleClearCandidate}
          onSchedule={handleScheduleOpportunity}
        />
      )}
    </div>
  )
}
