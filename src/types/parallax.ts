// Parallax Analytics API TypeScript types
// Defines request/response structures, error types, and content generation interfaces.

export interface ParallaxContentGenerationRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  [key: string]: unknown; // Allow for future extensibility
}

export interface ParallaxContentGenerationResponse {
  id: string;
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  createdAt: string; // ISO8601 timestamp
  model: string;
  [key: string]: unknown;
}

export interface ParallaxApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
    status?: number;
  };
  requestId?: string;
  [key: string]: unknown;
}

// Union type for all possible Parallax API responses
export type ParallaxApiResponse =
  | ParallaxContentGenerationResponse
  | ParallaxApiErrorResponse;

// Utility type for rate limit error
export interface ParallaxRateLimitError extends ParallaxApiErrorResponse {
  error: {
    code: 'RATE_LIMIT_EXCEEDED';
    message: string;
    details?: string;
    status?: number;
  };
}