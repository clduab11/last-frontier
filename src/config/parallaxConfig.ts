// Parallax Analytics API configuration module
// Loads all settings from environment variables for security and flexibility.
// Follows project conventions from vcuConfig.ts.

import dotenv from 'dotenv';

dotenv.config();

export interface ParallaxConfig {
  apiBaseUrl: string;
  contentEndpoint: string;
  timeoutMs: number;
  maxRetries: number;
  retryDelayMs: number;
  rateLimit: {
    maxRequests: number;
    perMilliseconds: number;
  };
}

function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const parallaxConfig: ParallaxConfig = {
  apiBaseUrl: getEnvVar('PARALLAX_API_BASE_URL'),
  contentEndpoint: getEnvVar('PARALLAX_CONTENT_ENDPOINT', '/v1/content/generate'),
  timeoutMs: Number(getEnvVar('PARALLAX_API_TIMEOUT_MS', '10000')),
  maxRetries: Number(getEnvVar('PARALLAX_API_MAX_RETRIES', '3')),
  retryDelayMs: Number(getEnvVar('PARALLAX_API_RETRY_DELAY_MS', '500')),
  rateLimit: {
    maxRequests: Number(getEnvVar('PARALLAX_API_RATE_LIMIT', '10')),
    perMilliseconds: Number(getEnvVar('PARALLAX_API_RATE_PERIOD_MS', '1000')),
  },
};