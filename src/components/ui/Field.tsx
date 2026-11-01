import { useId, type ReactNode } from 'react';

/**
 * Form field wrapper. Wraps a single input in a <label>. For button groups (Yes/No, chips),
 * pass `group` so it renders a labelled role="group" instead: a <label> around buttons would
 * hand the label text to the first button as its accessible name.
 */
export function Field({ label, req, hint, error, children, className = '', tag, info, group }: { label: ReactNode; req?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string; tag?: ReactNode; info?: ReactNode; group?: boolean }) {
  const id = useId();
  const head = (
    <span className="lab" id={group ? `${id}-l` : undefined}>
      {label}
      {req && <span className="req">*</span>}
      {tag}
      {info}
    </span>
  );
  const foot = error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null;
  if (group) {
    return (
      <div className={`f ${error ? 'invalid' : ''} ${className}`} role="group" aria-labelledby={`${id}-l`}>
        {head}
        {children}
        {foot}
      </div>
    );
  }
  return (
    <label className={`f ${error ? 'invalid' : ''} ${className}`}>
      {head}
      {children}
      {foot}
    </label>
  );
}
