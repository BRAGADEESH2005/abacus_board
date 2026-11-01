/**
 * Runs once when the Next.js server starts (Node.js runtime only). See instrumentation-node.ts.
 * The import sits inside the runtime check so it is left out of the edge bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startup } = await import('./instrumentation-node');
    await startup();
  }
}
