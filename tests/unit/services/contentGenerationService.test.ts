import {
  createContentGenerationService,
  IContentGenerationService,
  // ContentGenerationResult, // Will be used later
  // ContentGenerationServiceConfig, // Will be used later
} from '../../../src/services/contentGenerationService';
import {
  ParallaxContentGenerationRequest,
  ParallaxContentGenerationResponse,
  ParallaxApiErrorResponse,
  // ParallaxApiResponse, // Will be used later
} from '../../../src/types/parallax';
import * as parallaxApiClient from '../../../src/services/parallaxApiClient';
// import { VcuTokenService } from '../../../src/services/vcuTokenService'; // Commented out for now
// import MetricsCollector /*, { SystemMetrics } */ from '../../../src/monitoring/metricsCollector'; // Commented out for now
// import { TokenStorage } from '../../../src/storage/tokenStorage'; // TokenStorage commented out

// Mock the parallaxApiClient
jest.mock('../../../src/services/parallaxApiClient');
// Mock VcuTokenService
// jest.mock('../../../src/services/vcuTokenService'); // Commented out for now
// Mock MetricsCollector
// jest.mock('../../../src/monitoring/metricsCollector'); // Commented out for now


const mockGenerateContent =
  parallaxApiClient.generateContent as jest.MockedFunction<
    typeof parallaxApiClient.generateContent
  >;

describe('ContentGenerationService', () => {
  let service: IContentGenerationService;
  // let mockVcuTokenService: jest.Mocked<VcuTokenService>; // Commented out for now
  // let mockMetricsCollector: jest.Mocked<MetricsCollector>; // Commented out for now
  let mockCache: {
    get: jest.Mock<ParallaxContentGenerationResponse | undefined, [string]>;
    set: jest.Mock<void, [string, ParallaxContentGenerationResponse]>;
  };

  const mockSuccessfulApiResponse: ParallaxContentGenerationResponse = {
    id: 'res-123',
    model: 'test-model',
    content: 'Generated content',
    usage: {
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
    },
    stopReason: 'stop',
    createdAt: new Date().toISOString(),
  };

  const mockErrorApiResponse: ParallaxApiErrorResponse = {
    error: {
      code: 'API_ERROR',
      message: 'API request failed',
      status: 500,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };
    // Provide mock implementations for VcuTokenService and MetricsCollector
    // These can be expanded as needed for specific tests

    // For VcuTokenService, since it's a class, we mock its instance.
    // Jest's `jest.mock` will replace the class with a mock constructor.
    // We can then provide implementations for its methods on the instance.
    // The TS error was because the object literal didn't match the class structure.
    // A simpler way for now, as it's not directly used by ContentGenerationService:
    // mockVcuTokenService = new VcuTokenService() as jest.Mocked<VcuTokenService>; // Commented out for now
    // We can then mock its methods if/when ContentGenerationService uses them:
    // mockVcuTokenService.getActiveVcuToken = jest.fn();
    // etc.

    // For MetricsCollector, also a class.
    // mockMetricsCollector = new MetricsCollector('test-service') as jest.Mocked<MetricsCollector>; // Commented out for now
    // Mock its methods as needed:
    // mockMetricsCollector.collectBusinessMetrics = jest.fn();
    // etc.
    // To resolve the 'any' type issue and provide a more type-safe mock:
    // We can mock individual methods or use a partial mock if the class is complex.
    // For now, this instantiation should satisfy the type checker better than 'as any'.
    // If specific methods are called, they'll need to be jest.fn().

    // Create service with injected mock cache and other services
    // Note: The actual service doesn't directly take these in its factory,
    // but we're preparing for tests that might involve them indirectly
    // or if we refactor the service to accept them.
    // For now, the primary mock is the parallaxApiClient and the cache.
    service = createContentGenerationService({}, mockCache);
  });

  describe('generate', () => {
    const validRequest: ParallaxContentGenerationRequest = {
      prompt: 'Test prompt',
      model: 'test-model',
      maxTokens: 100,
      temperature: 0.7,
      userId: 'user-123',
    };

    it('should return generated content on successful API call (cache miss)', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

      // Act
      const result = await service.generate(validRequest);

      // Assert
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledWith(validRequest); // Input validation normalizes prompt
      expect(mockCache.set).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        JSON.stringify({
          prompt: 'Test prompt',
          context: undefined, // Assuming context is undefined if not provided
          maxTokens: 100,
          temperature: 0.7,
        }),
        mockSuccessfulApiResponse
      );
      expect(result).toEqual({
        success: true,
        data: mockSuccessfulApiResponse,
      });
    });

    it('should return an error on API failure (cache miss)', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      mockGenerateContent.mockResolvedValue(mockErrorApiResponse);

      // Act
      const result = await service.generate(validRequest);

      // Assert
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledWith(validRequest);
      expect(mockCache.set).not.toHaveBeenCalled(); // Should not cache errors
      expect(result).toEqual({
        success: false,
        error: mockErrorApiResponse,
      });
    });

    it('should return cached content on cache hit', async () => {
      // Arrange
      mockCache.get.mockReturnValue(mockSuccessfulApiResponse);

      // Act
      const result = await service.generate(validRequest);

      // Assert
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        data: mockSuccessfulApiResponse,
      });
    });

    describe('input validation', () => {
      it('should return validation error for empty prompt', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          prompt: '',
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockGenerateContent).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe('Prompt is required.');
          expect(result.error.error.status).toBe(400);
        }
      });

      it('should return validation error for prompt with only spaces', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          prompt: '   ',
        };

        // Act
        const result = await service.generate(invalidRequest);
        
        // Assert
        expect(mockCache.get).not.toHaveBeenCalled();
        expect(mockGenerateContent).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe('Prompt is required.');
          expect(result.error.error.status).toBe(400);
        }
      });

      it('should return validation error for maxTokens less than 1', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          maxTokens: 0,
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe(
            'maxTokens must be between 1 and 2048.'
          );
        }
      });

      it('should return validation error for maxTokens greater than 2048', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          maxTokens: 2049,
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe(
            'maxTokens must be between 1 and 2048.'
          );
        }
      });
      
      it('should return validation error for non-number maxTokens', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          // @ts-expect-error Testing invalid type
          maxTokens: 'not-a-number',
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe(
            'maxTokens must be between 1 and 2048.'
          );
        }
      });

      it('should return validation error for temperature less than 0', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          temperature: -0.1,
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe(
            'temperature must be between 0 and 2.'
          );
        }
      });

      it('should return validation error for temperature greater than 2', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          temperature: 2.1,
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe(
            'temperature must be between 0 and 2.'
          );
        }
      });
      
      it('should return validation error for non-number temperature', async () => {
        // Arrange
        const invalidRequest: ParallaxContentGenerationRequest = {
          ...validRequest,
          // @ts-expect-error Testing invalid type
          temperature: 'not-a-number',
        };

        // Act
        const result = await service.generate(invalidRequest);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe(
            'temperature must be between 0 and 2.'
          );
        }
      });

      it('should trim prompt before processing', async () => {
        // Arrange
        const requestWithSpaces: ParallaxContentGenerationRequest = {
          ...validRequest,
          prompt: '  Test prompt with spaces  ',
        };
        const expectedPayloadAfterValidation: ParallaxContentGenerationRequest = {
          ...validRequest,
          prompt: 'Test prompt with spaces', // Normalized prompt
        };
        mockCache.get.mockReturnValue(undefined);
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);
  
        // Act
        await service.generate(requestWithSpaces);
  
        // Assert
        expect(mockGenerateContent).toHaveBeenCalledWith(expectedPayloadAfterValidation);
      });

      it('should return validation error if prompt is not a string (e.g. null)', async () => {
        const invalidRequest = {
          ...validRequest,
          prompt: null,
        } as unknown as ParallaxContentGenerationRequest; // Force type for testing

        const result = await service.generate(invalidRequest);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe('Prompt is required.');
        }
      });
      
      it('should return validation error if prompt is undefined', async () => {
        const invalidRequest = {
          ...validRequest,
          prompt: undefined,
        } as unknown as ParallaxContentGenerationRequest; // Force type for testing

        const result = await service.generate(invalidRequest);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.error.code).toBe('VALIDATION_ERROR');
          expect(result.error.error.message).toBe('Prompt is required.');
        }
      });

    });

    describe('cache key generation and behavior', () => {
      it('should generate different cache keys for different prompts', async () => { // Made async
        const payload1: ParallaxContentGenerationRequest = { ...validRequest, prompt: 'prompt1' };
        const payload2: ParallaxContentGenerationRequest = { ...validRequest, prompt: 'prompt2' };
        // Access the internal getCacheKey for testing (not ideal, but necessary if not exposed)
        // This requires a way to get an instance of the service or call getCacheKey directly.
        // For this test, we'll assume we can call a helper or that the key generation is deterministic
        // and test its effect via cache get/set calls.

        // Simulate calls to see if they would use different keys
        mockCache.get.mockReturnValue(undefined);
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);
        
        await service.generate(payload1);
        const key1Args = mockCache.set.mock.calls[0];
        expect(key1Args).toBeDefined();
        const key1 = key1Args[0];

        // Clear mocks and set up for the second call
        jest.clearAllMocks(); // Clears call history for mockCache.set and mockGenerateContent
        mockCache.get.mockReturnValue(undefined); // Ensure cache miss for the second payload
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse); // Re-mock generateContent

        await service.generate(payload2);
        const key2Args = mockCache.set.mock.calls[0]; // After clearAllMocks, this is again the first call to set
        expect(key2Args).toBeDefined();
        const key2 = key2Args[0];
        
        // Check that the keys passed to cache.set are different
        expect(key1).not.toEqual(key2);
      });

      it('should generate the same cache key for the same relevant payload properties', async () => {
        const payload1: ParallaxContentGenerationRequest = {
          prompt: 'test', model: 'm1', maxTokens: 10, temperature: 0.5, userId: 'u1'
        };
        const payload2: ParallaxContentGenerationRequest = {
          prompt: 'test', model: 'm2', maxTokens: 10, temperature: 0.5, userId: 'u2', context: undefined
        }; // model & userId differ, context is same as default

        mockCache.get.mockReturnValue(undefined);
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        await service.generate(payload1);
        const key1 = mockCache.set.mock.calls[0][0];
        
        jest.clearAllMocks(); // Clear mocks for the second call
        mockCache.get.mockReturnValue(undefined);
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        await service.generate(payload2);
        const key2 = mockCache.set.mock.calls[0][0];
        
        expect(key1).toEqual(key2); // Keys should be the same as only relevant parts are used
      });

      it('should generate different cache keys if context differs', async () => {
        const payload1: ParallaxContentGenerationRequest = { ...validRequest, context: 'context1' };
        const payload2: ParallaxContentGenerationRequest = { ...validRequest, context: 'context2' };
        
        mockCache.get.mockReturnValue(undefined);
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        await service.generate(payload1);
        const key1 = mockCache.set.mock.calls[0][0];
        
        jest.clearAllMocks();
        mockCache.get.mockReturnValue(undefined);
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);
        
        await service.generate(payload2);
        const key2 = mockCache.set.mock.calls[0][0];
        
        expect(key1).not.toEqual(key2);
      });
    });
    
    describe('cache configuration', () => {
      // Note: Testing actual TTL and maxEntries behavior perfectly requires time control (for TTL)
      // or filling up the cache (for maxEntries), which can be complex in unit tests.
      // We'll focus on whether the service attempts to use the cache.
      // Direct testing of createCache is an option if it were exported or if we can inspect its instance.

      it('should use the default cache settings if none provided', async () => { // Made async
        // This test implies checking the internal cache instance, which is not directly exposed.
        // We can infer by creating a service without custom config and ensuring caching works.
        const defaultService = createContentGenerationService(); // Uses internal default cache
        
        // Reset the global mockGenerateContent before these specific calls
        mockGenerateContent.mockClear();
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        // First call (cache miss)
        await defaultService.generate(validRequest);
        // Second call (should be cache hit if default cache works)
        await defaultService.generate(validRequest);
        
        // If parallaxApiClient.generateContent was called only once, default cache is working.
        expect(mockGenerateContent).toHaveBeenCalledTimes(1); // Called once for miss, then hit
      });
      
      it('should use default cache settings when createContentGenerationService is called with no args', async () => {
        const defaultServiceNoArgs = createContentGenerationService();
        mockGenerateContent.mockClear();
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        await defaultServiceNoArgs.generate(validRequest); // miss
        await defaultServiceNoArgs.generate(validRequest); // hit
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      });

      it('should respect custom cache (mocked cache instance)', async () => {
        // This is already covered by the beforeEach setup where `mockCache` is injected.
        // We'll re-verify one of the cache hit/miss scenarios.
        mockCache.get.mockReturnValue(undefined); // miss
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);
        await service.generate(validRequest);
        expect(mockCache.get).toHaveBeenCalledTimes(1);
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
        expect(mockCache.set).toHaveBeenCalledTimes(1);

        mockCache.get.mockReturnValue(mockSuccessfulApiResponse); // hit
        await service.generate(validRequest);
        expect(mockCache.get).toHaveBeenCalledTimes(2); // Called again
        expect(mockGenerateContent).toHaveBeenCalledTimes(1); // Not called again
      });

      it('should evict oldest entries when cacheMaxEntries is exceeded', async () => {
        mockGenerateContent.mockClear(); // Explicitly clear mock for this test
        const maxEntries = 2;
        const customCacheService = createContentGenerationService({ cacheMaxEntries: maxEntries });
        
        const payload1 = { ...validRequest, prompt: 'prompt1' };
        const payload2 = { ...validRequest, prompt: 'prompt2' };
        const payload3 = { ...validRequest, prompt: 'prompt3' };
        
        mockGenerateContent.mockClear(); // Clear previous calls
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        // Fill the cache
        await customCacheService.generate(payload1); // Sets cache for prompt1
        await customCacheService.generate(payload2); // Sets cache for prompt2
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
        
        // This call should evict payload1
        await customCacheService.generate(payload3); // Sets cache for prompt3, evicts prompt1
        expect(mockGenerateContent).toHaveBeenCalledTimes(3);

        // Accessing payload1 should now be a cache miss
        await customCacheService.generate(payload1); // Call #4, p1 added, p2 evicted. Cache: [p3, p1]
        expect(mockGenerateContent).toHaveBeenCalledTimes(4);

        // Accessing payload3 should now be a cache hit
        await customCacheService.generate(payload3);
        expect(mockGenerateContent).toHaveBeenCalledTimes(4); // Still 4, p3 was a hit

        // Accessing payload1 should now be a cache hit
        await customCacheService.generate(payload1);
        expect(mockGenerateContent).toHaveBeenCalledTimes(4); // Still 4, p1 was a hit
        
        // Accessing payload2 should be a miss (it was evicted)
        await customCacheService.generate(payload2); // Call #5, p2 added, p3 evicted. Cache: [p1, p2]
        expect(mockGenerateContent).toHaveBeenCalledTimes(5);

      });

      it('should evict expired entries', async () => {
        jest.useFakeTimers();
        const cacheTtlSeconds = 1; // 1 second TTL for quick testing
        const customCacheService = createContentGenerationService({ cacheTtlSeconds });
        
        const payload = { ...validRequest, prompt: 'expirable-prompt' };
        
        mockGenerateContent.mockClear();
        mockGenerateContent.mockResolvedValue(mockSuccessfulApiResponse);

        // First call: cache miss, item is cached
        await customCacheService.generate(payload);
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);

        // Second call immediately after: cache hit
        await customCacheService.generate(payload);
        expect(mockGenerateContent).toHaveBeenCalledTimes(1); // Still 1, due to cache hit

        // Advance time past the TTL
        jest.advanceTimersByTime(cacheTtlSeconds * 1000 + 100); // Advance by TTL + a bit

        // Third call: should be a cache miss as the item has expired and been cleaned up
        await customCacheService.generate(payload);
        expect(mockGenerateContent).toHaveBeenCalledTimes(2); // Called again due to cache miss

        jest.useRealTimers(); // Restore real timers
      });
    });

    it('should handle unexpected errors from parallaxApiClient.generateContent', async () => {
      // Arrange
      mockCache.get.mockReturnValue(undefined);
      const unexpectedError = new Error('Network failure');
      mockGenerateContent.mockRejectedValue(unexpectedError);

      // Act
      const result = await service.generate(validRequest);

      // Assert
      expect(mockCache.get).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      if (!result.success) {
        // The service currently wraps parallax API errors. If generateContent itself throws,
        // the current implementation of ContentGenerationService's generate method
        // doesn't explicitly catch and re-wrap these.
        // Let's assume for now it should return a generic API error or rethrow.
        // Based on current implementation, it returns ParallaxApiErrorResponse for known errors.
        // If an unexpected error is thrown by generateContent, it might bubble up or be caught by a higher layer.
        // For this test, let's assume the desired behavior is to return a generic error structure.
        // The actual service code might need adjustment if this isn't the current behavior.
        // The current service code returns the direct response from generateContent if it's not a success response.
        // If generateContent *throws*, the try/catch in ContentGenerationService only handles validateInput.
        // This test will likely fail or reveal a need to adjust the service's error handling for thrown errors.

        // For now, let's expect a generic error structure if the service were to catch it.
        // This part of the test might need adjustment based on how the service *should* behave.
        // If it's expected to re-throw, the test should use `expect(...).rejects.toThrow()`.
        // Given the return type `ContentGenerationResult`, it implies it should always return an object.
        // Let's assume it should catch and return a generic error.
        // This highlights a potential gap in the current service implementation's error handling for thrown errors from the API client.
        // For the purpose of this test, we'll assume it *should* return a structured error.
        // This might require a refactor of the service later (Green/Refactor phase).

        // If the intention is that thrown errors from generateContent are not caught by this service's generate method's main path:
        // await expect(service.generate(validRequest)).rejects.toThrow('Network failure');

        // However, the return type `Promise<ContentGenerationResult>` suggests it should always resolve.
        // The service has been updated to catch these errors.
        expect(result.error).toBeDefined();
        expect(result.error?.error.code).toBe('INTERNAL_SERVER_ERROR');
        expect(result.error?.error.message).toBe('Network failure'); // Updated to expect the actual error message
        expect(result.error?.error.status).toBe(500);
      }
    });


    // More tests will be added here for VCU token interactions and MetricsCollector
  });
});