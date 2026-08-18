import { useState, useMemo, useCallback } from 'react'
import Header from './components/Header.jsx'
import SchedulerMapPanel from './components/SchedulerMapPanel.jsx'
import SchedulerPanel from './components/SchedulerPanel.jsx'
import TaskingCallout from './components/TaskingCallout.jsx'
import TaskingFeasibilityPanel from './components/TaskingFeasibilityPanel.jsx'
import { MOCK_TASKS, squareBbox, REQUEST_AREA_KM } from './lib/tasking.js'
import { findOpportunities, createTaskFromOpportunity } from './lib/feasibility.js'
import styles from './App.module.css'

let customTaskSeq = 9000 // separate range from the seeded RAW_TASKS seq numbers

export default function App() {
  const [tasks, setTasks]         = useState(MOCK_TASKS)
  const [hoveredId, setHoveredId] = useState(null)
  const [openTask, setOpenTask]   = useState(null)

  const [placingRequest, setPlacingRequest] = useState(false)
  const [candidate, setCandidate]           = useState(null) // { center, bbox }

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
