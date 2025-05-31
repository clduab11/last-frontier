// Parallax Analytics API Client
// Handles HTTP requests with retry logic, rate limiting, and VCU token authentication.

/**
 * Parallax Analytics API Client
 * Uses direct CJS require to avoid ESM/CJS interop issues with axios in Jest/TS.
 */
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Bottleneck from 'bottleneck';
import { parallaxConfig } from '../config/parallaxConfig';
import { getActiveVcuToken } from './vcuTokenService';
import {
  ParallaxContentGenerationRequest,
  ParallaxApiResponse,
  ParallaxApiErrorResponse,
} from '../types/parallax';



const axiosInstance = require('axios');


/**
 * Rate limiter to control API request frequency.
 */
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: Math.ceil(parallaxConfig.rateLimit.perMilliseconds / parallaxConfig.rateLimit.maxRequests),
});

/**
 * Axios instance configured for Parallax API.
 */
const apiClient: AxiosInstance = axiosInstance.create({
  baseURL: parallaxConfig.apiBaseUrl,
  timeout: parallaxConfig.timeoutMs,
});

/**
 * Helper to perform HTTP requests with retry and error handling.
 */
async function requestWithRetry<T>(
  config: AxiosRequestConfig,
  retries = parallaxConfig.maxRetries,
  retryDelay = parallaxConfig.retryDelayMs
): Promise<AxiosResponse<T>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await limiter.schedule(() => apiClient.request<T>(config));
    } catch (error: unknown) {
      lastError = error;
      // Retry on network or 5xx errors
      if (
        attempt < retries &&
        typeof error === 'object' &&
        error !== null &&
        // @ts-expect-error: dynamic error shape
        (error.code === 'ECONNABORTED' ||
          // @ts-expect-error: dynamic error shape
          (error.response && error.response.status >= 500))
      ) {
        await new Promise((res) => setTimeout(res, retryDelay));
        continue;
      }
      break;
    }
  }
  throw lastError;
}

/**
 * Calls the Parallax content generation endpoint.
 * @param payload Content generation request body
 * @returns Parallax API response or error
 */
export async function generateContent(
  payload: ParallaxContentGenerationRequest
): Promise<ParallaxApiResponse> {
  try {
    // Obtain VCU token for authentication
    const vcuToken = await getActiveVcuToken();
    const response = await requestWithRetry<ParallaxApiResponse>({
      method: 'POST',
      url: parallaxConfig.contentEndpoint,
      headers: {
        Authorization: `Bearer ${vcuToken}`,
        'Content-Type': 'application/json',
      },
      data: payload,
    });
    return response.data;
  } catch (error: unknown) {
    // Standardize error response
    let code = 'API_ERROR';
    let message = 'Unknown error';
    let details;
    let status;
    let requestId;
    if (typeof error === 'object' && error !== null) {
      // @ts-expect-error: dynamic error shape
      code = error?.response?.data?.error?.code || code;
      // @ts-expect-error: dynamic error shape
      message = error?.response?.data?.error?.message || error?.message || message;
      // @ts-expect-error: dynamic error shape
      details = error?.response?.data?.error?.details;
      // @ts-expect-error: dynamic error shape
      status = error?.response?.status;
      // @ts-expect-error: dynamic error shape
      requestId = error?.response?.data?.requestId;
    }
    const apiError: ParallaxApiErrorResponse = {
      error: {
        code,
        message,
        details,
        status,
      },
      requestId,
    };
    return apiError;
  }
}