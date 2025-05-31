/**
 * Parallax API Client Unit Tests
 * Tests HTTP client functionality, retry logic, rate limiting, and authentication
 * Using London School TDD approach with comprehensive mocking
 */

import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { ParallaxContentGenerationRequest, ParallaxContentGenerationResponse } from '../../../src/types/parallax';

/**
 * NOTE: Do NOT mock axios or bottleneck at the top level, as this breaks integration tests.
 * Instead, mock them only within the ParallaxApiClient unit test suite.
 *
 * To prevent require cache pollution, do not import axios or Bottleneck at the top level.
 * Only import them after jest.doMock in beforeEach.
 */
jest.mock('../../../src/config/parallaxConfig', () => ({
  parallaxConfig: {
    apiBaseUrl: 'https://api.parallax.test',
    contentEndpoint: '/v1/content/generate',
    timeoutMs: 30000,
    maxRetries: 3,
    retryDelayMs: 1000,
    rateLimit: {
      maxRequests: 10,
      perMilliseconds: 60000,
    },
  },
}));

/**
 * Mock rate limiter interface for type safety in test suite.
 */
interface MockRateLimiter {
  schedule: jest.MockedFunction<(fn: () => Promise<unknown>) => Promise<unknown>>;
}

describe('ParallaxApiClient', () => {
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  let mockLimiter: MockRateLimiter;
  let mockedAxios: jest.Mocked<typeof import('axios')>;
  let generateContent: typeof import('../../../src/services/parallaxApiClient').generateContent;
  let mockedGetActiveVcuToken: jest.MockedFunction<typeof import('../../../src/services/vcuTokenService').getActiveVcuToken>;

  beforeEach(() => {
    jest.resetModules();

    // Always initialize mockLimiter before mocking bottleneck to avoid undefined errors.
    mockLimiter = {
      schedule: jest.fn(),
    };

    // Dynamically mock all dependencies for this suite only
    jest.doMock('axios');
    jest.doMock('bottleneck', () => {
      return jest.fn().mockImplementation(() => mockLimiter);
    });
    jest.doMock('../../../src/services/vcuTokenService', () => ({
      getActiveVcuToken: jest.fn(),
    }));

    // Import axios after mocking
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mockedAxios = require('axios');
    mockAxiosInstance = {
      request: jest.fn(),
    } as unknown as jest.Mocked<AxiosInstance>;
    // Directly assign the static .create method for the mock
    // @ts-expect-error: create is not typed on the mock, but exists on the real axios
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    // Import VCU token service after mocking
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const vcuTokenService = require('../../../src/services/vcuTokenService');
    mockedGetActiveVcuToken = vcuTokenService.getActiveVcuToken;

    // Import generateContent after mocks are in place
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    generateContent = require('../../../src/services/parallaxApiClient').generateContent;
  });

  afterEach(() => {
    // Reset module registry to avoid leaking mocks to other tests (especially integration)
    jest.resetModules();
    jest.clearAllMocks();
  });

  describe('generateContent', () => {
    const mockRequest: ParallaxContentGenerationRequest = {
      prompt: 'Generate test content',
      context: 'Test context',
      maxTokens: 100,
      temperature: 0.7,
    };

    const mockSuccessResponse: ParallaxContentGenerationResponse = {
      id: 'gen_123456789',
      content: 'Generated test content',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      createdAt: '2024-01-01T00:00:00Z',
      model: 'parallax-v1',
    };

    it('should successfully generate content with valid VCU token', async () => {
      // Given: Valid VCU token and successful API response
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);
      
      const mockAxiosResponse: AxiosResponse = {
        data: mockSuccessResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      };
      
      mockLimiter.schedule.mockImplementation((fn: () => Promise<unknown>) => fn());
      mockAxiosInstance.request.mockResolvedValue(mockAxiosResponse);

      // When: Generating content
      const result = await generateContent(mockRequest);

      // Then: Should return successful response
      expect(mockedGetActiveVcuToken).toHaveBeenCalledTimes(1);
      expect(mockLimiter.schedule).toHaveBeenCalledTimes(1);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        method: 'POST',
        url: '/v1/content/generate',
        headers: {
          Authorization: `Bearer ${mockToken}`,
          'Content-Type': 'application/json',
        },
        data: mockRequest,
      });
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should handle VCU token retrieval failure', async () => {
      // Given: VCU token service fails
      const tokenError = new Error('VCU token service unavailable');
      mockedGetActiveVcuToken.mockRejectedValue(tokenError);

      // When: Attempting to generate content
      const result = await generateContent(mockRequest);

      // Then: Should return error response
      expect(mockedGetActiveVcuToken).toHaveBeenCalledTimes(1);
      expect(mockLimiter.schedule).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: {
          code: 'API_ERROR',
          message: 'VCU token service unavailable',
          details: undefined,
          status: undefined,
        },
        requestId: undefined,
      });
    });

    it('should retry on network timeout errors', async () => {
      // Given: VCU token available but network timeouts
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 30000ms exceeded',
      };

      // First two calls fail with timeout, third succeeds
      mockLimiter.schedule
        .mockImplementationOnce(() => Promise.reject(timeoutError))
        .mockImplementationOnce(() => Promise.reject(timeoutError))
        .mockImplementationOnce(() => Promise.resolve({
          data: mockSuccessResponse,
          status: 200,
        }));

      // When: Generating content with retries
      const result = await generateContent(mockRequest);

      // Then: Should retry and eventually succeed
      expect(mockLimiter.schedule).toHaveBeenCalledTimes(3);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should retry on 5xx server errors', async () => {
      // Given: VCU token available but server errors
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const serverError = {
        response: {
          status: 503,
          data: { error: 'Service temporarily unavailable' },
        },
        message: 'Request failed with status code 503',
      };

      // First call fails with 503, second succeeds
      mockLimiter.schedule
        .mockImplementationOnce(() => Promise.reject(serverError))
        .mockImplementationOnce(() => Promise.resolve({
          data: mockSuccessResponse,
          status: 200,
        }));

      // When: Generating content with server error
      const result = await generateContent(mockRequest);

      // Then: Should retry and succeed
      expect(mockLimiter.schedule).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockSuccessResponse);
    });

    it('should not retry on 4xx client errors', async () => {
      // Given: VCU token available but client error
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const clientError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'INVALID_REQUEST',
              message: 'Invalid prompt format',
            },
          },
        },
        message: 'Request failed with status code 400',
      };

      mockLimiter.schedule.mockRejectedValue(clientError);

      // When: Generating content with client error
      const result = await generateContent(mockRequest);

      // Then: Should not retry and return standardized error
      expect(mockLimiter.schedule).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid prompt format',
          status: 400,
        },
      });
    });

    it('should exhaust retries and return error after max attempts', async () => {
      // Given: VCU token available but persistent server errors
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const persistentError = {
        response: {
          status: 500,
          data: { error: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      };

      mockLimiter.schedule.mockRejectedValue(persistentError);

      // When: Generating content with persistent errors
      const result = await generateContent(mockRequest);

      // Then: Should retry max times and return error
      expect(mockLimiter.schedule).toHaveBeenCalledTimes(4); // Initial + 3 retries
      expect(result).toEqual({
        error: {
          code: 'API_ERROR',
          message: 'Request failed with status code 500',
          status: 500,
        },
      });
    });

    it('should handle rate limiting through rate limiter', async () => {
      // Given: VCU token and rate-limited requests
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      // Simulate rate limiting delay
      let callCount = 0;
      mockLimiter.schedule.mockImplementation((fn: () => Promise<unknown>) => {
        callCount++;
        if (callCount === 1) {
          // First call is delayed due to rate limiting
          return new Promise(resolve => 
            setTimeout(() => resolve(fn()), 100)
          );
        }
        return fn();
      });

      mockAxiosInstance.request.mockResolvedValue({
        data: mockSuccessResponse,
        status: 200,
      } as AxiosResponse);

      // When: Making rate-limited request
      const startTime = Date.now();
      const result = await generateContent(mockRequest);
      const endTime = Date.now();

      // Then: Should respect rate limiting and succeed
      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
      expect(result).toEqual(mockSuccessResponse);
      expect(mockLimiter.schedule).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed API responses gracefully', async () => {
      // Given: VCU token available but malformed response
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const malformedResponse = {
        data: { invalid: 'response structure' },
        status: 200,
      };

      mockLimiter.schedule.mockImplementation((fn: () => Promise<unknown>) => fn());
      mockAxiosInstance.request.mockResolvedValue(malformedResponse as AxiosResponse);

      // When: Receiving malformed response
      const result = await generateContent(mockRequest);

      // Then: Should return the malformed data as-is
      expect(result).toEqual({ invalid: 'response structure' });
    });

    it('should include request ID in error responses when available', async () => {
      // Given: VCU token available but API error with request ID
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const errorWithRequestId = {
        response: {
          status: 429,
          data: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
            },
            requestId: 'req_123456789',
          },
        },
        message: 'Request failed with status code 429',
      };

      mockLimiter.schedule.mockRejectedValue(errorWithRequestId);

      // When: Receiving error with request ID
      const result = await generateContent(mockRequest);

      // Then: Should include request ID in standardized error
      expect(result).toEqual({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          status: 429,
        },
        requestId: 'req_123456789',
      });
    });

    it('should handle network errors without response object', async () => {
      // Given: VCU token available but network failure
      const mockToken = 'vcu_valid_token_123';
      mockedGetActiveVcuToken.mockResolvedValue(mockToken);

      const networkError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND api.parallax.test',
      };

      mockLimiter.schedule.mockRejectedValue(networkError);

      // When: Network failure occurs
      const result = await generateContent(mockRequest);

      // Then: Should return standardized error without status
      expect(result).toEqual({
        error: {
          code: 'API_ERROR',
          message: 'getaddrinfo ENOTFOUND api.parallax.test',
        },
      });
    });
  });

  describe('HTTP client configuration', () => {
    it('should create axios instance with correct configuration', () => {
      // When: Module is imported (axios.create is called)
      // Then: Should configure axios with correct settings
      // @ts-expect-error: create is assigned on the mock for test purposes
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.parallax.test',
        timeout: 30000,
      });
    });
  });
});