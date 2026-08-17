import { useMemo, useState } from 'react'
import { STATUS_GROUPS, statusMeta, nextMilestone } from '../lib/tasking.js'
import TaskingCard from './TaskingCard.jsx'
import styles from './SchedulerPanel.module.css'

export default function SchedulerPanel({ tasks, hoveredId, selectedId, onOpen, onHoverEnter, onHoverLeave }) {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    const byGroup = filter === 'all' ? tasks : tasks.filter(t => statusMeta(t.status).group === filter)
    return [...byGroup].sort((a, b) => new Date(nextMilestone(a)) - new Date(nextMilestone(b)))
  }, [tasks, filter])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          Satellite Scheduler
          <span className={styles.count}>{tasks.length}</span>
        </div>
        <div className={styles.subtitle}>Every tasking area currently accepted across the constellation</div>
      </div>

      <div className={styles.filters}>
        {STATUS_GROUPS.map(g => (
          <button
            key={g.id}
            className={`${styles.chip} ${filter === g.id ? styles.chipActive : ''}`}
            onClick={() => setFilter(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {filtered.length === 0 && <div className={styles.empty}>No tasking areas in this filter.</div>}
        {filtered.map(task => (
          <TaskingCard
            key={task.id}
            task={task}
            isHovered={task.id === hoveredId}
            isSelected={task.id === selectedId}
            onOpen={onOpen}
            onMouseEnter={onHoverEnter}
            onMouseLeave={onHoverLeave}
          />
        ))}
      </div>
    </div>
  )
}
