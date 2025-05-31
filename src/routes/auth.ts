// src/routes/auth.ts
import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { PoolClient } from 'pg';

import * as authService from '../auth/authService';
import { pool, getClientWithRetry } from '../database/connection';
import type MetricsCollector from '../monitoring/metricsCollector';

// Rate limiting: 5 requests per 15 minutes per IP (disabled in test environment)
const authLimiter = process.env.NODE_ENV === 'test' 
  ? ((_req: Request, _res: Response, next: NextFunction): void => next()) // Passthrough in test
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

// CSRF protection (helmet for demonstration; consider csurf for production)
const csrfProtection = process.env.NODE_ENV === 'test'
  ? ((_req: Request, _res: Response, next: NextFunction): void => next()) // Passthrough in test
  : helmet({ contentSecurityPolicy: false });

/**
 * Factory to create the auth router with injected metricsCollector instance.
 */
export function createAuthRouter(metricsCollector: MetricsCollector) {
  const router = express.Router();

// --- Input Validators ---
const registerValidators = [
  body('email')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a symbol'),
];

const loginValidators = [
  body('email')
    .exists({ checkFalsy: true }).withMessage('Email and password are required')
    .bail()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .exists({ checkFalsy: true }).withMessage('Email and password are required')
    .bail()
    .isString()
    .isLength({ min: 8 }),
];

// --- Helper: Standardized error response ---
function sendError(res: Response, status: number, message: string): Response {
  return res.status(status).json({ error: message });
}

// --- POST /api/v1/auth/register ---
router.post(
  '/register',
  authLimiter,
  csrfProtection,
  registerValidators,
  async (req: Request, res: Response): Promise<void> => {
    // Input validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      metricsCollector.collectSecurityMetrics('auth_failure', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
        reason: 'validation',
      });
      sendError(res, 400, errors.array()[0].msg);
      return;
    }

    const { email, password } = req.body;

    try {
      // Create user with Supabase Auth
      const authResult = await authService.createUserWithSupabase(email, password);
      
      if (authResult.error || !authResult.user) {
        // Check if error is due to user already existing
        if (authResult.error?.message?.includes('already') || authResult.error?.message?.includes('exists')) {
          metricsCollector.collectSecurityMetrics('auth_failure', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: Date.now(),
            reason: 'duplicate',
          });
          sendError(res, 409, 'Email already registered');
          return;
        }
        
        metricsCollector.collectSecurityMetrics('auth_failure', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: Date.now(),
          reason: 'auth_error',
        });
        sendError(res, 500, 'Registration failed');
        return;
      }

      const userId = authResult.user.id;

      // Create user profile in our database
      let client: PoolClient | null = null;
      try {
        client = await getClientWithRetry();
        await client.query('BEGIN');

        // Insert user profile
        await client.query(
          `INSERT INTO user_profiles (user_id, display_name)
           VALUES ($1, $2)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, email.split('@')[0]]
        );

        await client.query('COMMIT');

        // Generate JWT
        const payload: authService.LastFrontierJwtPayload = {
          userId,
          email,
          role: authService.UserRole.EXPLORER,
        };
        const token = authService.generateJwt(payload);

        // Audit log
        await pool.query(
          `INSERT INTO audit_logs (user_id, event_type, ip, user_agent, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, 'register', req.ip, req.headers['user-agent'], JSON.stringify({ email })]
        );

        metricsCollector.collectSecurityMetrics('auth_failure', {
          userId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: Date.now(),
          event: 'register_success',
        });

        res.status(201).json({
          token,
          user: {
            id: userId,
            email,
            role: authService.UserRole.EXPLORER,
          },
        });
      } catch (dbErr) {
        if (client) await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        if (client) client.release();
      }
    } catch (err) {
      metricsCollector.collectSecurityMetrics('auth_failure', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
        reason: 'db_error',
      });
      sendError(res, 500, 'Registration failed');
    }
  }
);

// --- POST /api/v1/auth/login ---
router.post(
  '/login',
  authLimiter,
  csrfProtection,
  loginValidators,
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      metricsCollector.collectSecurityMetrics('auth_failure', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
        reason: 'validation',
      });
      sendError(res, 400, errors.array()[0].msg);
      return;
    }

    const { email, password } = req.body;

    try {
      // Authenticate with Supabase
      const authResult = await authService.signInWithSupabase(email, password);
      
      if (authResult.error || !authResult.user) {
        metricsCollector.collectSecurityMetrics('auth_failure', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: Date.now(),
          reason: 'invalid_credentials',
          email,
        });
        sendError(res, 401, 'Invalid email or password');
        return;
      }

      const userId = authResult.user.id;
      const userEmail = authResult.user.email || email;

      // Get user role from our profile table (default to EXPLORER)
      let userRole = authService.UserRole.EXPLORER;
      try {
        const profileResult = await pool.query(
          'SELECT role FROM user_profiles WHERE user_id = $1',
          [userId]
        );
        if (profileResult.rows.length > 0 && profileResult.rows[0].role) {
          userRole = profileResult.rows[0].role;
        }
      } catch (profileErr) {
        // If profile doesn't exist, create it with default role
        try {
          await pool.query(
            `INSERT INTO user_profiles (user_id, display_name, role)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, userEmail.split('@')[0], userRole]
          );
        } catch (insertErr) {
          // Log but don't fail login for profile creation errors
          // eslint-disable-next-line no-console
          console.error('Error creating user profile:', insertErr);
        }
      }

      // Generate JWT
      const payload: authService.LastFrontierJwtPayload = {
        userId,
        email: userEmail,
        role: userRole,
      };
      const token = authService.generateJwt(payload);

      // Audit log
      await pool.query(
        `INSERT INTO audit_logs (user_id, event_type, ip, user_agent, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'login', req.ip, req.headers['user-agent'], '{}']
      );

      metricsCollector.collectSecurityMetrics('auth_failure', {
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
        event: 'login_success',
      });

      res.json({
        token,
        user: {
          id: userId,
          email: userEmail,
          role: userRole,
        },
      });
    } catch (err) {
      metricsCollector.collectSecurityMetrics('auth_failure', {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: Date.now(),
        reason: 'db_error',
      });
      sendError(res, 500, 'Login failed');
    }
  }
);

// --- POST /api/v1/auth/refresh ---
router.post(
  '/refresh',
  authLimiter,
  csrfProtection,
  async (req: Request, res: Response): Promise<void> => {
    // For demonstration: expects { refreshToken }
    const { refreshToken } = req.body;
    if (!refreshToken) {
      sendError(res, 400, 'Refresh token required');
      return;
    }

    // TODO: Implement refresh token validation and storage
    // For now, just return error
    sendError(res, 501, 'Refresh token flow not yet implemented');
  }
);

  return router;
}