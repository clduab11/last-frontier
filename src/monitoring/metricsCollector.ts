/**
 * Production Metrics Collector for Last Frontier Platform
 * Implements comprehensive monitoring for subscription management system
 */
import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

import { loadavg, totalmem } from 'os';

import { LastFrontierJwtPayload } from '../auth/authService';

interface SecurityEventData {
  userId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  [key: string]: unknown;
}

interface MetricsData {
  [key: string]: unknown;
}

export interface SystemMetrics {
  timestamp: number;
  service: string;
  
  // Application Metrics (RED Method)
  requestRate: number;
  errorRate: number;
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
  
  // Business Metrics
  activeUsers: number;
  subscriptionConversions: number;
  revenueGenerated: number;
  apiUsage: {
    textGeneration: number;
    imageGeneration: number;
    vcuConsumption: number;
  };
  
  // System Metrics (USE Method)
  cpu: {
    utilization: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    available: number;
    heapUsed: number;
  };
  
  // Security Metrics
  authFailures: number;
  suspiciousActivity: number;
  rateLimitHits: number;
}

export interface AlertThresholds {
  critical: {
    responseTime: 5000; // 5s
    errorRate: 0.05; // 5%
    cpuUtilization: 0.9; // 90%
    memoryUtilization: 0.85; // 85%
    authFailureRate: 10; // per minute
  };
  warning: {
    responseTime: 2000; // 2s
    errorRate: 0.02; // 2%
    cpuUtilization: 0.7; // 70%
    memoryUtilization: 0.7; // 70%
    authFailureRate: 5; // per minute
  };
}

import { Response as ExpressResponse } from 'express';

class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricsData> = new Map();
  private requestTimes: number[] = [];
  private errorCount = 0;
  private requestCount = 0;
  private startTime = Date.now();
  private metricsInterval?: NodeJS.Timeout; // Store interval reference for cleanup
  
  private readonly thresholds: AlertThresholds = {
    critical: {
      responseTime: 5000,
      errorRate: 0.05,
      cpuUtilization: 0.9,
      memoryUtilization: 0.85,
      authFailureRate: 10
    },
    warning: {
      responseTime: 2000,
      errorRate: 0.02,
      cpuUtilization: 0.7,
      memoryUtilization: 0.7,
      authFailureRate: 5
    }
  };

  constructor(private serviceName: string) {
    super();
    this.startMetricsCollection();
  }

  /**
   * Express middleware for request monitoring
   */
  public requestMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = performance.now();
      const correlationId = req.headers['x-correlation-id'] as string || this.generateCorrelationId();
      
      // Add correlation ID to request
      req.headers['x-correlation-id'] = correlationId;
      
      // Track request start
      this.requestCount++;
      
      // Store original end method
      const originalEnd = res.end;

      // Override res.end to capture response metrics
      res.end = ((...args: unknown[]) => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;

        // Collect metrics
        this.collectRequestMetrics(req, res, responseTime, correlationId);

        // Call original end method with proper context and arguments
        // @ts-expect-error: We are intentionally forwarding all arguments
        return originalEnd.apply(res, args);
      }) as typeof res.end;

      next();
    };
  }

  /**
   * Collect request-specific metrics
   */
  private collectRequestMetrics(req: Request, res: Response, responseTime: number, correlationId: string) {
    this.requestTimes.push(responseTime);
    
    // Track errors
    if (res.statusCode >= 400) {
      this.errorCount++;
      this.emit('error_detected', {
        correlationId,
        statusCode: res.statusCode,
        path: req.path,
        method: req.method,
        responseTime,
        timestamp: Date.now()
      });
    }
    
    // Check thresholds
    this.checkAlertThresholds(responseTime);
    
    // Log structured request data
    this.logRequest(req, res, responseTime, correlationId);
  }

  /**
   * Collect business metrics
   */
  public collectBusinessMetrics(metrics: Partial<SystemMetrics['apiUsage']>) {
    const current = this.metrics.get('business') || {};
    this.metrics.set('business', { ...current, ...metrics });
  }

  /**
   * Collect security metrics
   */
  public collectSecurityMetrics(event: 'auth_failure' | 'suspicious_activity' | 'rate_limit_hit', data: SecurityEventData) {
    const securityMetrics = this.metrics.get('security') || {
      authFailures: 0,
      suspiciousActivity: 0,
      rateLimitHits: 0
    };
    
    switch (event) {
      case 'auth_failure':
        (securityMetrics as { authFailures: number }).authFailures++;
        break;
      case 'suspicious_activity':
        (securityMetrics as { suspiciousActivity: number }).suspiciousActivity++;
        break;
      case 'rate_limit_hit':
        (securityMetrics as { rateLimitHits: number }).rateLimitHits++;
        break;
    }

    this.metrics.set('security', securityMetrics);
    
    // Emit security alert if threshold exceeded
    const authFailures = (securityMetrics as { authFailures: number }).authFailures;
    if (authFailures > this.thresholds.critical.authFailureRate) {
      this.emit('security_alert', {
        type: 'critical',
        event,
        data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Express handler for Prometheus metrics endpoint
   */
  public prometheusMetricsHandler() {
    return (_req: Request, res: ExpressResponse) => {
      const metrics = this.getSystemMetrics();
      let output = '';
      // RED metrics
      output += `lastfrontier_request_rate ${metrics.requestRate}\n`;
      output += `lastfrontier_error_rate ${metrics.errorRate}\n`;
      output += `lastfrontier_response_time_average ${metrics.responseTime.average}\n`;
      output += `lastfrontier_response_time_p95 ${metrics.responseTime.p95}\n`;
      output += `lastfrontier_response_time_p99 ${metrics.responseTime.p99}\n`;
      // Business metrics
      output += `lastfrontier_active_users ${metrics.activeUsers}\n`;
      output += `lastfrontier_subscription_conversions ${metrics.subscriptionConversions}\n`;
      output += `lastfrontier_revenue_generated ${metrics.revenueGenerated}\n`;
      output += `lastfrontier_api_text_generation ${metrics.apiUsage.textGeneration}\n`;
      output += `lastfrontier_api_image_generation ${metrics.apiUsage.imageGeneration}\n`;
      output += `lastfrontier_vcu_consumption ${metrics.apiUsage.vcuConsumption}\n`;
      // System metrics
      output += `lastfrontier_cpu_utilization ${metrics.cpu.utilization}\n`;
      output += `lastfrontier_memory_used ${metrics.memory.used}\n`;
      output += `lastfrontier_memory_available ${metrics.memory.available}\n`;
      output += `lastfrontier_memory_heap_used ${metrics.memory.heapUsed}\n`;
      // Security metrics
      output += `lastfrontier_auth_failures ${metrics.authFailures}\n`;
      output += `lastfrontier_suspicious_activity ${metrics.suspiciousActivity}\n`;
      output += `lastfrontier_rate_limit_hits ${metrics.rateLimitHits}\n`;
      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(output);
    };
  }

  /**
   * Get current system metrics
   */
  public getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const uptime = now - this.startTime;
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate response time percentiles
    const sortedTimes = this.requestTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    
    const businessMetrics = this.metrics.get('business') || {};
    const securityMetrics = this.metrics.get('security') || {};
    
    return {
      timestamp: now,
      service: this.serviceName,
      
      // RED Method metrics
      requestRate: this.requestCount / (uptime / 1000),
      errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
      responseTime: {
        average: this.requestTimes.length > 0 ? 
          this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length : 0,
        p95: sortedTimes[p95Index] || 0,
        p99: sortedTimes[p99Index] || 0
      },
      
      // Business metrics
      activeUsers: (businessMetrics as { activeUsers?: number }).activeUsers || 0,
      subscriptionConversions: (businessMetrics as { subscriptionConversions?: number }).subscriptionConversions || 0,
      revenueGenerated: (businessMetrics as { revenueGenerated?: number }).revenueGenerated || 0,
      apiUsage: {
        textGeneration: (businessMetrics as { textGeneration?: number }).textGeneration || 0,
        imageGeneration: (businessMetrics as { imageGeneration?: number }).imageGeneration || 0,
        vcuConsumption: (businessMetrics as { vcuConsumption?: number }).vcuConsumption || 0
      },
      
      // USE Method metrics
      cpu: {
        utilization: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: loadavg()
      },
      memory: {
        used: memUsage.rss,
        available: totalmem() - memUsage.rss,
        heapUsed: memUsage.heapUsed
      },
      
      // Security metrics
      authFailures: (securityMetrics as { authFailures?: number }).authFailures || 0,
      suspiciousActivity: (securityMetrics as { suspiciousActivity?: number }).suspiciousActivity || 0,
      rateLimitHits: (securityMetrics as { rateLimitHits?: number }).rateLimitHits || 0
    };
  }

  /**
   * Check alert thresholds and emit alerts
   */
  private checkAlertThresholds(responseTime: number) {
    const metrics = this.getSystemMetrics();
    
    // Response time alerts
    if (responseTime > this.thresholds.critical.responseTime) {
      this.emit('alert', {
        level: 'critical',
        type: 'response_time',
        value: responseTime,
        threshold: this.thresholds.critical.responseTime,
        timestamp: Date.now()
      });
    } else if (responseTime > this.thresholds.warning.responseTime) {
      this.emit('alert', {
        level: 'warning',
        type: 'response_time',
        value: responseTime,
        threshold: this.thresholds.warning.responseTime,
        timestamp: Date.now()
      });
    }
    
    // Error rate alerts
    if (metrics.errorRate > this.thresholds.critical.errorRate) {
      this.emit('alert', {
        level: 'critical',
        type: 'error_rate',
        value: metrics.errorRate,
        threshold: this.thresholds.critical.errorRate,
        timestamp: Date.now()
      });
    }
    
    // CPU utilization alerts
    const cpuUtilization = metrics.cpu.utilization;
    if (cpuUtilization > this.thresholds.critical.cpuUtilization) {
      this.emit('alert', {
        level: 'critical',
        type: 'cpu_utilization',
        value: cpuUtilization,
        threshold: this.thresholds.critical.cpuUtilization,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection() {
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.emit('metrics_collected', metrics);
      
      // Reset request times array if it gets too large
      if (this.requestTimes.length > 10000) {
        this.requestTimes = this.requestTimes.slice(-1000);
      }
    }, 30000);
  }

  /**
   * Stop metrics collection and cleanup resources
   */
  public cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    this.removeAllListeners();
    this.metrics.clear();
    this.requestTimes = [];
  }

  /**
   * Log structured request data
   */
  private logRequest(req: Request, res: Response, responseTime: number, correlationId: string) {
    const logData = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 400 ? 'ERROR' : 'INFO',
      service: this.serviceName,
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime: Math.round(responseTime),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      userId: (req.user as LastFrontierJwtPayload)?.userId || null
    };
    
    console.log(JSON.stringify(logData));
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Health check endpoint data
   */
  public getHealthCheck() {
    const metrics = this.getSystemMetrics();
    const uptime = Date.now() - this.startTime;
    
    return {
      status: 'healthy',
      timestamp: Date.now(),
      uptime,
      service: this.serviceName,
      version: process.env.npm_package_version || '0.1.0',
      metrics: {
        requestRate: metrics.requestRate,
        errorRate: metrics.errorRate,
        averageResponseTime: metrics.responseTime.average,
        memoryUsage: metrics.memory.used,
        cpuUtilization: metrics.cpu.utilization
      }
    };
  }
}

export default MetricsCollector;