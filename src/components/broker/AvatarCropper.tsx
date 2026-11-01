'use client';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

const SIZE = 280;

/** Crop to a circle on screen: drag to position, slider to zoom. Exports a 512 px JPEG. */
export function AvatarCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const base = img ? SIZE / Math.min(img.width, img.height) : 1;

  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const s = base * zoom;
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, (SIZE - w) / 2 + off.x, (SIZE - h) / 2 + off.y, w, h);
    ctx.fillStyle = 'rgba(20,10,10,.55)';
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
  }, [img, zoom, off, base]);

  const done = async () => {
    if (!img) return;
    setBusy(true);
    const out = document.createElement('canvas');
    out.width = 512;
    out.height = 512;
    const ctx = out.getContext('2d')!;
    const k = 512 / SIZE;
    const s = base * zoom * k;
    const w = img.width * s;
    const h = img.height * s;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, (512 - w) / 2 + off.x * k, (512 - h) / 2 + off.y * k, w, h);
    out.toBlob((b) => b && onDone(b), 'image/jpeg', 0.9);
  };

  return (
    <Modal
      title="Crop your photo"
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <Button className="primary" onClick={done} loading={busy} disabled={!img}>
            Use photo
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvas}
          width={SIZE}
          height={SIZE}
          style={{ borderRadius: 12, cursor: 'grab', touchAction: 'none', background: '#eee' }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setOff({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y });
          }}
          onPointerUp={() => (drag.current = null)}
        />
      </div>
      <label className="f">
        Zoom
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      </label>
      <span className="hint">Drag the photo to centre your face in the circle.</span>
    </Modal>
  );
}
