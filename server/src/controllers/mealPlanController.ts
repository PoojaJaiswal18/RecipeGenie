import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { IUser } from '../models/User';
import { mealPlanService } from '../services/mealPlanService';
import { AIService } from '../services/aiService';
import { 
  IMealPlanPreferences, 
  IShoppingListOptions, 
  IMealPlanResponse, 
  IShoppingListResponse 
} from '../services/mealPlanService';
import { Types } from 'mongoose';

/**
 * Enhanced Request interface with user authentication
 */
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

/**
 * Standardized API response interface
 */
interface APIResponse<T = any> {
  status: 'success' | 'error';
  message: string;
  data?: T;
  timestamp: string;
}

/**
 * Meal Plan Controller - Handles all meal planning HTTP requests
 * Implements comprehensive error handling, input validation, and performance optimization
 */
export class MealPlanController {
  private readonly aiService: AIService;
  private readonly controllerLogger = logger;
  
  constructor() {
    this.aiService = new AIService();
  }

  /**
   * Validate authenticated user from request
   * @param req - Express request object
   * @returns User object or throws error
   */
  private validateAuthenticatedUser(req: AuthenticatedRequest): IUser {
    const user = req.user;
    if (!user || !user._id) {
      throw new AppError('Authentication required', 401);
    }
    return user;
  }

  /**
   * Validate ObjectId format
   * @param id - ID to validate
   * @param fieldName - Name of the field for error messages
   * @returns Valid ObjectId string
   */
  private validateObjectId(id: any, fieldName: string): string {
    if (!id || typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
      throw new AppError(`Invalid ${fieldName} format`, 400);
    }
    return id;
  }

  /**
   * Validate and sanitize meal plan preferences
   * @param preferences - Raw preferences from request body
   * @returns Validated preferences object
   */
  private validateMealPlanPreferences(preferences: any): IMealPlanPreferences {
    const validatedPreferences: IMealPlanPreferences = {};

    if (preferences && typeof preferences === 'object') {
      // Validate diet preference
      if (preferences.diet && typeof preferences.diet === 'string') {
        const diet = preferences.diet.trim();
        if (diet.length > 0 && diet.length <= 50) {
          validatedPreferences.diet = diet;
        }
      }
      
      // Validate cuisine preference
      if (preferences.cuisine && typeof preferences.cuisine === 'string') {
        const cuisine = preferences.cuisine.trim();
        if (cuisine.length > 0 && cuisine.length <= 50) {
          validatedPreferences.cuisine = cuisine;
        }
      }
      
      // Validate max prep time
      if (preferences.maxPrepTime && typeof preferences.maxPrepTime === 'number') {
        const maxPrepTime = Math.floor(preferences.maxPrepTime);
        if (maxPrepTime > 0 && maxPrepTime <= 480) { // Max 8 hours
          validatedPreferences.maxPrepTime = maxPrepTime;
        }
      }
      
      // Validate calories per day
      if (preferences.caloriesPerDay && typeof preferences.caloriesPerDay === 'number') {
        const caloriesPerDay = Math.floor(preferences.caloriesPerDay);
        if (caloriesPerDay >= 800 && caloriesPerDay <= 5000) { // Reasonable range
          validatedPreferences.caloriesPerDay = caloriesPerDay;
        }
      }
      
      // Validate exclude ingredients
      if (Array.isArray(preferences.excludeIngredients)) {
        const excludeIngredients = preferences.excludeIngredients
          .filter((ingredient: any) => 
            typeof ingredient === 'string' && 
            ingredient.trim().length > 0 && 
            ingredient.trim().length <= 100
          )
          .map((ingredient: string) => ingredient.trim().toLowerCase())
          .slice(0, 20); // Limit to 20 ingredients
        
        if (excludeIngredients.length > 0) {
          validatedPreferences.excludeIngredients = excludeIngredients;
        }
      }
    }

    return validatedPreferences;
  }

  /**
   * Validate shopping list options
   * @param options - Raw options from request body
   * @returns Validated options object
   */
  private validateShoppingListOptions(options: any): IShoppingListOptions {
    const validatedOptions: IShoppingListOptions = {};

    if (options && typeof options === 'object') {
      // Validate recipe IDs
      if (options.recipeIds && Array.isArray(options.recipeIds)) {
        const recipeIds = options.recipeIds
          .filter((id: any) => 
            typeof id === 'string' && 
            id.trim().length > 0 && 
            Types.ObjectId.isValid(id.trim())
          )
          .map((id: string) => id.trim())
          .slice(0, 50); // Limit to 50 recipes
        
        if (recipeIds.length > 0) {
          validatedOptions.recipeIds = recipeIds;
        }
      }

      // Validate use meal plan flag
      if (typeof options.useMealPlan === 'boolean') {
        validatedOptions.useMealPlan = options.useMealPlan;
      }
    }

    return validatedOptions;
  }

  /**
   * Create standardized API response
   * @param status - Response status
   * @param message - Response message
   * @param data - Response data
   * @returns Standardized response object
   */
  private createResponse<T>(
    status: 'success' | 'error', 
    message: string, 
    data?: T
  ): APIResponse<T> {
    return {
      status,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log error with proper formatting
   * @param context - Context of the error
   * @param error - Error object
   * @param userId - Optional user ID for context
   */
  private logError(context: string, error: unknown, userId?: string): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const logMessage = userId 
      ? `${context} for user ${userId}: ${errorMessage}`
      : `${context}: ${errorMessage}`;
    
    this.controllerLogger.error(logMessage);
  }

  /**
   * Generate AI-powered weekly meal plan
   * @route POST /api/recipes/user/mealplan/generate
   */
  public generateWeeklyMealPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Starting weekly meal plan generation');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      // Validate and sanitize preferences
      const preferences = this.validateMealPlanPreferences(req.body.preferences);
      
      this.controllerLogger.debug(`Generating meal plan for user ${userId} with preferences: ${JSON.stringify(preferences)}`);
      
      // Generate meal plan using the singleton service
      const result: IMealPlanResponse = await mealPlanService.generateWeeklyMealPlan(
        userId, 
        preferences
      );
      
      this.controllerLogger.info(`Meal plan generated successfully for user ${userId}, AI-enhanced: ${result.ai_generated}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Weekly meal plan generated successfully',
        {
          mealPlan: result.mealPlan,
          ai_generated: result.ai_generated,
          preferences_applied: Object.keys(preferences).length > 0 ? preferences : null
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in generateWeeklyMealPlan', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to generate meal plan', 500));
    }
  };

  /**
   * Get current meal plan for authenticated user
   * @route GET /api/recipes/user/mealplan
   */
  public getMealPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Fetching current meal plan');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      // Get meal plan using the singleton service
      const mealPlan = await mealPlanService.getMealPlan(userId);
      
      if (!mealPlan) {
        return res.status(404).json(this.createResponse(
          'error',
          'No meal plan found. Please generate a meal plan first.'
        ));
      }
      
      this.controllerLogger.info(`Meal plan retrieved successfully for user ${userId}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Meal plan retrieved successfully',
        {
          mealPlan: mealPlan.mealPlan || mealPlan,
          has_meal_plan: true
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in getMealPlan', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to retrieve meal plan', 500));
    }
  };

  /**
   * Update meal plan preferences
   * @route PUT /api/recipes/user/mealplan/preferences
   */
  public updateMealPlanPreferences = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Updating meal plan preferences');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      // Validate and sanitize preferences
      const preferences = this.validateMealPlanPreferences(req.body.preferences);
      
      if (Object.keys(preferences).length === 0) {
        return next(new AppError('At least one valid preference must be provided', 400));
      }
      
      this.controllerLogger.debug(`Updating meal plan preferences for user ${userId}: ${JSON.stringify(preferences)}`);
      
      // Update preferences and regenerate meal plan
      const result: IMealPlanResponse = await mealPlanService.updateMealPlanPreferences(
        userId,
        preferences
      );
      
      this.controllerLogger.info(`Meal plan preferences updated successfully for user ${userId}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Meal plan preferences updated successfully',
        {
          mealPlan: result.mealPlan,
          ai_generated: result.ai_generated,
          updated_preferences: preferences
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in updateMealPlanPreferences', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to update meal plan preferences', 500));
    }
  };

  /**
   * Clear current meal plan
   * @route DELETE /api/recipes/user/mealplan
   */
  public clearMealPlan = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Clearing meal plan');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      // Clear meal plan using the singleton service
      await mealPlanService.clearMealPlan(userId);
      
      this.controllerLogger.info(`Meal plan cleared successfully for user ${userId}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Meal plan cleared successfully',
        {
          cleared: true
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in clearMealPlan', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to clear meal plan', 500));
    }
  };

  /**
   * Generate AI-powered shopping list for recipes or meal plan
   * @route POST /api/recipes/shopping-list
   */
  public generateShoppingList = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Generating shopping list');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      // Validate and sanitize options
      const options = this.validateShoppingListOptions(req.body);
      
      // Validate that either recipeIds or useMealPlan is provided
      if (!options.recipeIds?.length && !options.useMealPlan) {
        return next(new AppError('Either recipeIds or useMealPlan must be provided', 400));
      }
      
      this.controllerLogger.debug(`Generating shopping list for user ${userId} with options: ${JSON.stringify(options)}`);
      
      // Generate shopping list using the singleton service
      const shoppingList: IShoppingListResponse = await mealPlanService.generateShoppingList(
        userId,
        options
      );
      
      this.controllerLogger.info(`Shopping list generated successfully for user ${userId}, AI-enhanced: ${shoppingList.ai_enhanced}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Shopping list generated successfully',
        {
          shopping_list: shoppingList.shopping_list,
          organized_by_category: shoppingList.organized_by_category || [],
          recipe_count: shoppingList.recipe_count,
          ai_enhanced: shoppingList.ai_enhanced,
          total_items: shoppingList.shopping_list.length
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in generateShoppingList', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to generate shopping list', 500));
    }
  };

  /**
   * Get AI-powered cooking tips for a recipe
   * @route GET /api/recipes/:recipeId/cooking-tips
   */
  public getCookingTips = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Getting AI cooking tips');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      const { recipeId } = req.params;
      const validatedRecipeId = this.validateObjectId(recipeId, 'recipe ID');
      
      this.controllerLogger.debug(`Getting cooking tips for recipe ${validatedRecipeId} for user ${userId}`);
      
      // Get cooking tips using AI service
      const cookingTips = await this.aiService.getCookingTips({ _id: validatedRecipeId });
      
      this.controllerLogger.info(`Cooking tips retrieved successfully for recipe ${validatedRecipeId}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Cooking tips retrieved successfully',
        {
          recipe_id: validatedRecipeId,
          tips: cookingTips.tips,
          techniques: cookingTips.techniques,
          alternatives: cookingTips.alternatives,
          time_saving_tips: cookingTips.time_saving_tips,
          ai_enhanced: cookingTips.ai_enhanced,
          tips_count: cookingTips.tips.length
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in getCookingTips', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to get cooking tips', 500));
    }
  };

  /**
   * Health check endpoint for meal plan service
   * @route GET /api/recipes/mealplan/health
   */
  public healthCheck = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.debug('Performing meal plan service health check');
      
      // Check AI service status
      const aiServiceStatus = await this.aiService.checkServiceStatus();
      
      return res.status(200).json(this.createResponse(
        'success',
        'Meal plan service is healthy',
        {
          service: 'meal-plan',
          status: 'healthy',
          ai_service: aiServiceStatus,
          uptime: process.uptime(),
          memory_usage: process.memoryUsage()
        }
      ));
    } catch (error: unknown) {
      this.logError('Error in healthCheck', error);
      
      return res.status(503).json(this.createResponse(
        'error',
        'Meal plan service is unhealthy',
        {
          service: 'meal-plan',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      ));
    }
  };

  /**
   * Get meal plan statistics for user
   * @route GET /api/recipes/user/mealplan/stats
   */
  public getMealPlanStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      this.controllerLogger.info('Getting meal plan statistics');
      
      // Validate authentication
      const user = this.validateAuthenticatedUser(req);
      const userId = this.validateObjectId(user._id, 'user ID');
      
      // Get meal plan
      const mealPlan = await mealPlanService.getMealPlan(userId);
      
      if (!mealPlan) {
        return res.status(404).json(this.createResponse(
          'error',
          'No meal plan found to analyze'
        ));
      }
      
      // Calculate statistics
      const stats = {
        total_meals: mealPlan.mealPlan?.length || 0,
        meals_by_day: {},
        meals_by_type: {},
        has_meal_plan: true,
        last_updated: mealPlan.updatedAt || new Date()
      };
      
      this.controllerLogger.info(`Meal plan statistics retrieved successfully for user ${userId}`);
      
      return res.status(200).json(this.createResponse(
        'success',
        'Meal plan statistics retrieved successfully',
        stats
      ));
    } catch (error: unknown) {
      this.logError('Error in getMealPlanStats', error);
      
      if (error instanceof AppError) {
        return next(error);
      }
      
      return next(new AppError('Failed to get meal plan statistics', 500));
    }
  };
}

export const mealPlanController = new MealPlanController();
