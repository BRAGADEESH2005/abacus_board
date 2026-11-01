'use client';

export class ApiErr extends Error {
  status: number;
  fields?: Record<string, string>;
  data: Record<string, unknown>;
  constructor(status: number, message: string, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.fields = data.fields as Record<string, string> | undefined;
    this.data = data;
  }
}

/** JSON fetch helper: throws ApiErr with the server message and field errors. */
export async function api<T = Record<string, unknown>>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body || opts.form ? 'POST' : 'GET'),
      headers: opts.form ? undefined : opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiErr(0, 'Could not reach the server. Check your connection and try again.', {});
  }
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      const admin = window.location.pathname.startsWith('/admin');
      setTimeout(() => window.location.assign(admin ? '/admin/login' : '/login'), 1200);
    }
    throw new ApiErr(res.status, (data.error as string) || `Request failed (${res.status})`, data);
  }
  return data as T;
}
