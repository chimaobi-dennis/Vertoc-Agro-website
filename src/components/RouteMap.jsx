/*
 * A shipment's route on an OpenStreetMap map (Leaflet, no API key): origin,
 * the checkpoints dropped so far (the last one is "current"), and the
 * destination; a solid line for the travelled part, dashed for what is left.
 * Pass onPick to let staff click the map to place the next pin.
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { hasPoint } from '../lib/shipments'

const NIGERIA = [9.08, 8.68]

export default function RouteMap({ origin, destination, checkpoints = [], picked = null, delivered = false, onPick, className = 'h-72' }) {
  const el = useRef(null), map = useRef(null), layer = useRef(null)

  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' }).addTo(m)
    m.setView(NIGERIA, 6)
    layer.current = L.layerGroup().addTo(m); map.current = m
    // Modals and column layouts size the container after mount.
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => { ro.disconnect(); m.remove(); map.current = null }
  }, [])

  useEffect(() => {
    const m = map.current; if (!m || !onPick) return
    const h = e => onPick({ lat: Math.round(e.latlng.lat * 1e5) / 1e5, lng: Math.round(e.latlng.lng * 1e5) / 1e5 })
    m.on('click', h); m.getContainer().style.cursor = 'crosshair'
    return () => { m.off('click', h); if (map.current) map.current.getContainer().style.cursor = '' }
  }, [onPick])

  useEffect(() => {
    const m = map.current, g = layer.current; if (!m) return
    g.clearLayers()
    const pts = []
    const dot = (p, { label, fill, radius = 7, permanent = false }) => {
      const c = L.circleMarker([p.lat, p.lng], { radius, weight: 2, color: '#ffffff', fillColor: fill, fillOpacity: 1 }).addTo(g)
      if (label) c.bindTooltip(label, { permanent, direction: 'top', offset: [0, -radius], className: 'rm-tip' })
      pts.push([p.lat, p.lng])
    }
    const cps = checkpoints.filter(hasPoint)
    if (hasPoint(origin)) dot(origin, { label: `From: ${origin.name || 'Origin'}`, fill: '#16a34a', permanent: true })
    cps.forEach((c, i) => { const cur = i === cps.length - 1 && !delivered; dot(c, { label: `${i + 1}. ${c.name}${cur ? ' — current' : ''}`, fill: cur ? '#f59e0b' : '#64748b', radius: cur ? 9 : 6, permanent: cur }) })
    if (hasPoint(destination)) dot(destination, { label: `To: ${destination.name || 'Destination'}`, fill: '#1e3a5f', permanent: true })
    const travelled = [hasPoint(origin) ? origin : null, ...cps].filter(Boolean).map(p => [p.lat, p.lng])
    if (travelled.length > 1) L.polyline(travelled, { color: '#16a34a', weight: 4, opacity: 0.9 }).addTo(g)
    const last = cps[cps.length - 1] || (hasPoint(origin) ? origin : null)
    if (last && hasPoint(destination) && !delivered) L.polyline([[last.lat, last.lng], [destination.lat, destination.lng]], { color: '#1e3a5f', weight: 3, dashArray: '6 8', opacity: 0.7 }).addTo(g)
    if (hasPoint(picked)) dot(picked, { label: 'New location', fill: '#dc2626', radius: 8, permanent: true })
    if (pts.length > 1) m.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 10 })
    else if (pts.length === 1) m.setView(pts[0], 8)
  }, [origin, destination, checkpoints, picked, delivered])

  return <div ref={el} className={`relative z-0 w-full rounded-2xl overflow-hidden border border-border bg-muted ${className}`} role="img" aria-label="Shipment route map" />
}
