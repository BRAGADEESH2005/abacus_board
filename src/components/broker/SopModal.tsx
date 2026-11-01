'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

export type SopTexts = { sopIntro: string; sopShots: string; sopFolders: string; sopShare: string; sopLink: string; notesHelp: string };

const EXAMPLE = 'PRP CHN 0042';

/** Photos and video SOP pop up (Broker v2, 7b): three tabs, Copy folder names, Got it. Text comes from admin Settings. */
export function SopModal({ texts, code, locality, onClose }: { texts: SopTexts; code: string; locality: string; onClose: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'shoot' | 'folder' | 'share'>('shoot');
  const live = (s: string) => s.replaceAll(EXAMPLE, code);
  const shots = texts.sopShots
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [shot, kind] = l.split('|').map((x) => x.trim());
      return { shot: live(shot ?? ''), kind: kind ?? '' };
    });
  const folders = texts.sopFolders.split('\n').map((l) => l.trim()).filter(Boolean);
  const main = `${code} ${locality}`.trim();
  const folderText = [main, ...folders.map((f) => `  ${f}`)].join('\n');
  const steps = texts.sopShare.split('\n').map((l) => live(l.trim())).filter(Boolean);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(folderText);
      toast('Folder names copied', 'success');
    } catch {
      toast('Could not copy. Select the names and copy them by hand.', 'error');
    }
  };

  return (
    <Modal
      title="Photos and video: how to shoot and share"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn" onClick={copy}>
            Copy folder names
          </button>
          <button type="button" className="btn primary" onClick={onClose}>
            Got it
          </button>
        </>
      }
    >
      <div className="ptabs" role="tablist">
        <button type="button" aria-pressed={tab === 'shoot'} onClick={() => setTab('shoot')}>
          What to shoot
        </button>
        <button type="button" aria-pressed={tab === 'folder'} onClick={() => setTab('folder')}>
          Folder setup
        </button>
        <button type="button" aria-pressed={tab === 'share'} onClick={() => setTab('share')}>
          Share the link
        </button>
      </div>
      {tab === 'shoot' && (
        <>
          {texts.sopIntro && <p className="small" style={{ margin: 0 }}>{live(texts.sopIntro)}</p>}
          <div className="tw">
            <table className="t">
              <thead>
                <tr>
                  <th>Shot</th>
                  <th>Photo or video</th>
                </tr>
              </thead>
              <tbody>
                {shots.map((s, i) => (
                  <tr key={i}>
                    <td>{s.shot}</td>
                    <td>{s.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {tab === 'folder' && (
        <>
          <p className="small" style={{ margin: 0 }}>
            One main folder per property, named with the property code and locality, with numbered subfolders inside. File names inside do not matter; the subfolder says what they are. Empty subfolders are fine if a shot does not apply.
          </p>
          <pre className="codebox" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{folderText}</pre>
        </>
      )}
      {tab === 'share' && (
        <>
          <ol className="small" style={{ margin: 0, paddingLeft: 20 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {s}
              </li>
            ))}
          </ol>
          <div className="notice amber small">The link must start with https://drive.google.com/drive/folders/. A link to a single file is rejected.</div>
        </>
      )}
      {texts.sopLink && (
        <a className="small" href={texts.sopLink} target="_blank" rel="noreferrer">
          Open the full photo and video SOP (PDF)
        </a>
      )}
    </Modal>
  );
}

export function NotesHelpModal({ text, onClose }: { text: string; onClose: () => void }) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <Modal title="What to write here" onClose={onClose} footer={<button type="button" className="btn primary" onClick={onClose}>Got it</button>}>
      <ul className="small" style={{ margin: 0, paddingLeft: 20 }}>
        {lines.map((l, i) => {
          const [head, ...rest] = l.split(':');
          return (
            <li key={i} style={{ marginBottom: 6 }}>
              {rest.length ? (
                <>
                  <b>{head}:</b>
                  {rest.join(':')}
                </>
              ) : (
                l
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
