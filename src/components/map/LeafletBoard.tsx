'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export type MapProp = { id: string; code: string; lat: number; lng: number; color: string; popup: string };
export type MapCircle = { key: string; lat: number; lng: number; radius: number; label: string };

/** Every broker property as a coloured dot (clustered), open requirements as shaded micro market circles. */
export default function LeafletBoard({ props, circles, onSelect, selected }: { props: MapProp[]; circles: MapCircle[]; onSelect: (id: string) => void; selected?: string | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const cluster = useRef<L.MarkerClusterGroup | null>(null);
  const circleLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const sel = useRef(onSelect);
  sel.current = onSelect;
  const fitted = useRef(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { center: [11.5, 78], zoom: 7 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    circleLayer.current = L.layerGroup().addTo(m);
    cluster.current = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 });
    m.addLayer(cluster.current);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !cluster.current || !circleLayer.current) return;
    cluster.current.clearLayers();
    circleLayer.current.clearLayers();
    markers.current.clear();
    for (const c of circles) {
      L.circle([c.lat, c.lng], { radius: c.radius, color: '#7F1416', weight: 1, fillColor: '#7F1416', fillOpacity: 0.12 })
        .bindTooltip(c.label, { permanent: false, direction: 'top' })
        .addTo(circleLayer.current);
    }
    for (const p of props) {
      const icon = L.divIcon({
        className: '',
        html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${p.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      const mk = L.marker([p.lat, p.lng], { icon, title: p.code }).bindPopup(p.popup);
      mk.on('click', () => sel.current(p.id));
      cluster.current.addLayer(mk);
      markers.current.set(p.id, mk);
    }
    const pts: L.LatLngExpression[] = [...props.map((p) => [p.lat, p.lng] as [number, number]), ...circles.map((c) => [c.lat, c.lng] as [number, number])];
    if (pts.length && !fitted.current) {
      m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
      fitted.current = true;
    }
  }, [props, circles]);

  useEffect(() => {
    if (!selected || !cluster.current) return;
    const mk = markers.current.get(selected);
    if (mk) cluster.current.zoomToShowLayer(mk, () => mk.openPopup());
  }, [selected]);

  return <div ref={el} className="map" />;
}
