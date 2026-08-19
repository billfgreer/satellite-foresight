import { useState } from 'react'
import { createPortal } from 'react-dom'
import { buildMockStacItem, stacItemUrl } from '../lib/stac.js'
import styles from './StacItemModal.module.css'

function Row({ label, value }) {
  if (value == null || value === '') return null
  return (
    <div className={styles.row}>
      <span className={styles.rowKey}>{label}</span>
      <span className={styles.rowVal}>{value}</span>
    </div>
  )
}

export default function StacItemModal({ task, onClose }) {
  const [showRaw, setShowRaw] = useState(false)
  const item = buildMockStacItem(task)
  if (!item) return null

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div>
            <div className={styles.badge}>STAC Item</div>
            <div className={styles.itemId}>{item.id}</div>
            <div className={styles.url}>{stacItemUrl(task)}</div>
          </div>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <div className={styles.sectionLabel}>Properties</div>
          <div className={styles.group}>
            <Row label="Collection" value={item.collection} />
            <Row label="Datetime (UTC)" value={new Date(item.properties.datetime).toISOString()} />
            <Row label="Cloud cover" value={`${item.properties['eo:cloud_cover']}%`} />
            <Row label="Off-nadir" value={`${item.properties['view:off_nadir']}°`} />
            <Row label="GSD" value={`${item.properties.gsd}m`} />
            <Row label="Platform" value={item.properties.platform} />
            <Row label="Tasking ID" value={item.properties['sf:tasking_id']} />
            <Row label="BBox" value={item.bbox.map(n => n.toFixed(4)).join(', ')} />
          </div>

          <div className={styles.sectionLabel}>Assets</div>
          <div className={styles.assetList}>
            {Object.entries(item.assets).map(([key, asset]) => (
              <div key={key} className={styles.assetChip} title={asset.href}>
                <span className={styles.assetName}>{asset.title}</span>
                <span className={styles.assetExt}>{asset.type.split('/')[1]?.split(';')[0]?.toUpperCase()}</span>
              </div>
            ))}
          </div>
          <div className={styles.mockNote}>
            Mock catalog — Satellite Foresight doesn't operate a real STAC API yet. Asset links are illustrative only.
          </div>

          <button className={styles.rawToggle} onClick={() => setShowRaw(v => !v)}>
            <span className={styles.rawToggleArrow}>{showRaw ? '▼' : '▶'}</span>
            Raw STAC JSON
          </button>
          {showRaw && <pre className={styles.rawJson}>{JSON.stringify(item, null, 2)}</pre>}
        </div>
      </div>
    </div>,
    document.body
  )
}
