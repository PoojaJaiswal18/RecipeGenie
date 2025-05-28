/**
 * Configuration for AI service integration
 */

export const AIServiceConfig = {
  /**
   * URL for the AI service API
   */
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || 'http://localhost:5001',
  
  /**
   * API key for authentication with the AI service (optional for local development)
   */
  API_KEY: process.env.AI_SERVICE_API_KEY || '',
  
  /**
   * Request timeout in milliseconds
   */
  REQUEST_TIMEOUT: parseInt(process.env.AI_REQUEST_TIMEOUT || '30000', 10),
  
  /**
   * Flag to enable/disable AI features
   */
  ENABLE_AI_FEATURES: process.env.ENABLE_AI_FEATURES !== 'false',
  
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
    MAX_ATTEMPTS: parseInt(process.env.AI_RETRY_MAX_ATTEMPTS || '3', 10),
    INITIAL_BACKOFF: parseInt(process.env.AI_RETRY_INITIAL_BACKOFF || '1000', 10),
    MAX_BACKOFF: parseInt(process.env.AI_RETRY_MAX_BACKOFF || '10000', 10)
  }
};

/**
 * Function to validate that all required configuration is present
 */
export function validateAIServiceConfig(): boolean {
  if (!AIServiceConfig.AI_SERVICE_URL) {
    console.error('AI Service URL is not configured');
    return false;
  }

  if (AIServiceConfig.AI_SERVICE_URL.includes('example.com')) {
    console.error('AI Service URL is still using placeholder value');
    return false;
  }

  return true;
}

export default AIServiceConfig;
