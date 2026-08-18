import { statusMeta, relativeFromNow, nextMilestone } from '../lib/tasking.js'
import styles from './TaskingCard.module.css'

const MILESTONE_LABEL = {
  requestedAt: 'Requested', taskedAt: 'Capture', captureAt: 'Capture',
  downlinkAt: 'Downlink', telemetryEtaAt: 'Telemetry', processingCompleteAt: 'Processing',
  availableAt: 'Available',
}

function milestoneLabel(task) {
  const t = task.timestamps
  const key = t.availableAt ? 'availableAt'
    : t.processingCompleteAt ? 'processingCompleteAt'
    : t.telemetryEtaAt ? 'telemetryEtaAt'
    : t.downlinkAt ? 'downlinkAt'
    : t.captureAt ? 'captureAt'
    : t.taskedAt ? 'taskedAt' : 'requestedAt'
  return MILESTONE_LABEL[key]
}

export default function TaskingCard({ task, isHovered, isSelected, onOpen, onMouseEnter, onMouseLeave }) {
  const meta = statusMeta(task.status)
  const milestone = nextMilestone(task)

  return (
    <div
      className={[styles.card, isHovered ? styles.cardHovered : '', isSelected ? styles.cardSelected : ''].filter(Boolean).join(' ')}
      onClick={() => onOpen(task)}
      onMouseEnter={() => onMouseEnter?.(task.id)}
      onMouseLeave={() => onMouseLeave?.()}
    >
      <div className={styles.topRow}>
        <span className={styles.satChip}>{task.satelliteId || '—'}</span>
        <span className={styles.badge} style={{ background: `${meta.color}22`, color: meta.color, borderColor: `${meta.color}66` }}>
          {meta.label}
        </span>
      </div>

      <div className={styles.taskIdHeadline}>{task.id}</div>

      <div className={styles.bottomRow}>
        <span className={styles.milestone}>
          {milestoneLabel(task)} <strong>{relativeFromNow(milestone)}</strong>
        </span>
        <div className={styles.miniStats}>
          {task.cloudCoverPct != null && <span className={styles.miniStat}>☁ {task.cloudCoverPct}%</span>}
          {task.resolutionM != null && <span className={styles.miniStat}>{task.resolutionM}m</span>}
        </div>
      </div>
    </div>
  )
}
