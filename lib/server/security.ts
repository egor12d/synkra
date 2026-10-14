import { createHash } from 'node:crypto';
import { sha3_256 } from '@noble/hashes/sha3.js';

export const uuid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function randomToken() { return [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
export async function hashPassword(password: string, salt = randomToken()) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return `pbkdf2$100000$${salt}$${Buffer.from(result).toString('hex')}`;
}
export function safeEqual(a: string, b: string) { let diff = a.length ^ b.length; for (let i = 0; i < Math.max(a.length,b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return diff === 0; }
export async function verifyPassword(password: string, stored: string) { const parts = stored.split('$'); return parts.length === 4 && safeEqual(await hashPassword(password, parts[2]), stored); }
export function liqpaySignature(data: string, secret: string, version = '7') { const value=secret+data+secret; return version==='3'?createHash('sha1').update(value).digest('base64'):Buffer.from(sha3_256(new TextEncoder().encode(value))).toString('base64'); }
export const localRequest = (request: Request) => ['localhost','127.0.0.1','[::1]'].includes(new URL(request.url).hostname);
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
