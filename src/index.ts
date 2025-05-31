/**
 * Last Frontier Express Application
 * Secure, production-ready Express server with authentication, database integration,
 * and comprehensive security middleware.
 */

import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import dotenv from 'dotenv';

import { verifyJwt } from './auth/authService';
import {
  checkDbHealth,
  registerShutdown,
  getClientWithRetry
} from './database/connection';
import MetricsCollector from './monitoring/metricsCollector';
import contentGenerationService from './services/contentGenerationService';
import { ParallaxContentGenerationRequest } from './types/parallax';
// Load environment variables
dotenv.config();
// Initialize metrics collector
const metricsCollector = new MetricsCollector('last-frontier-platform');

// Setup metrics event handlers
metricsCollector.on('alert', (alert) => {
  // Skip alerts in test environment to reduce noise
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ALERT] ${alert.level.toUpperCase()}: ${alert.type} - ${alert.value} exceeds threshold ${alert.threshold}`);
  }
});

metricsCollector.on('security_alert', (alert) => {
  // Skip security alerts in test environment to reduce noise
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[SECURITY ALERT] ${alert.type}: ${JSON.stringify(alert.data)}`);
  }
});

metricsCollector.on('metrics_collected', (metrics) => {
  // In production, send to monitoring service (e.g., DataDog, New Relic)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[METRICS] Request Rate: ${metrics.requestRate.toFixed(2)}/s, Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  }
}));

// Add metrics middleware
app.use(metricsCollector.requestMiddleware());
// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction): void => {
  const timestamp = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Authentication middleware
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const user = verifyJwt(token);
    req.user = user;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Health check endpoint
app.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    const dbHealthy = await checkDbHealth();
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        server: 'healthy'
      }
    };

    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unhealthy',
        server: 'healthy'
      },
      error: 'Health check failed'
    });
  }
});

import { createAuthRouter } from './routes/auth';
import ffcRoutes from './routes/ffc';
import aiRoutes from './routes/ai';

// API routes
app.use('/api/v1/auth', createAuthRouter(metricsCollector));

// FFC (Frontier Freedom Credits) routes - protected by authentication
app.use('/api/v1/ffc', authenticateToken, ffcRoutes);

// AI inference routes - protected by authentication  
app.use('/api/v1/ai', authenticateToken, aiRoutes);

app.get('/api/v1/status', (_req: Request, res: Response): void => {
  res.json({
    service: 'Last Frontier Platform',
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Protected route example
app.get('/api/v1/profile', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const client = await getClientWithRetry();
    const result = await client.query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    client.release();

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    // eslint-disable-next-line no-console
// Content Generation API endpoint
app.post('/api/v1/content/generate', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const payload: ParallaxContentGenerationRequest = req.body;
    
    // Track business metrics
    metricsCollector.collectBusinessMetrics({
      textGeneration: 1,
      vcuConsumption: payload.maxTokens || 100
    });
    
    const result = await contentGenerationService.generate(payload);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Content generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Content generation failed',
          status: 500
        }
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced metrics endpoint
app.get('/api/v1/metrics', authenticateToken, (_req: Request, res: Response): void => {
  const metrics = metricsCollector.getSystemMetrics();
  res.json(metrics);
});

// Enhanced health check with metrics
app.get('/api/v1/health/detailed', async (_req: Request, res: Response): Promise<void> => {
  try {
    const healthData = metricsCollector.getHealthCheck();
    const dbHealthy = await checkDbHealth();
    
    const detailedHealth = {
      ...healthData,
      services: {
        
        database: dbHealthy ? 'healthy' : 'unhealthy',
        contentGeneration: 'healthy',
        monitoring: 'healthy'
      }
    };
    
    const statusCode = dbHealthy ? 200 : 503;
    res.status(statusCode).json(detailedHealth);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unhealthy',
        server: 'healthy',
        contentGeneration: 'unknown',
        monitoring: 'healthy'
      },
      error: 'Detailed health check failed'
    });
  }
});
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Global error handler
app.use((error: Error, _req: Request, res: Response, next: NextFunction): void => {
  // eslint-disable-next-line no-console
  console.error('Unhandled error:', error);
  
  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// 404 handler
app.use('*', (req: Request, res: Response): void => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
registerShutdown();

let serverInstance: import('http').Server | undefined;

export const startServer = (port: number = Number(PORT)): import('http').Server => {
  if (serverInstance && serverInstance.listening) {
    console.warn(`Server is already running on port ${PORT}.`);
    return serverInstance;
  }
  serverInstance = app.listen(port, (): void => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Last Frontier server running on port ${port}`);
    // eslint-disable-next-line no-console
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    // eslint-disable-next-line no-console
    console.log(`🔒 Security middleware enabled`);
    // eslint-disable-next-line no-console
    console.log(`💾 Database connection pool initialized`);
  });
  return serverInstance;
};

export const closeServer = (callback?: (err?: Error) => void): void => {
  if (serverInstance) {
    serverInstance.close(callback);
    serverInstance = undefined;
  } else {
    if (callback) callback();
  }
};

// Handle server shutdown
process.on('SIGTERM', (): void => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully');
  closeServer(() => {
    // eslint-disable-next-line no-console
    console.log('Server closed');
    process.exit(0);
  });
});

// Only start server automatically if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, serverInstance as server, metricsCollector }; // Export app, server instance, and metrics collector