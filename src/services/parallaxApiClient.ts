// Parallax Analytics API Client
// Handles HTTP requests with retry logic, rate limiting, and VCU token authentication.

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import Bottleneck from 'bottleneck';
import { parallaxConfig } from '../config/parallaxConfig';
import { getActiveVcuToken } from './vcuTokenService';
import {
  ParallaxContentGenerationRequest,
  ParallaxApiResponse,
  ParallaxApiErrorResponse,
} from '../types/parallax';

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
const apiClient: AxiosInstance = axios.create({
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
    } catch (error: any) {
      lastError = error;
      // Retry on network or 5xx errors
      if (
        attempt < retries &&
        (error.code === 'ECONNABORTED' ||
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
  // Obtain VCU token for authentication
  const vcuToken = await getActiveVcuToken();
  try {
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
  } catch (error: any) {
    // Standardize error response
    const apiError: ParallaxApiErrorResponse = {
      error: {
        code: error?.response?.data?.error?.code || 'API_ERROR',
        message: error?.response?.data?.error?.message || error.message || 'Unknown error',
        details: error?.response?.data?.error?.details,
        status: error?.response?.status,
      },
      requestId: error?.response?.data?.requestId,
    };
    return apiError;
  }
}