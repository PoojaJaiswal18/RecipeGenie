import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import { IUser } from '../models/User';
import { RecipeRepository } from '../repositories/recipeRepository';
import { AIServiceConfig } from '../config/aiConfig';
import { 
  AIRecipeEnhancementResult, 
  UserPreferences, 
  AITrainingData, 
  AICookingTips,
  AIIngredientAnalysis,
  ShoppingListResult,
  AIRecipeAnalysisOptions,
  AIModelTrainingResult,
  AIRecipeAnalysisResponse
} from '../dto/aiDto';

/**
 * Service for handling AI-related functionality and integration
 * with external AI services
 */
export class AIService {
  private apiUrl: string;
  private recipeRepository: RecipeRepository;
  private requestTimeout: number;
  private defaultRequestConfig: AxiosRequestConfig;
  
  /**
   * Initialize AIService with configuration
   */
  constructor() {
    this.apiUrl = AIServiceConfig.AI_SERVICE_URL;
    this.requestTimeout = AIServiceConfig.REQUEST_TIMEOUT;
    this.recipeRepository = new RecipeRepository();
    this.defaultRequestConfig = {
      timeout: this.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AIServiceConfig.API_KEY
      }
    };
  }
  
  /**
   * Convert user object to user preferences format for AI service
   * @param user - User object containing preferences and history
   * @returns Formatted user preferences for AI service
   */
  private getUserPreferences(user?: IUser): UserPreferences | undefined {
    if (!user) return undefined;
    
    return {
      favorites: user.favorites?.map(id => id.toString()) || [],
      dietary_restrictions: user.preferences?.dietaryRestrictions || [],
      cuisine_preferences: user.preferences?.favoriteCuisines || [],
      past_interactions: user.recipeHistory?.map(history => ({
        recipe_id: history.recipeId.toString(),
        rating: history.rating || 0,
        last_viewed: history.lastViewed?.toISOString() || '',
        saved: history.saved || false
      })) || []
    };
  }

  /**
   * Extract ingredients from recipe object in a consistent format
   * @param recipe - Recipe object
   * @returns Array of ingredient strings
   */
  private extractIngredients(recipe: any): string[] {
    if (!recipe || !recipe.ingredients) return [];
    
    return recipe.ingredients.map(ing => 
      typeof ing === 'string' ? ing : ing.name || ing.toString()
    );
  }
  
  /**
   * Make a request to the AI service with error handling
   * @param endpoint - API endpoint
   * @param data - Request payload
   * @param config - Additional axios config options
   * @returns Promise with response data
   */
  private async makeAIRequest<T>(
    endpoint: string, 
    data: any, 
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    try {
      const requestConfig = {
        ...this.defaultRequestConfig,
        ...config
      };
      
      const response: AxiosResponse<T> = await axios.post(
        `${this.apiUrl}${endpoint}`,
        data,
        requestConfig
      );
      
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message;
      logger.error(`AI service request to ${endpoint} failed: ${errorMessage}`);
      
      // Include request details for debugging (sanitized)
      logger.debug(`Failed request details: endpoint=${endpoint}, status=${error.response?.status}`);
      
      throw new Error(`AI service error: ${errorMessage}`);
    }
  }
  
  /**
   * Enhance a list of recipes with AI capabilities
   * @param recipes - Array of recipe objects to enhance
   * @param user - Optional user for personalization
   * @param ingredients - Optional array of focus ingredients
   * @returns Enhanced recipes with AI-generated content
   */
  public async enhanceRecipes(
    recipes: any[], 
    user?: IUser, 
    ingredients?: string[]
  ): Promise<AIRecipeEnhancementResult> {
    if (!recipes || recipes.length === 0) {
      return { recipes, ai_enhanced: false };
    }
    
    const userPreferences = this.getUserPreferences(user);
    
    try {
      logger.debug(`Enhancing ${recipes.length} recipes with AI service`);
      
      const enhancementResult = await this.makeAIRequest<AIRecipeAnalysisResponse>(
        '/api/enhance-recipes',
        {
          recipes,
          user_preferences: userPreferences,
          ingredients: ingredients || []
        }
      );
      
      if (enhancementResult && enhancementResult.recipes && enhancementResult.recipes.length > 0) {
        logger.info(`AI enhancement successful: Processed ${enhancementResult.recipes.length} recipes`);
        return { 
          recipes: enhancementResult.recipes,
          ai_enhanced: true,
          enhancement_quality: enhancementResult.enhancement_quality || 'standard'
        };
      }
    } catch (error) {
      logger.warn(`AI recipe enhancement failed: ${error instanceof Error ? error.message : String(error)}. Falling back to original recipes.`);
    }
    
    return { recipes, ai_enhanced: false };
  }
  
  /**
   * Enhance a single recipe with AI capabilities
   * @param recipe - Recipe object to enhance
   * @param user - Optional user for personalization
   * @returns Enhanced recipe with AI-generated content
   */
  public async enhanceSingleRecipe(recipe: any, user?: IUser): Promise<any> {
    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      logger.warn('Cannot enhance recipe: Missing recipe data or ingredients');
      return recipe;
    }
    
    try {
      const userPreferences = this.getUserPreferences(user);
      const ingredientsList = this.extractIngredients(recipe);
      
      logger.debug(`Enhancing recipe: ${recipe.title || 'Untitled'}`);
      
      const enhancementResult = await this.makeAIRequest<AIRecipeAnalysisResponse>(
        '/api/enhance-recipes',
        {
          recipes: [recipe],
          user_preferences: userPreferences,
          ingredients: ingredientsList
        }
      );
      
      if (enhancementResult && 
          enhancementResult.recipes && 
          enhancementResult.recipes.length > 0) {
        
        // Merge AI enhancements with original recipe, keeping original ID
        const enhancedRecipe = {
          ...recipe,
          ...enhancementResult.recipes[0],
          _id: recipe._id || enhancementResult.recipes[0]._id
        };
        
        logger.debug('Recipe successfully enhanced with AI data');
        return enhancedRecipe;
      }
    } catch (error) {
      logger.warn(`AI single recipe enhancement failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return recipe;
  }
  
  /**
   * Analyze ingredients with AI for nutrition, substitutions, etc.
   * @param ingredients - Array of ingredient strings
   * @param options - Analysis options
   * @returns Ingredient analysis results
   */
  public async analyzeIngredients(
    ingredients: string[],
    options: AIRecipeAnalysisOptions = {}
  ): Promise<AIIngredientAnalysis> {
    if (!ingredients || ingredients.length === 0) {
      throw new Error('Valid ingredients array is required for analysis');
    }
    
    try {
      logger.debug(`Analyzing ${ingredients.length} ingredients with AI service`);
      
      const analysisResult = await this.makeAIRequest<any>(
        '/api/analyze-ingredients',
        {
          ingredients,
          recipe_title: options.recipeTitle,
          recipe_instructions: options.instructions,
          dietary_restrictions: options.dietaryRestrictions,
          generate_shopping_list: options.generateShoppingList,
          detailed_nutrition: options.detailedNutrition
        }
      );
      
      return {
        substitutions: analysisResult.suggested_additions || [],
        analysis: analysisResult.analysis || {},
        nutritional_info: analysisResult.nutritional_info || {},
        allergens: analysisResult.allergens || []
      };
    } catch (error) {
      logger.error(`Error from AI ingredient analysis service: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to analyze ingredients');
    }
  }
  
  /**
   * Get ingredient substitutions from AI based on dietary restrictions
   * @param ingredients - Array of ingredient strings
   * @param restrictions - Array of dietary restrictions
   * @returns Substitution suggestions and analysis
   */
  public async getIngredientSubstitutions(
    ingredients: string[],
    restrictions?: string[]
  ): Promise<AIIngredientAnalysis> {
    if (!ingredients || ingredients.length === 0) {
      throw new Error('Valid ingredients array is required for substitution analysis');
    }
    
    try {
      logger.debug(`Getting substitutions for ${ingredients.length} ingredients with AI service`);
      
      const substitutionResult = await this.makeAIRequest<any>(
        '/api/analyze-ingredients',
        {
          ingredients,
          dietary_restrictions: restrictions || [],
          request_type: 'substitutions'
        }
      );
      
      if (!substitutionResult || !substitutionResult.suggested_additions) {
        throw new Error('Invalid response from AI service');
      }
      
      return {
        substitutions: substitutionResult.suggested_additions,
        analysis: substitutionResult.analysis || {},
        nutritional_impact: substitutionResult.nutritional_impact || {}
      };
    } catch (error) {
      logger.error(`Error from AI substitution service: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get ingredient substitutions');
    }
  }
  
  /**
   * Get cooking tips for a recipe using AI
   * @param recipe - Recipe object
   * @returns Cooking tips, techniques, and alternatives
   */
  public async getCookingTips(recipe: any): Promise<AICookingTips> {
    if (!recipe) {
      throw new Error('Recipe is required for cooking tips');
    }
    
    try {
      const ingredients = this.extractIngredients(recipe);
      
      logger.debug(`Getting cooking tips for recipe: ${recipe.title || 'Untitled'}`);
      
      const tipsResult = await this.makeAIRequest<any>(
        '/api/analyze-ingredients',
        {
          ingredients,
          recipe_title: recipe.title,
          recipe_instructions: recipe.instructions,
          request_type: 'cooking_tips'
        },
        { timeout: this.requestTimeout * 1.5 } // Allow more time for detailed analysis
      );
      
      if (tipsResult && tipsResult.analysis) {
        return {
          tips: tipsResult.analysis.cooking_tips || [],
          techniques: tipsResult.analysis.technique_suggestions || [],
          alternatives: tipsResult.analysis.alternative_methods || [],
          time_saving_tips: tipsResult.analysis.time_saving_tips || [],
          ai_enhanced: true
        };
      }
    } catch (error) {
      logger.warn(`AI cooking tips request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Fallback to generic cooking tips
    return {
      tips: [
        "Prepare all ingredients before starting to cook (mise en place)",
        "Follow the recipe instructions closely for best results",
        "Taste and adjust seasoning as you cook"
      ],
      techniques: [],
      alternatives: [],
      time_saving_tips: [],
      ai_enhanced: false
    };
  }
  
  /**
   * Train AI model with user interaction data
   * @param data - Training data with user interaction
   * @returns Promise<void>
   */
  public async trainWithUserInteraction(data: AITrainingData): Promise<void> {
    if (!data || !data.recipe_id || !data.user_id) {
      logger.warn('Invalid training data provided');
      return;
    }
    
    try {
      // Get recipe details for training
      const recipe = await this.recipeRepository.findById(data.recipe_id);
      
      if (!recipe) {
        logger.warn(`Cannot train AI: Recipe ${data.recipe_id} not found`);
        return;
      }
      
      // Format training data
      const trainingData = {
        user_id: data.user_id,
        recipe_id: data.recipe_id,
        recipe_title: recipe.title,
        recipe_ingredients: this.extractIngredients(recipe),
        recipe_description: recipe.description || recipe.title,
        cuisine: Array.isArray(recipe.cuisines) ? recipe.cuisines[0] : '',
        user_rating: data.rating || (data.is_favorite ? 5 : undefined),
        is_favorite: data.is_favorite,
        interaction_type: data.interaction_type || 'view',
        timestamp: new Date().toISOString()
      };
      
      // Send training data asynchronously - don't wait for response
      this.makeAIRequest(
        '/api/train',
        {
          training_data: [trainingData],
          force_retrain: false
        },
        { timeout: 10000 } // Longer timeout for training
      )
      .then(() => logger.debug('Successfully sent training data to AI service'))
      .catch(e => logger.warn(`Failed to send training data to AI: ${e instanceof Error ? e.message : String(e)}`));
    } catch (error) {
      logger.warn(`Failed to prepare training data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Bulk train AI model (admin only)
   * @param trainingData - Array of training data objects
   * @param forceRetrain - Whether to force a full model retraining
   * @returns Training result information
   */
  public async bulkTrainModel(
    trainingData: any[],
    forceRetrain: boolean = false
  ): Promise<AIModelTrainingResult> {
    if (!trainingData || trainingData.length === 0) {
      throw new Error('Valid training data is required');
    }
    
    try {
      logger.info(`Bulk training AI model with ${trainingData.length} records`);
      
      const trainingResult = await this.makeAIRequest<any>(
        '/api/train',
        {
          training_data: trainingData,
          force_retrain: forceRetrain
        },
        { timeout: 30000 } // 30 second timeout for bulk training
      );
      
      if (trainingResult && trainingResult.success) {
        return {
          success: true,
          model_info: trainingResult.model_info,
          records_processed: trainingResult.records_processed,
          training_time: trainingResult.training_time
        };
      }
      
      throw new Error('Training response indicates failure');
    } catch (error) {
      logger.error(`AI model training failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to train AI model');
    }
  }
  
  /**
   * Generate a shopping list based on recipes
   * @param recipes - Array of recipe objects
   * @param options - Shopping list options
   * @returns Formatted shopping list
   */
  public async generateShoppingList(
    recipes: any[],
    options: {
      dietaryRestrictions?: string[];
      categorize?: boolean;
      consolidate?: boolean;
    } = {}
  ): Promise<ShoppingListResult> {
    if (!recipes || recipes.length === 0) {
      throw new Error('At least one recipe is required to generate a shopping list');
    }
    
    // Extract all ingredients from recipes
    const allIngredients = recipes.flatMap(recipe => this.extractIngredients(recipe));
    
    if (allIngredients.length === 0) {
      throw new Error('No valid ingredients found in the provided recipes');
    }
    
    try {
      logger.debug(`Generating shopping list from ${allIngredients.length} ingredients across ${recipes.length} recipes`);
      
      const shoppingListResult = await this.makeAIRequest<any>(
        '/api/analyze-ingredients',
        {
          ingredients: allIngredients,
          dietary_restrictions: options.dietaryRestrictions || [],
          generate_shopping_list: true,
          categorize_items: options.categorize !== false,
          consolidate_items: options.consolidate !== false
        }
      );
      
      if (shoppingListResult && 
          shoppingListResult.analysis && 
          shoppingListResult.analysis.shopping_list) {
        
        return {
          shopping_list: shoppingListResult.analysis.shopping_list,
          categorized_list: shoppingListResult.analysis.categorized_list || [],
          estimated_cost: shoppingListResult.analysis.estimated_cost,
          recipe_count: recipes.length,
          ai_enhanced: true
        };
      }
      
      throw new Error('Invalid shopping list response from AI service');
    } catch (error) {
      logger.warn(`AI shopping list generation failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Fallback to basic shopping list
      const uniqueIngredients = [...new Set(allIngredients)].sort();
      
      return {
        shopping_list: uniqueIngredients,
        categorized_list: [],
        recipe_count: recipes.length,
        ai_enhanced: false
      };
    }
  }
  
  /**
   * Get AI health analysis of a recipe
   * @param recipe - Recipe object
   * @param userDietaryRestrictions - Array of user dietary restrictions
   * @returns Health analysis of recipe
   */
  public async getHealthAnalysis(
    recipe: any,
    userDietaryRestrictions?: string[]
  ): Promise<any> {
    if (!recipe) {
      throw new Error('Recipe is required for health analysis');
    }
    
    try {
      const ingredients = this.extractIngredients(recipe);
      
      logger.debug(`Getting health analysis for recipe: ${recipe.title || 'Untitled'}`);
      
      const healthResult = await this.makeAIRequest<any>(
        '/api/analyze-ingredients',
        {
          ingredients,
          recipe_title: recipe.title,
          recipe_instructions: recipe.instructions,
          dietary_restrictions: userDietaryRestrictions || [],
          request_type: 'health_analysis'
        }
      );
      
      if (healthResult && healthResult.analysis) {
        return {
          health_score: healthResult.analysis.health_score,
          nutritional_analysis: healthResult.analysis.nutritional_analysis,
          dietary_compatibility: healthResult.analysis.dietary_compatibility,
          health_benefits: healthResult.analysis.health_benefits,
          ai_enhanced: true
        };
      }
      
      throw new Error('Invalid health analysis response from AI service');
    } catch (error) {
      logger.warn(`AI health analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      
      // Return basic analysis
      return {
        health_score: null,
        nutritional_analysis: {},
        dietary_compatibility: {},
        health_benefits: [],
        ai_enhanced: false
      };
    }
  }
  
  /**
   * Check AI service availability and status
   * @returns Service status information
   */
  public async checkServiceStatus(): Promise<any> {
    try {
      const statusResult = await this.makeAIRequest<any>(
        '/api/status',
        {},
        { timeout: 3000 } // Short timeout for status check
      );
      
      return {
        available: true,
        status: statusResult.status || 'online',
        version: statusResult.version,
        features: statusResult.available_features || []
      };
    } catch (error) {
      logger.error(`AI service unavailable: ${error instanceof Error ? error.message : String(error)}`);
      
      return {
        available: false,
        status: 'offline',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * Get personalized recipe difficulty assessment
   * @param recipe - Recipe object
   * @param user - User for personalization
   * @returns Difficulty assessment
   */
  public async getRecipeDifficultyAssessment(
    recipe: any,
    user?: IUser
  ): Promise<any> {
    if (!recipe) {
      throw new Error('Recipe is required for difficulty assessment');
    }
    
    try {
      const userPreferences = this.getUserPreferences(user);
      const ingredients = this.extractIngredients(recipe);
      
      logger.debug(`Getting difficulty assessment for recipe: ${recipe.title || 'Untitled'}`);
      
      const difficultyResult = await this.makeAIRequest<any>(
        '/api/analyze-recipe',
        {
          recipe: {
            title: recipe.title,
            ingredients: ingredients,
            instructions: recipe.instructions,
            prep_time: recipe.prepTime,
            cook_time: recipe.cookTime
          },
          user_preferences: userPreferences,
          request_type: 'difficulty_assessment'
        }
      );
      
      if (difficultyResult && difficultyResult.analysis) {
        return {
          difficulty_score: difficultyResult.analysis.difficulty_score,
          skill_level: difficultyResult.analysis.skill_level,
          challenging_steps: difficultyResult.analysis.challenging_steps,
          user_specific_challenges: difficultyResult.analysis.user_specific_challenges,
          ai_enhanced: true
        };
      }
    } catch (error) {
      logger.warn(`AI difficulty assessment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Return basic difficulty assessment
    return {
      difficulty_score: recipe.difficulty || 'medium',
      skill_level: recipe.skillLevel || 'intermediate',
      challenging_steps: [],
      user_specific_challenges: [],
      ai_enhanced: false
    };
  }
}