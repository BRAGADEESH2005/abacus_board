'use client';
import { LocationMap } from '@/components/map';

/** Read only map of a property's pin (dragging on the admin side does nothing). */
export function PinMap({ lat, lng }: { lat: number; lng: number }) {
  return <LocationMap center={{ lat, lng }} value={{ lat, lng }} onChange={() => undefined} height={240} />;
}
