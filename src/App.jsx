import { useState } from 'react'
import Header from './components/Header.jsx'
import SchedulerMapPanel from './components/SchedulerMapPanel.jsx'
import SchedulerPanel from './components/SchedulerPanel.jsx'
import TaskingCallout from './components/TaskingCallout.jsx'
import { MOCK_TASKS } from './lib/tasking.js'
import styles from './App.module.css'

export default function App() {
  const [hoveredId, setHoveredId] = useState(null)
  const [openTask, setOpenTask]   = useState(null)

  return (
    <div className={styles.screen}>
      <Header />
      <div className={styles.body}>
        <SchedulerMapPanel
          tasks={MOCK_TASKS}
          hoveredId={hoveredId}
          selectedId={openTask?.id}
          onTaskClick={setOpenTask}
          onHoverEnter={setHoveredId}
          onHoverLeave={() => setHoveredId(null)}
        />
        <SchedulerPanel
          tasks={MOCK_TASKS}
          hoveredId={hoveredId}
          selectedId={openTask?.id}
          onOpen={setOpenTask}
          onHoverEnter={setHoveredId}
          onHoverLeave={() => setHoveredId(null)}
        />
      </div>
      {openTask && <TaskingCallout task={openTask} onClose={() => setOpenTask(null)} />}
    </div>
  )
}
