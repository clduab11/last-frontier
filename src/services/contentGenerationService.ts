// Content Generation Service
// ---------------------------------------------
// Provides a high-level abstraction around the low-level Parallax API client
// – input validation / sanitisation
// – response caching
// – unified error handling
// – easy dependency injection for tests
//
// NOTE: All functions are pure-ish (no hidden singletons) making the service
// easily mockable/testable.  The default export re-uses a shared LRU cache.

import {
  ParallaxContentGenerationRequest,
  ParallaxContentGenerationResponse,
  ParallaxApiErrorResponse,
  ParallaxApiResponse,
} from '../types/parallax';
import { generateContent } from './parallaxApiClient';

// --------------- Types & Interfaces --------------------

/**
 * Public return type.  Either a successful generation or a typed error.
 */
export type ContentGenerationResult =
  | { success: true; data: ParallaxContentGenerationResponse }
  | { success: false; error: ParallaxApiErrorResponse };

/**
 * Service configuration – mostly cache settings (seconds).
 * Defaults keep memory usage low while allowing rapid repeated calls.
 */
export interface ContentGenerationServiceConfig {
  cacheTtlSeconds: number;
  cacheMaxEntries: number;
}

/**
 * Signature that the service implementation must follow.
 * Facilitates dependency injection in unit tests.
 */
export interface IContentGenerationService {
  generate(
    payload: ParallaxContentGenerationRequest
  ): Promise<ContentGenerationResult>;
}

// --------------- Implementation ------------------------

/**
 * Basic input sanitisation & normalisation.
 * Throws on invalid input – upstream layers MUST catch.
 * Uses only built-in JS (no external deps).
 */
function validateInput(
  payload: ParallaxContentGenerationRequest
): ParallaxContentGenerationRequest {
  const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
  if (!prompt) {
    throw new Error('Prompt is required.');
  }

  // Shallow copy to avoid accidental mutations
  const safePayload: ParallaxContentGenerationRequest = {
    ...payload,
    prompt,
  };

  // Numeric bounds checks
  if (
    safePayload.maxTokens !== undefined &&
    (typeof safePayload.maxTokens !== 'number' ||
      safePayload.maxTokens < 1 ||
      safePayload.maxTokens > 2048)
  ) {
    throw new Error('maxTokens must be between 1 and 2048.');
  }

  if (
    safePayload.temperature !== undefined &&
    (typeof safePayload.temperature !== 'number' ||
      safePayload.temperature < 0 ||
      safePayload.temperature > 2)
  ) {
    throw new Error('temperature must be between 0 and 2.');
  }

  return safePayload;
}

/**
 * Simple in-memory cache (per process). Not LRU, but size-limited.
 */
function createCache(maxEntries: number, ttl: number) {
  type CacheEntry = { value: ParallaxContentGenerationResponse; expires: number };
  const store: Record<string, CacheEntry> = {};

  function cleanup() {
    const now = Date.now();
    for (const key in store) {
      if (store[key].expires < now) {
        delete store[key];
      }
    }
    // Remove oldest if over maxEntries
    const keys = Object.keys(store);
    if (keys.length > maxEntries) {
      keys
        .sort((a, b) => store[a].expires - store[b].expires)
        .slice(0, keys.length - maxEntries)
        .forEach((k) => delete store[k]);
    }
  }

  return {
    get(key: string): ParallaxContentGenerationResponse | undefined {
      cleanup();
      const entry = store[key];
      if (entry && entry.expires > Date.now()) {
        return entry.value;
      }
      return undefined;
    },
    set(key: string, value: ParallaxContentGenerationResponse) {
      store[key] = { value, expires: Date.now() + ttl * 1000 };
      cleanup();
    },
  };
}

/**
 * Deterministic cache key based on payload properties relevant for generation.
 */
function getCacheKey(payload: ParallaxContentGenerationRequest): string {
  const { prompt, context, maxTokens, temperature } = payload;
  // Intentionally ignore other extensible keys for now
  return JSON.stringify({ prompt, context, maxTokens, temperature });
}

/**
 * Factory to build a service instance with injectable dependencies.
 */
export function createContentGenerationService(
  cfg: Partial<ContentGenerationServiceConfig> = {},
  cacheInstance?: {
    get: (key: string) => ParallaxContentGenerationResponse | undefined;
    set: (key: string, value: ParallaxContentGenerationResponse) => void;
  }
): IContentGenerationService {
  const {
    cacheTtlSeconds = 60,
    cacheMaxEntries = 500,
  }: ContentGenerationServiceConfig = {
    cacheTtlSeconds: cfg.cacheTtlSeconds ?? 60,
    cacheMaxEntries: cfg.cacheMaxEntries ?? 500,
  };

  const cache =
    cacheInstance ?? createCache(cacheMaxEntries, cacheTtlSeconds);

  function isSuccessResponse(
    resp: ParallaxApiResponse
  ): resp is ParallaxContentGenerationResponse {
    return (
      resp &&
      typeof resp === 'object' &&
      'content' in resp &&
      typeof (resp as ParallaxContentGenerationResponse).content === 'string'
    );
  }

  return {
    async generate(
      rawPayload: ParallaxContentGenerationRequest
    ): Promise<ContentGenerationResult> {
      let payload: ParallaxContentGenerationRequest;
      try {
        payload = validateInput(rawPayload);
      } catch (validationErr) {
        return {
          success: false,
          error: {
            error: {
              code: 'VALIDATION_ERROR',
              message: (validationErr as Error).message,
              status: 400,
            },
          },
        };
      }

      const cacheKey = getCacheKey(payload);
      const cached = cache.get(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const apiResponse: ParallaxApiResponse = await generateContent(payload);

      if (isSuccessResponse(apiResponse)) {
        cache.set(cacheKey, apiResponse);
        return { success: true, data: apiResponse };
      }

      // Error path
      return { success: false, error: apiResponse };
    },
  };
}

// Default singleton instance
const defaultService = createContentGenerationService();
export default defaultService;