import { env } from 'cloudflare:workers';
import { ApiError, now, uuid } from './security';

export interface RuntimeEnv { DB?: D1Database; BOOTSTRAP_ADMIN_EMAIL?: string; REQUIRE_EMAIL_VERIFICATION?: string; EMAIL_API_URL?: string; EMAIL_API_KEY?: string; EMAIL_FROM?: string; APP_URL?: string; TELEGRAM_BOT_TOKEN?: string; TELEGRAM_WEBHOOK_SECRET?: string; TELEGRAM_BOT_USERNAME?: string; CRON_SECRET?: string; LIQPAY_PUBLIC_KEY?: string; LIQPAY_PRIVATE_KEY?: string; PAYMENT_TOKEN_ENCRYPTION_KEY?: string; LIQPAY_VERSION?: string; ALLOW_DEMO_PAYMENTS?: string; GOOGLE_MAPS_API_KEY?:string; GOOGLE_SHEETS_WEBHOOK_URL?:string; GOOGLE_SHEETS_WEBHOOK_SECRET?:string; }
export const settings = () => env as RuntimeEnv;
export function db() { const binding = settings().DB; if (!binding) throw new ApiError(503,'База даних не підключена. Налаштуйте D1 та застосуйте міграції.'); return binding; }
export const statement = (sql: string, values: unknown[] = []) => db().prepare(sql).bind(...values);
export const row = <T = Record<string,unknown>>(sql: string, values: unknown[] = []) => statement(sql, values).first<T>();
export async function rows<T = Record<string,unknown>>(sql: string, values: unknown[] = []) { return (await statement(sql,values).all<T>()).results; }
export const run = (sql: string, values: unknown[] = []) => statement(sql,values).run();
export async function audit(userId: string|null, action: string, target: string, detail: unknown = {}) { await run('INSERT INTO audit (id,user_id,action,target,detail,created_at) VALUES (?,?,?,?,?,?)',[uuid(),userId,action,target,JSON.stringify(detail),now()]); }
export async function notify(userId: string, title: string, message: string, key?: string) { await run('INSERT OR IGNORE INTO notifications (id,user_id,title,message,event_key,created_at) VALUES (?,?,?,?,?,?)',[uuid(),userId,title,message,key ?? null,now()]); }
export async function outbox(userId: string|null, channel: string, recipient: string, subject: string, body: string, key?: string) { await run('INSERT OR IGNORE INTO outbox (id,user_id,channel,recipient,subject,body,event_key,created_at) VALUES (?,?,?,?,?,?,?,?)',[uuid(),userId,channel,recipient,subject,body,key ?? null,now()]); }
