import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import mongoose from 'mongoose';

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  extra?: Record<string, unknown>;
  constructor(status: number, message: string, fields?: Record<string, string>, extra?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.fields = fields;
    this.extra = extra;
  }
}

export function zodFields(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of err.issues) {
    const k = i.path.join('.') || '_';
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'The request body is not valid JSON.');
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    const fields = zodFields(r.error);
    throw new ApiError(422, Object.values(fields)[0] ?? 'Please check the highlighted fields.', fields);
  }
  return r.data;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function toPlain<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function isId(v: unknown): v is string {
  return typeof v === 'string' && mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v);
}

export function requireId(v: unknown, what = 'record'): string {
  if (!isId(v)) throw new ApiError(404, `That ${what} was not found.`);
  return v;
}

type Ctx = { params: Promise<Record<string, string>> };

/** Wraps a route handler so every failure becomes a clean JSON error. */
export function handler(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message, fields: err.fields, ...err.extra }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const fields = zodFields(err);
        return NextResponse.json({ error: Object.values(fields)[0], fields }, { status: 422 });
      }
      const e = err as { code?: number; message?: string; keyValue?: Record<string, unknown> };
      if (e?.code === 11000) {
        return NextResponse.json({ error: 'That record already exists.' }, { status: 409 });
      }
      console.error('[api error]', req.method, new URL(req.url).pathname, err);
      const dbDown = /MongoDB|ECONNREFUSED|server selection/i.test(e?.message ?? '');
      return NextResponse.json(
        { error: dbDown ? 'The database is unreachable right now. Please try again shortly.' : 'Something went wrong on our side. Please try again.' },
        { status: dbDown ? 503 : 500 },
      );
    }
  };
}
