// Mock STAC catalog — Satellite Foresight doesn't operate a real STAC API yet
// (no imagery has actually been captured — the whole app is a mock). Once a
// task is Delivered, this builds a plausible STAC Item record for it, so the
// "view in the catalog" link has something real-looking to show.

const CATALOG_BASE = 'https://stac.satelliteforesight.example'
export const COLLECTION_ID = 'satellite-foresight-optical'

export function buildMockStacItem(task) {
  if (!task.imageId) return null

  const [w, s, e, n] = task.bbox
  return {
    type: 'Feature',
    stac_version: '1.0.0',
    id: task.imageId,
    collection: COLLECTION_ID,
    bbox: task.bbox,
    geometry: {
      type: 'Polygon',
      coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
    },
    properties: {
      datetime: task.timestamps.captureAt,
      'eo:cloud_cover': task.cloudCoverPct,
      'view:off_nadir': task.nadirDeg,
      gsd: task.resolutionM,
      platform: task.satelliteId,
      instruments: ['cs-optical-a'],
      'proj:epsg': 4326,
      'sf:tasking_id': task.id,
    },
    assets: {
      thumbnail: { href: `${CATALOG_BASE}/assets/${task.imageId}/thumb.png`, type: 'image/png', title: 'Thumbnail' },
      visual: { href: `${CATALOG_BASE}/assets/${task.imageId}/visual.tif`, type: 'image/tiff; application=geotiff; profile=cloud-optimized', title: 'Visual COG' },
      data: { href: `${CATALOG_BASE}/assets/${task.imageId}/data.tif`, type: 'image/tiff; application=geotiff; profile=cloud-optimized', title: 'Analytic COG' },
    },
    links: [
      { rel: 'self', href: `${CATALOG_BASE}/collections/${COLLECTION_ID}/items/${task.imageId}` },
      { rel: 'collection', href: `${CATALOG_BASE}/collections/${COLLECTION_ID}` },
      { rel: 'parent', href: `${CATALOG_BASE}/collections/${COLLECTION_ID}` },
    ],
  }
}

export function stacItemUrl(task) {
  if (!task.imageId) return null
  return `${CATALOG_BASE}/collections/${COLLECTION_ID}/items/${task.imageId}`
}
