import { createPortal } from 'react-dom'
import { relativeFromNow } from '../lib/tasking.js'
import { SAT_COLORS, SAT_TEXT_COLORS } from '../lib/orbits.js'
import { findConflicts, averageCloudCover, approxUtcOffsetHours, formatAtOffset } from '../lib/feasibility.js'
import styles from './TaskingFeasibilityPanel.module.css'

function cloudColor(pct) {
  return pct <= 15 ? '#22c55e' : pct <= 35 ? '#f59e0b' : '#ef4444'
}

function OpportunityRow({ opportunity, offsetHours, conflicts, onSchedule }) {
  const bg = SAT_COLORS[opportunity.satelliteId]
  const fg = SAT_TEXT_COLORS[opportunity.satelliteId]
  return (
    <div className={styles.row}>
      <div className={styles.rowTop}>
        <span className={styles.satChip} style={{ background: bg, color: fg }}>{opportunity.satelliteId}</span>
        <div className={styles.timeBlock}>
          <span className={styles.time}>{formatAtOffset(opportunity.timeIso, offsetHours)}</span>
          <span className={styles.rel}>{relativeFromNow(opportunity.timeIso)}</span>
        </div>
        <button className={styles.scheduleBtn} onClick={() => onSchedule(opportunity)}>
          Schedule
        </button>
      </div>

      <div className={styles.statsRow}>
        <span className={styles.stat}>Off-nadir <strong>{opportunity.offNadirDeg}°</strong></span>
        <span className={styles.stat}>Resolution <strong>{opportunity.resolutionM}m GSD</strong></span>
        <span className={styles.stat} style={{ color: cloudColor(opportunity.cloudCoverPct) }}>
          ☁ <strong>{opportunity.cloudCoverPct}%</strong>
        </span>
        <span className={styles.stat}>Confidence <strong>{opportunity.confidence}</strong></span>
      </div>

      {conflicts.length > 0 && (
        <div className={styles.conflicts}>
          {conflicts.map((c, i) => (
            <div key={i} className={styles.conflictRow}>
              ⚠ {c.detail}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TaskingFeasibilityPanel({ candidate, opportunities, existingTasks, onClose, onSchedule }) {
  const [lon, lat] = candidate.center
  const offsetHours = approxUtcOffsetHours(lon)
  const avgCloud = averageCloudCover(opportunities)

  const rows = opportunities.map(o => ({
    opportunity: o,
    conflicts: findConflicts(o, existingTasks, candidate.bbox),
  }))
  const conflictCount = rows.filter(r => r.conflicts.length > 0).length

  return createPortal(
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Tasking Feasibility</div>
          <div className={styles.coords}>{lat.toFixed(3)}, {lon.toFixed(3)} · 5×5km request</div>
        </div>
        <button className={styles.close} onClick={onClose}>✕</button>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryStat}>
          <span className={styles.summaryVal}>{opportunities.length}</span>
          <span className={styles.summaryLabel}>opportunities in 4 days</span>
        </div>
        {avgCloud != null && (
          <div className={styles.summaryStat}>
            <span className={styles.summaryVal} style={{ color: cloudColor(avgCloud) }}>{avgCloud}%</span>
            <span className={styles.summaryLabel}>avg. cloud cover</span>
          </div>
        )}
        {conflictCount > 0 && (
          <div className={styles.summaryStat}>
            <span className={styles.summaryVal} style={{ color: '#ef4444' }}>{conflictCount}</span>
            <span className={styles.summaryLabel}>with conflicts</span>
          </div>
        )}
      </div>

      <div className={styles.list}>
        {opportunities.length === 0 && (
          <div className={styles.empty}>
            No satellite in the constellation can reach this location within the next 4 days.
          </div>
        )}
        {rows.map((r, i) => (
          <OpportunityRow
            key={i}
            opportunity={r.opportunity}
            offsetHours={offsetHours}
            conflicts={r.conflicts}
            onSchedule={onSchedule}
          />
        ))}
      </div>
    </div>,
    document.body
  )
}
