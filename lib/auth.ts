import * as jose from 'jose';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-fallback-secret-key-must-be-changed-in-production-32-bytes'
);

export interface SessionPayload {
  userId: string;
  nombre: string;
  email: string;
  rol: 'SUPERADMIN' | 'OWNER' | 'EMPLOYEE';
  empresaId: string | null;
}

/**
 * Hashes a password using Node's native crypto scrypt algorithm.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  // scryptSync creates a secure hash from the password and salt
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored hash using timing safe comparison.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    
    const [salt, hash] = parts;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(verifyHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Signs a session payload and returns a JWT token.
 */
export async function signToken(payload: SessionPayload): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Session lasts 7 days
    .sign(JWT_SECRET);
}

/**
 * Verifies a JWT token and returns its payload or null if invalid.
 */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieves the session payload from a request's cookies.
 */
export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return await verifyToken(token);
}

/**
 * Sets the session cookie on a NextResponse object.
 */
export async function setSessionCookie(res: NextResponse, payload: SessionPayload) {
  const token = await signToken(payload);
  res.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

/**
 * Clears the session cookie on a NextResponse object.
 */
export function clearSessionCookie(res: NextResponse) {
  res.cookies.delete('session');
}
