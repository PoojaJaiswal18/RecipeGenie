/**
 * Configuration for AI service integration
 */

// Load environment variables would typically use dotenv or similar
// import dotenv from 'dotenv';
// dotenv.config();

/**
 * AI service configuration
 */
export const AIServiceConfig = {
  /**
   * URL for the AI service API
   */
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'https://api.ai-service.example.com',
  
  /**
   * API key for authentication with the AI service
   */
  API_KEY: process.env.AI_SERVICE_API_KEY || 'default-api-key-for-development',
  
  /**
   * Request timeout in milliseconds
   */
  REQUEST_TIMEOUT: parseInt(process.env.AI_REQUEST_TIMEOUT || '15000', 10),
  
  /**
   * Flag to enable/disable AI features
   */
  ENABLE_AI_FEATURES: process.env.ENABLE_AI_FEATURES === 'true',
  
  /**
   * Maximum number of recipes to enhance in batch
   */
  MAX_BATCH_SIZE: parseInt(process.env.AI_MAX_BATCH_SIZE || '20', 10),
  
  /**
   * Default AI model to use
   */
  DEFAULT_MODEL: process.env.AI_DEFAULT_MODEL || 'standard',
  
  /**
   * Retry configuration
   */
  RETRY: {
    /**
     * Maximum number of retry attempts
     */
    MAX_ATTEMPTS: parseInt(process.env.AI_RETRY_MAX_ATTEMPTS || '3', 10),
    
    /**
     * Initial backoff delay in milliseconds
     */
    INITIAL_BACKOFF: parseInt(process.env.AI_RETRY_INITIAL_BACKOFF || '1000', 10),
    
    /**
     * Maximum backoff delay in milliseconds
     */
    MAX_BACKOFF: parseInt(process.env.AI_RETRY_MAX_BACKOFF || '10000', 10)
  }
};

/**
 * Function to validate that all required configuration is present
 * @returns boolean indicating if configuration is valid
 */
export function validateAIServiceConfig(): boolean {
  // Validate minimal configuration required for operation
  if (!AIServiceConfig.AI_SERVICE_URL) {
    console.error('AI Service URL is not configured');
    return false;
  }
  
  if (!AIServiceConfig.API_KEY || AIServiceConfig.API_KEY === 'default-api-key-for-development') {
    console.warn('Using default API key for AI service, this should be changed in production');
  }
  
  return true;
}