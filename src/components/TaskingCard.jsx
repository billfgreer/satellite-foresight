import { statusMeta, relativeFromNow, formatLocal, TIMELINE_STEPS } from '../lib/tasking.js'
import { formatAtOffset } from '../lib/feasibility.js'
import { SAT_COLORS, SAT_TEXT_COLORS } from '../lib/orbits.js'
import styles from './TaskingCard.module.css'

const cloudColor = pct => pct <= 15 ? '#22c55e' : pct <= 35 ? '#f59e0b' : '#ef4444'
const nadirColor = deg => deg <= 10 ? '#22c55e' : deg <= 20 ? '#84cc16' : '#f59e0b'

export default function TaskingCard({ task, isHovered, isSelected, onOpen, onMouseEnter, onMouseLeave }) {
  const meta = statusMeta(task.status)
  const satBg = task.satelliteId ? SAT_COLORS[task.satelliteId] : null
  const satFg = task.satelliteId ? SAT_TEXT_COLORS[task.satelliteId] : null

  // Curated seed locations carry a real IANA timezone; feasibility-created
  // custom requests only have an approximate UTC offset.
  const formatTime = iso => task.timeZone
    ? formatLocal(iso, task.timeZone)
    : formatAtOffset(iso, task.utcOffsetHours ?? 0)

  const steps = TIMELINE_STEPS.filter(s => task.timestamps[s.key])

  return (
    <div
      className={[styles.card, isHovered ? styles.cardHovered : '', isSelected ? styles.cardSelected : ''].filter(Boolean).join(' ')}
      onClick={() => onOpen(task)}
      onMouseEnter={() => onMouseEnter?.(task.id)}
      onMouseLeave={() => onMouseLeave?.()}
    >
      <div className={styles.topRow}>
        <span className={styles.satChip} style={satBg ? { background: satBg, color: satFg } : undefined}>
          {task.satelliteId || 'Unassigned'}
        </span>
        <span className={styles.badge} style={{ background: `${meta.color}22`, color: meta.color, borderColor: `${meta.color}66` }}>
          {meta.label}
        </span>
        {task.confidence && <span className={styles.confidence}>Confidence: <strong>{task.confidence}</strong></span>}
      </div>

      <div className={styles.taskIdHeadline}>{task.id}</div>
      <div className={styles.coords}>{task.center[1].toFixed(3)}, {task.center[0].toFixed(3)}</div>

      {task.status === 'Delayed' && task.note && (
        <div className={styles.delayNote}>⚠ {task.note}</div>
      )}

      <div className={styles.timeline}>
        {steps.map(s => (
          <div key={s.key} className={styles.timelineRow}>
            <span className={styles.timelineLabel}>{s.label}</span>
            <span className={styles.timelineTime}>{formatTime(task.timestamps[s.key])}</span>
            <span className={styles.timelineRel}>{relativeFromNow(task.timestamps[s.key])}</span>
          </div>
        ))}
      </div>

      {(task.cloudCoverPct != null || task.nadirDeg != null || task.resolutionM != null) && (
        <div className={styles.statsRow}>
          {task.cloudCoverPct != null && (
            <span className={styles.stat} style={{ color: cloudColor(task.cloudCoverPct) }}>☁ <strong>{task.cloudCoverPct}%</strong></span>
          )}
          {task.nadirDeg != null && (
            <span className={styles.stat} style={{ color: nadirColor(task.nadirDeg) }}>Off-nadir <strong>{task.nadirDeg}°</strong></span>
          )}
          {task.resolutionM != null && (
            <span className={styles.stat}>Resolution <strong>{task.resolutionM}m GSD</strong></span>
          )}
        </div>
      )}

      {task.note && task.status !== 'Delayed' && (
        <div className={styles.metaNote}>{task.note}</div>
      )}

      {task.imageId && (
        <div className={styles.imageIdRow}>Delivered as <span className={styles.mono}>{task.imageId}</span></div>
      )}
    </div>
  )
}
