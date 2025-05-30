// Parallax Analytics "Last Frontier" Authentication Service
// Handles OAuth2 (Google, GitHub), JWT, and role-based access control.
// No hard-coded secrets; all config via environment variables.

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/**
 * User roles for Last Frontier platform.
 */
export enum UserRole {
  EXPLORER = 'explorer',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin',
}

/**
 * Interface for JWT payload.
 */
export interface LastFrontierJwtPayload extends JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Generates a signed JWT for a user.
 * @param payload - User info and role
 * @param expiresIn - Expiry string (e.g., '1h')
 */
export function generateJwt(
  payload: LastFrontierJwtPayload,
  expiresIn: string = '1h'
): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set in environment');
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

/**
 * Verifies a JWT and returns the payload if valid.
 * @param token - JWT string
 */
export function verifyJwt(token: string): LastFrontierJwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set in environment');
  return jwt.verify(token, secret) as LastFrontierJwtPayload;
}

/**
 * Hashes a password using bcrypt.
 * @param password - Plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compares a plain password to a hash.
 * @param password - Plain text password
 * @param hash - Hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Role-based access control middleware (Express.js style).
 * Usage: app.use('/admin', requireRole([UserRole.ADMIN]))
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Role-based access control middleware (Express.js style).
 * Usage: app.use('/admin', requireRole([UserRole.ADMIN]))
 */
export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as LastFrontierJwtPayload;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// OAuth2 logic (Google, GitHub) will be implemented in separate modules for clarity.