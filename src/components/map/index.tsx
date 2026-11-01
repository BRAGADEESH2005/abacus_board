'use client';
import dynamic from 'next/dynamic';

const loading = () => <div className="map small" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="muted">Loading map…</span></div>;

export const LocationMap = dynamic(() => import('./LeafletPicker'), { ssr: false, loading });
export const BoardMap = dynamic(() => import('./LeafletBoard'), { ssr: false, loading });
export type { MapProp, MapCircle } from './LeafletBoard';
