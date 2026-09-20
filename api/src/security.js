import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
  const [salt, hash] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function readSession(req) {
  const fromCookie = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('crm_session='))?.slice(12);
  if (fromCookie) return fromCookie;
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return typeof req.headers['x-session-token'] === 'string' ? req.headers['x-session-token'].trim() : '';
}
