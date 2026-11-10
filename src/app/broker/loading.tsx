/** Shown straight away when a consultant clicks between pages, while the next page loads. */
export default function Loading() {
  return (
    <main className="page" aria-busy="true">
      <div className="skel" style={{ height: 34, width: 260, marginBottom: 18 }} />
      <div className="tiles">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="tile skel" style={{ height: 78 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 160, marginTop: 18 }} />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
