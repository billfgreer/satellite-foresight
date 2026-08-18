import { useState } from 'react'
import { createPortal } from 'react-dom'
import { statusMeta, relativeFromNow, formatLocal } from '../lib/tasking.js'
import { formatAtOffset } from '../lib/feasibility.js'
import styles from './TaskingCallout.module.css'

const STEPS = [
  { key: 'requestedAt',          label: 'Requested' },
  { key: 'taskedAt',             label: 'Tasked' },
  { key: 'captureAt',            label: 'Capture' },
  { key: 'downlinkAt',           label: 'Downlink' },
  { key: 'telemetryEtaAt',       label: 'Telemetry' },
  { key: 'processingCompleteAt', label: 'Processing complete' },
  { key: 'availableAt',          label: 'Available' },
]

function QualityBar({ label, value, pct, color }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {pct != null && (
        <div className={styles.statBar}>
          <div className={styles.statFill} style={{ width: `${Math.min(100, pct)}%`, background: color }} />
        </div>
      )}
    </div>
  )
}

export default function TaskingCallout({ task, onClose }) {
  const [alertOpen, setAlertOpen]   = useState(false)
  const [email, setEmail]           = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const meta = statusMeta(task.status)
  // Curated targets carry a real IANA timezone; feasibility-created custom
  // requests only have an approximate UTC offset (no real geocoding here).
  const formatTime = iso => task.timeZone
    ? formatLocal(iso, task.timeZone)
    : formatAtOffset(iso, task.utcOffsetHours ?? 0)

  function handleSubscribe(e) {
    e.preventDefault()
    if (!email.trim()) return
    // Mock only — no backend exists yet (spec 5.6.5 build note). Nothing is sent or stored.
    setSubscribed(true)
  }

  const cloudColor = task.cloudCoverPct == null ? '#94a3b8'
    : task.cloudCoverPct <= 15 ? '#22c55e'
    : task.cloudCoverPct <= 35 ? '#f59e0b' : '#ef4444'
  const nadirColor = task.nadirDeg == null ? '#94a3b8'
    : task.nadirDeg <= 10 ? '#22c55e'
    : task.nadirDeg <= 20 ? '#84cc16' : '#f59e0b'

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div>
            <div className={styles.taskId}>{task.id}</div>
            <div className={styles.eventName}>{task.eventName}</div>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>

          {/* Status + satellite + confidence */}
          <div className={styles.topRow}>
            <span className={styles.badge} style={{ background: `${meta.color}22`, color: meta.color, borderColor: `${meta.color}66` }}>
              {meta.label}
            </span>
            <span className={styles.satChip}>{task.satelliteId || 'Unassigned'}</span>
            {task.confidence && (
              <span className={styles.confidence}>
                Confidence: <strong>{task.confidence}</strong>
              </span>
            )}
          </div>

          {task.status === 'Delayed' && task.note && (
            <div className={styles.delayNote}>⚠ {task.note}</div>
          )}

          {/* Timeline */}
          <div className={styles.sectionLabel}>Timeline (target-local time)</div>
          <div className={styles.timeline}>
            {STEPS.filter(s => task.timestamps[s.key]).map(s => (
              <div key={s.key} className={styles.timelineRow}>
                <span className={styles.timelineLabel}>{s.label}</span>
                <span className={styles.timelineTime}>{formatTime(task.timestamps[s.key])}</span>
                <span className={styles.timelineRel}>{relativeFromNow(task.timestamps[s.key])}</span>
              </div>
            ))}
          </div>

          {/* Capture stats */}
          {(task.cloudCoverPct != null || task.nadirDeg != null || task.resolutionM != null) && (
            <>
              <div className={styles.sectionLabel}>Expected Capture Detail</div>
              <div className={styles.statsRow}>
                {task.cloudCoverPct != null && (
                  <QualityBar label="Cloud Cover" value={`${task.cloudCoverPct}%`} pct={task.cloudCoverPct} color={cloudColor} />
                )}
                {task.nadirDeg != null && (
                  <QualityBar label="Nadir Angle" value={`${task.nadirDeg}°`} pct={(task.nadirDeg / 30) * 100} color={nadirColor} />
                )}
                {task.resolutionM != null && (
                  <QualityBar label="Resolution" value={`${task.resolutionM}m GSD`} />
                )}
              </div>
            </>
          )}

          {/* Additional metadata */}
          {task.note && task.status !== 'Delayed' && (
            <div className={styles.metaNote}>{task.note}</div>
          )}

          {task.imageId && (
            <div className={styles.imageIdRow}>
              Delivered as <span className={styles.mono}>{task.imageId}</span> — now viewable in Results
            </div>
          )}

          {/* Alert me when available */}
          {task.status !== 'Delivered' && (
            <div className={styles.alertBox}>
              {!alertOpen && !subscribed && (
                <button className={styles.alertBtn} onClick={() => setAlertOpen(true)}>
                  🔔 Alert me when available
                </button>
              )}
              {alertOpen && !subscribed && (
                <form className={styles.alertForm} onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    required
                    placeholder="you@example.org"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className={styles.alertInput}
                  />
                  <button type="submit" className={styles.alertSubmit}>Notify me</button>
                </form>
              )}
              {subscribed && (
                <div className={styles.alertConfirm}>
                  ✓ We'll email {email} when {task.id} is delivered
                </div>
              )}
              <div className={styles.alertMockNote}>
                Demo only — no email is actually sent (no backend yet, see spec §5.6.5)
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
