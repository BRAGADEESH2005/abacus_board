import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv } from './env';

let transporter: Transporter | null = null;

function transport(): Transporter {
  if (transporter) return transporter;
  const e = getEnv();
  transporter = nodemailer.createTransport({
    host: e.EMAIL_HOST,
    port: e.EMAIL_PORT,
    secure: e.EMAIL_SECURE,
    auth: { user: e.EMAIL_USER, pass: e.EMAIL_PASSWORD },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
  });
  return transporter;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#F7F4F3;font-family:Arial,Helvetica,sans-serif;color:#2E2F2C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #E4DCD9;border-radius:12px;overflow:hidden">
<tr><td style="height:4px;background:#7F1416"></td></tr>
<tr><td style="padding:18px 24px;border-bottom:1px solid #E4DCD9"><b style="font-size:16px;color:#7F1416">ABACUS SPACES</b><span style="color:#8A8984;font-size:12px"> · Requirement Board</span></td></tr>
<tr><td style="padding:22px 24px"><h1 style="font-size:19px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:14px 24px;background:#F1ECEA;color:#8A8984;font-size:12px">Abacus Spaces · spaces that mean business.</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendMail(to: string | string[], subject: string, title: string, bodyHtml: string, text: string) {
  const e = getEnv();
  await transport().sendMail({ from: e.EMAIL_FROM, to, subject, html: layout(title, bodyHtml), text });
}

const PURPOSE_LINE: Record<string, string> = {
  signup: 'Use this code to verify your email and finish signing up.',
  reset: 'Use this code to reset your password.',
  admin_device: 'Use this code to sign in to the admin board on a new browser.',
  change_email: 'Use this code to confirm your new email address.',
};

export async function sendOtpEmail(to: string, code: string, purpose: string) {
  const line = PURPOSE_LINE[purpose] ?? 'Use this code to continue.';
  await sendMail(
    to,
    `${code} is your Abacus Requirement Board code`,
    'Your one time code',
    `<p style="margin:0 0 12px">${esc(line)}</p>
     <p style="font:600 30px/1 'Courier New',monospace;letter-spacing:6px;background:#F1ECEA;border:1px dashed #CFC4C1;border-radius:8px;padding:14px 18px;display:inline-block;margin:0 0 12px">${code}</p>
     <p style="margin:0;color:#5E5F5A;font-size:13px">The code is valid for 10 minutes. If you did not ask for it, you can ignore this email.</p>`,
    `${line}\n\nCode: ${code}\n\nValid for 10 minutes.`,
  );
}

export async function sendPasswordChanged(to: string, name: string) {
  await sendMail(
    to,
    'Your Abacus Requirement Board password was changed',
    'Password changed',
    `<p>Hi ${esc(name)}, your password was just changed and every other signed in browser was logged out.</p>
     <p style="color:#5E5F5A;font-size:13px">If this was not you, reset your password straight away and tell the Abacus team.</p>`,
    `Hi ${name}, your password was just changed and other browsers were logged out. If this was not you, reset your password and tell Abacus.`,
  );
}

export type AlertRow = { code: string; location: string; sector: string; carpet: string; rent: string; specs: string; url: string };

export async function sendRequirementAlert(to: string, name: string, rows: AlertRow[]) {
  const appUrl = getEnv().APP_URL;
  const items = rows
    .map(
      (r) => `<tr><td style="padding:10px 0;border-top:1px solid #E4DCD9">
        <div style="font:12px 'Courier New',monospace;color:#8A8984">${esc(r.code)}</div>
        <div style="font-weight:bold;font-size:15px">${esc(r.location)}</div>
        <div style="font-size:13px;color:#5E5F5A">${esc(r.sector)} · ${esc(r.carpet)} · ${esc(r.rent)} · ${esc(r.specs)}</div>
        <a href="${esc(r.url)}" style="font-size:13px;color:#7F1416">Open requirement</a></td></tr>`,
    )
    .join('');
  await sendMail(
    to,
    rows.length === 1 ? `New requirement in ${rows[0].location}` : `${rows.length} new requirements in your cities`,
    'New requirements in your cities',
    `<p>Hi ${esc(name)}, Abacus just posted ${rows.length === 1 ? 'a requirement' : `${rows.length} requirements`} where you work. If you know a fitting property, post it and suggest it.</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}</table>
     <p style="margin-top:16px"><a href="${esc(appUrl)}/broker/requirements" style="background:#7F1416;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold;font-size:14px">See all requirements</a></p>`,
    `Hi ${name}, new requirements in your cities:\n\n${rows.map((r) => `${r.code} ${r.location}: ${r.sector}, ${r.carpet}, ${r.rent}, ${r.specs}\n${r.url}`).join('\n\n')}`,
  );
}
