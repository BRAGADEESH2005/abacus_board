'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type LL = { lat: number; lng: number };

const pin = L.divIcon({ className: '', html: '<div class="pin-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 18] });

/** Map centred on the micro market; tap or drag the marker onto the building. */
export default function LeafletPicker({ center, value, onChange, zoom = 16, height = 320 }: { center: LL; value: LL | null; onChange: (v: LL) => void; zoom?: number; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: value ?? center, zoom, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      const v = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) };
      cb.current(v);
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker(value, { draggable: true, icon: pin }).addTo(m);
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng();
        cb.current({ lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
      });
    } else {
      marker.current.setLatLng(value);
    }
    if (!m.getBounds().contains(value)) m.setView(value, Math.max(m.getZoom(), 16));
  }, [value]);

  useEffect(() => {
    if (map.current && !value) map.current.setView(center, zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  return <div ref={el} className="map small" style={{ height }} />;
}
