// Parallax Analytics "Last Frontier" Authentication Service
// Handles OAuth2 (Google, GitHub), JWT, and role-based access control.
// Integrated with Supabase Authentication for secure user management.

import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs'; // Keep for backward compatibility
import { Request, Response, NextFunction } from 'express';

import { supabaseAdmin } from '../config/supabase';

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
 * Supabase authentication result interface
 */
export interface SupabaseAuthResult {
  user: {
    id: string;
    email?: string;
  } | null;
  error: Error | null;
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
 * Creates a new user using Supabase Auth
 * @param email - User email
 * @param password - User password
 */
export async function createUserWithSupabase(email: string, password: string): Promise<SupabaseAuthResult> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for testing
    });

    if (error) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

/**
 * Authenticate user with Supabase Auth
 * @param email - User email
 * @param password - User password
 */
export async function signInWithSupabase(email: string, password: string): Promise<SupabaseAuthResult> {
  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

/**
 * Get user by ID from Supabase Auth
 * @param userId - User ID
 */
export async function getUserFromSupabase(userId: string): Promise<SupabaseAuthResult> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (error) {
      return { user: null, error };
    }

    return { user: data.user, error: null };
  } catch (error) {
    return { user: null, error: error as Error };
  }
}

/**
 * Legacy password hashing function (kept for backward compatibility with tests)
 * @param password - Plain text password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Legacy password comparison function (kept for backward compatibility with tests)
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
export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as LastFrontierJwtPayload;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

// OAuth2 logic (Google, GitHub) will be implemented in separate modules for clarity.