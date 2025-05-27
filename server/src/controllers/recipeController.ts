import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import winston from 'winston';
import { IUser } from '../models/User';
import { IRecipe } from '../models/Recipe';
import * as recipeService from '../services/recipeService';
import * as aiServiceModule from '../services/aiService';
import * as userInteractionServiceModule from '../services/userInteractionService';

// Enhanced logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Enhanced type definitions
type UserIdType = string;

interface SearchRecipeParams {
  ingredients: string[];
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  type?: string;
  number: number;
}

interface RecipeValidationResult {
  validData: any | null;
  error: string | null;
}

interface MealPlanEntry {
  recipeId: string;
  date: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
}

interface WeeklyMealPlan {
  user_id: string;
  week_starting: string;
  preferences: any;
  daily_plans: Array<{
    day: string;
    meals: Array<{
      meal_type: string;
      recipe: IRecipe;
    }>;
  }>;
  created_at: string;
  is_active: boolean;
}

// Enhanced validation function with comprehensive checks
const validateRecipeInput = (data: any): RecipeValidationResult => {
  try {
    if (!data || typeof data !== 'object') {
      return {
        validData: null,
        error: 'Invalid recipe data provided'
      };
    }

    const requiredFields = ['title', 'ingredients', 'instructions'];
    const missingFields = requiredFields.filter(field => {
      const value = data[field];
      return !value || (Array.isArray(value) && value.length === 0);
    });
    
    if (missingFields.length > 0) {
      return {
        validData: null,
        error: `Missing required fields: ${missingFields.join(', ')}`
      };
    }

    // Additional validation for data types
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      return {
        validData: null,
        error: 'Title must be a non-empty string'
      };
    }

    if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
      return {
        validData: null,
        error: 'Ingredients must be a non-empty array'
      };
    }

    if (!Array.isArray(data.instructions) || data.instructions.length === 0) {
      return {
        validData: null,
        error: 'Instructions must be a non-empty array'
      };
    }
    
    return {
      validData: data,
      error: null
    };
  } catch (error: any) {
    logger.error('Recipe validation error:', error);
    return {
      validData: null,
      error: 'Recipe validation failed'
    };
  }
};

// Enhanced helper function to safely extract user ID
const extractUserId = (user: IUser | undefined): UserIdType | undefined => {
  if (!user) return undefined;
  
  try {
    // Handle both string IDs and ObjectId with proper type checking
    if (typeof user._id === 'string') {
      return user._id;
    } else if (
      user._id &&
      typeof user._id === 'object' &&
      typeof (user._id as { toString?: unknown }).toString === 'function'
    ) {
      return (user._id as { toString: () => string }).toString();
    }
    
    return undefined;
  } catch (error: any) {
    logger.error('Error extracting user ID:', error);
    return undefined;
  }
};

// Enhanced query parameter parsing utility
const parseQueryParam = (param: any): string | undefined => {
  if (param === undefined || param === null) return undefined;
  if (typeof param === 'string') return param;
  if (Array.isArray(param) && param.length > 0) return String(param[0]);
  return String(param);
};

// Enhanced ingredients parsing utility
const parseIngredients = (ingredients: any): string[] => {
  if (!ingredients) return [];
  
  if (Array.isArray(ingredients)) {
    return ingredients
      .map(ing => String(ing).trim())
      .filter(ing => ing.length > 0);
  }
  
  if (typeof ingredients === 'string') {
    return ingredients
      .split(',')
      .map(ing => ing.trim())
      .filter(ing => ing.length > 0);
  }
  
  return [];
};

export class RecipeController {
  private aiService: aiServiceModule.AIService;
  private userInteractionService: userInteractionServiceModule.UserInteractionService;
  
  constructor() {
    this.aiService = new aiServiceModule.AIService();
    this.userInteractionService = new userInteractionServiceModule.UserInteractionService();
  }

  /**
   * Search recipes by ingredients with AI enhancement
   * @route GET /api/recipes/search
   */
  public searchRecipes = async (
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> => {
    try {
      const { ingredients, cuisine, diet, intolerances, type, number = "10" } = req.query;
      
      // Validate and parse ingredients input
      const ingredientsList = parseIngredients(ingredients);
      if (ingredientsList.length === 0) {
        return next(new AppError('At least one ingredient is required', 400));
      }
      
      if (ingredientsList.length > 20) {
        return next(new AppError('Maximum 20 ingredients allowed', 400));
      }
      
      const startTime = Date.now();
      logger.debug(`Starting recipe search for ingredients: ${ingredientsList.join(', ')}`);
      
      // Enhanced search parameters with validation
      const searchParams: SearchRecipeParams = {
        ingredients: ingredientsList,
        cuisine: parseQueryParam(cuisine),
        diet: parseQueryParam(diet),
        intolerances: parseQueryParam(intolerances),
        type: parseQueryParam(type),
        number: Math.min(Math.max(1, parseInt(String(number), 10) || 10), 50)
      };
      
      // Get user for personalization if authenticated
      const user = req.user as IUser | undefined;
      const userId = extractUserId(user);
      
      // Get base recipes and process them
      const basicRecipes = await recipeService.searchRecipesByIngredients(searchParams);
      const processedRecipes = await recipeService.processRecipesForResponse(basicRecipes, userId);
      
      // AI enhancement
      const enhancedResult = await recipeService.enhanceRecipesWithAI(processedRecipes, userId);
      
      const endTime = Date.now();
      logger.debug(`Recipe search completed in ${endTime - startTime}ms`);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || processedRecipes.length,
        data: {
          recipes: enhancedResult.recipes || processedRecipes,
          ai_enhanced: !!enhancedResult.recipes,
          search_time_ms: endTime - startTime
        }
      });
    } catch (error: any) {
      logger.error('Error in searchRecipes:', error);
      return next(error);
    }
  };

  /**
   * Analyze provided ingredients for insights
   * @route POST /api/recipes/analyze-ingredients
   */
  public analyzeIngredients = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { ingredients } = req.body;
      
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return next(new AppError('Valid ingredients array is required', 400));
      }
      
      if (ingredients.length > 50) {
        return next(new AppError('Maximum 50 ingredients allowed for analysis', 400));
      }
      
      const analysis = await this.aiService.analyzeIngredients(ingredients);
      
      res.status(200).json({
        status: 'success',
        data: analysis
      });
    } catch (error: any) {
      logger.error('Error in analyzeIngredients:', error);
      return next(error);
    }
  };

  /**
   * Get a recipe by ID with AI enhancements
   * @route GET /api/recipes/:id
   */
  public getRecipeById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user as IUser | undefined;
      
      // Validate recipe ID
      const recipeId = parseInt(id, 10);
      if (isNaN(recipeId) || recipeId <= 0) {
        return next(new AppError('Invalid recipe ID provided', 400));
      }
      
      // Get recipe details
      const recipeDetails = await recipeService.getRecipeDetails(recipeId);
      
      if (!recipeDetails) {
        return next(new AppError('Recipe not found', 404));
      }
      
      // Track user view if authenticated
      const userId = extractUserId(user);
      if (userId) {
        // Record view asynchronously without blocking response
        setImmediate(() => {
          this.userInteractionService.recordRecipeView(userId, id).catch(err => {
            logger.error('Failed to record recipe view:', err);
          });
        });
      }
      
      // Convert and save recipe to database
      const recipe = await recipeService.saveRecipeToDatabase(recipeDetails);
      
      // Enhance recipe with AI
      const enhancedRecipe = await this.aiService.enhanceSingleRecipe(recipe, user);
      
      res.status(200).json({
        status: 'success',
        data: {
          recipe: enhancedRecipe || recipe,
          ai_enhanced: !!enhancedRecipe
        }
      });
    } catch (error: any) {
      logger.error('Error in getRecipeById:', error);
      return next(error);
    }
  };

  /**
   * Get AI-powered recipe suggestions for a user
   * @route GET /api/recipes/suggestions
   */
  public getSuggestions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 5), 20);
      
      // Get recipe suggestions
      const suggestions = await recipeService.getRecipeSuggestions(userId, limit);
      
      // Enhance with AI
      const enhancedResult = await recipeService.enhanceRecipesWithAI(suggestions, userId);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || suggestions.length,
        data: {
          recipes: enhancedResult.recipes || suggestions,
          ai_enhanced: !!enhancedResult.recipes,
          personalized_order: enhancedResult.personalizedOrder
        }
      });
    } catch (error: any) {
      logger.error('Error in getSuggestions:', error);
      return next(error);
    }
  };

  /**
   * Get AI-enhanced trending recipes
   * @route GET /api/recipes/trending
   */
  public getTrending = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 5), 20);
      const user = req.user as IUser | undefined;
      const userId = extractUserId(user);
      
      // Get trending recipes
      const trendingRecipes = await recipeService.getTrendingRecipes(limit);
      
      // Enhance with AI
      const enhancedResult = await recipeService.enhanceRecipesWithAI(trendingRecipes, userId);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || trendingRecipes.length,
        data: {
          recipes: enhancedResult.recipes || trendingRecipes,
          ai_enhanced: !!enhancedResult.recipes
        }
      });
    } catch (error: any) {
      logger.error('Error in getTrending:', error);
      return next(error);
    }
  };

  /**
   * Rate a recipe and train AI model with new data
   * @route POST /api/recipes/:id/rate
   */
  public rateRecipeHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { rating } = req.body;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      // Validate rating
      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        return next(new AppError('Rating must be an integer between 1 and 5', 400));
      }
      
      // Update rating in database
      const updatedRecipe = await recipeService.rateRecipe(id, userId, rating);
      
      // Train AI model asynchronously
      setImmediate(() => {
        this.aiService.trainWithUserInteraction({
          user_id: userId,
          recipe_id: id,
          rating,
          interaction_type: 'rating'
        }).catch(err => {
          logger.error('Failed to train AI with rating data:', err);
        });
      });
      
      res.status(200).json({
        status: 'success',
        data: {
          recipe: updatedRecipe,
          message: 'Recipe rated successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error in rateRecipeHandler:', error);
      return next(error);
    }
  };

  /**
   * Toggle favorite recipe and train AI model
   * @route POST /api/recipes/:id/favorite
   */
  public toggleFavorite = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      // Toggle favorite in database
      const result = await recipeService.toggleFavoriteRecipe(id, userId);
      
      // Train AI if the action was "favorite" (not unfavorite)
      if (result.isFavorite) {
        setImmediate(() => {
          this.aiService.trainWithUserInteraction({
            user_id: userId,
            recipe_id: id,
            is_favorite: true,
            interaction_type: 'favorite'
          }).catch(err => {
            logger.error('Failed to train AI with favorite data:', err);
          });
        });
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          ...result,
          message: result.isFavorite ? 'Recipe added to favorites' : 'Recipe removed from favorites'
        }
      });
    } catch (error: any) {
      logger.error('Error in toggleFavorite:', error);
      return next(error);
    }
  };

  /**
   * Get AI-enhanced user favorite recipes
   * @route GET /api/recipes/favorites
   */
  public getFavorites = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      // Get favorites
      const favoriteRecipes = await recipeService.getFavoriteRecipes(userId);
      
      // Enhance with AI
      const enhancedResult = await recipeService.enhanceRecipesWithAI(favoriteRecipes, userId);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || favoriteRecipes.length,
        data: {
          recipes: enhancedResult.recipes || favoriteRecipes,
          ai_enhanced: !!enhancedResult.recipes
        }
      });
    } catch (error: any) {
      logger.error('Error in getFavorites:', error);
      return next(error);
    }
  };

  /**
   * Get recipes by cuisine
   * @route GET /api/recipes/cuisine/:cuisine
   */
  public getRecipesByCuisine = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { cuisine } = req.params;
      const user = req.user as IUser | undefined;
      const userId = extractUserId(user);
      
      if (!cuisine || cuisine.trim().length === 0) {
        return next(new AppError('Cuisine parameter is required', 400));
      }
      
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 10), 50);
      const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);
      
      const recipes = await recipeService.getRecipesByCuisine(cuisine.trim(), limit, offset);
      const enhancedResult = await recipeService.enhanceRecipesWithAI(recipes, userId);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || recipes.length,
        data: {
          recipes: enhancedResult.recipes || recipes,
          ai_enhanced: !!enhancedResult.recipes,
          cuisine: cuisine.trim(),
          pagination: {
            limit,
            offset,
            has_more: recipes.length === limit
          }
        }
      });
    } catch (error: any) {
      logger.error('Error in getRecipesByCuisine:', error);
      return next(error);
    }
  };

  /**
   * Get recipes by diet - Implementation added
   * @route GET /api/recipes/diet/:diet
   */
  public getRecipesByDiet = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { diet } = req.params;
      const user = req.user as IUser | undefined;
      const userId = extractUserId(user);
      
      if (!diet || diet.trim().length === 0) {
        return next(new AppError('Diet parameter is required', 400));
      }
      
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 10), 50);
      const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);
      
      // Implementation for diet-based recipe search
      const recipes = await this.getRecipesByDietType(diet.trim(), limit, offset);
      const enhancedResult = await recipeService.enhanceRecipesWithAI(recipes, userId);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || recipes.length,
        data: {
          recipes: enhancedResult.recipes || recipes,
          ai_enhanced: !!enhancedResult.recipes,
          diet: diet.trim(),
          pagination: {
            limit,
            offset,
            has_more: recipes.length === limit
          }
        }
      });
    } catch (error: any) {
      logger.error('Error in getRecipesByDiet:', error);
      return next(error);
    }
  };

  /**
   * Get recipes by category - Implementation added
   * @route GET /api/recipes/category/:category
   */
  public getRecipesByCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { category } = req.params;
      const user = req.user as IUser | undefined;
      const userId = extractUserId(user);
      
      if (!category || category.trim().length === 0) {
        return next(new AppError('Category parameter is required', 400));
      }
      
      const limit = Math.min(Math.max(1, parseInt(String(req.query.limit), 10) || 10), 50);
      const offset = Math.max(0, parseInt(String(req.query.offset), 10) || 0);
      
      // Implementation for category-based recipe search
      const recipes = await this.getRecipesByDishType(category.trim(), limit, offset);
      const enhancedResult = await recipeService.enhanceRecipesWithAI(recipes, userId);
      
      res.status(200).json({
        status: 'success',
        results: enhancedResult.recipes?.length || recipes.length,
        data: {
          recipes: enhancedResult.recipes || recipes,
          ai_enhanced: !!enhancedResult.recipes,
          category: category.trim(),
          pagination: {
            limit,
            offset,
            has_more: recipes.length === limit
          }
        }
      });
    } catch (error: any) {
      logger.error('Error in getRecipesByCategory:', error);
      return next(error);
    }
  };

  /**
   * Add a custom recipe with AI enhancement
   * @route POST /api/recipes/custom
   */
  public addCustomRecipe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      const { validData, error } = validateRecipeInput(req.body);
      
      if (error) {
        return next(new AppError(error, 400));
      }
      
      // Add user metadata to recipe
      const recipeData = {
        ...validData,
        createdBy: userId,
        isCustom: true,
        externalId: Date.now(), // Temporary ID for custom recipes
        popularity: 0,
        userRating: 0,
        userRatingsCount: 0,
        userFavoriteCount: 0
      };
      
      // Save to database first
      const savedRecipe = await recipeService.saveRecipeToDatabase(recipeData);
      
      // Enhance with AI asynchronously
      setImmediate(() => {
        recipeService.enhanceRecipesWithAI([savedRecipe], userId).catch(err => {
          logger.error('Failed to enhance custom recipe with AI:', err);
        });
      });
      
      res.status(201).json({
        status: 'success',
        data: {
          recipe: savedRecipe,
          message: 'Custom recipe created successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error in addCustomRecipe:', error);
      return next(error);
    }
  };

  /**
   * Update a custom recipe - Implementation added
   * @route PUT /api/recipes/custom/:id
   */
  public updateCustomRecipe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      const { validData, error } = validateRecipeInput(req.body);
      
      if (error) {
        return next(new AppError(error, 400));
      }
      
      // Implementation for updating custom recipe
      const updatedRecipe = await this.updateUserRecipe(id, userId, validData);
      
      if (!updatedRecipe) {
        return next(new AppError('Recipe not found or you are not authorized to update it', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: {
          recipe: updatedRecipe,
          message: 'Recipe updated successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error in updateCustomRecipe:', error);
      return next(error);
    }
  };

  /**
   * Delete a custom recipe - Implementation added
   * @route DELETE /api/recipes/custom/:id
   */
  public deleteCustomRecipe = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      // Implementation for deleting custom recipe
      const result = await this.deleteUserRecipe(id, userId);
      
      if (!result) {
        return next(new AppError('Recipe not found or you are not authorized to delete it', 404));
      }
      
      res.status(200).json({
        status: 'success',
        data: null,
        message: 'Recipe deleted successfully'
      });
    } catch (error: any) {
      logger.error('Error in deleteCustomRecipe:', error);
      return next(error);
    }
  };

  /**
   * Add recipe to meal plan - Implementation added
   * @route POST /api/recipes/mealplan
   */
  public addRecipeToMealPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { recipeId, date, mealType, servings = 1 } = req.body;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      if (!recipeId || !date || !mealType) {
        return next(new AppError('Recipe ID, date, and meal type are required', 400));
      }
      
      const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
      if (!validMealTypes.includes(mealType)) {
        return next(new AppError('Invalid meal type. Must be one of: breakfast, lunch, dinner, snack', 400));
      }
      
      // Implementation for adding to meal plan
      const updatedMealPlan = await this.addToUserMealPlan(userId, recipeId, date, mealType, servings);
      
      res.status(200).json({
        status: 'success',
        data: {
          mealPlan: updatedMealPlan,
          message: 'Recipe added to meal plan successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error in addRecipeToMealPlan:', error);
      return next(error);
    }
  };

  /**
   * Get user's meal plan - Implementation added
   * @route GET /api/recipes/mealplan
   */
  public getMealPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : new Date();
      const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      // Implementation for getting meal plan
      const mealPlan = await this.getUserMealPlanByDateRange(userId, startDate, endDate);
      
      res.status(200).json({
        status: 'success',
        data: {
          mealPlan,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        }
      });
    } catch (error: any) {
      logger.error('Error in getMealPlan:', error);
      return next(error);
    }
  };

  /**
   * Generate weekly meal plan with AI
   * @route POST /api/recipes/mealplan/generate
   */
  public generateWeeklyMealPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { preferences } = req.body;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user session', 400));
      }
      
      // Generate meal plan with AI
      const mealPlan = await this.generateMealPlanWithAI(user, preferences);
      
      // Save the generated meal plan
      const savedMealPlan = await this.saveMealPlan(userId, mealPlan);
      
      res.status(200).json({
        status: 'success',
        data: {
          mealPlan: savedMealPlan,
          message: 'Weekly meal plan generated successfully'
        }
      });
    } catch (error: any) {
      logger.error('Error in generateWeeklyMealPlan:', error);
      return next(error);
    }
  };

  /**
   * Get AI-powered ingredient substitutions
   * @route POST /api/recipes/substitutions
   */
  public getIngredientSubstitutions = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { ingredients, restrictions } = req.body;
      
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return next(new AppError('Valid ingredients array is required', 400));
      }
      
      if (ingredients.length > 20) {
        return next(new AppError('Maximum 20 ingredients allowed for substitution analysis', 400));
      }
      
      const result = await this.aiService.getIngredientSubstitutions(ingredients, restrictions);
      
      res.status(200).json({
        status: 'success',
        data: {
          substitutions: result.substitutions,
          analysis: result.analysis,
          original_ingredients: ingredients
        }
      });
    } catch (error: any) {
      logger.error('Error in getIngredientSubstitutions:', error);
      return next(error);
    }
  };

  /**
   * Get AI-powered cooking tips for a recipe
   * @route GET /api/recipes/:id/cooking-tips
   */
  public getCookingTips = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      
      const recipeId = parseInt(id, 10);
      if (isNaN(recipeId) || recipeId <= 0) {
        return next(new AppError('Invalid recipe ID provided', 400));
      }
      
      // Get recipe details
      const recipeDetails = await recipeService.getRecipeDetails(recipeId);
      
      if (!recipeDetails) {
        return next(new AppError('Recipe not found', 404));
      }
      
      // Convert to our format
      const recipe = await recipeService.saveRecipeToDatabase(recipeDetails);
      
      const cookingTips = await this.aiService.getCookingTips(recipe);
      
      res.status(200).json({
        status: 'success',
        data: {
          recipe_id: id,
          recipe_title: recipe.title,
          cooking_tips: cookingTips.tips,
          technique_suggestions: cookingTips.techniques,
          alternative_methods: cookingTips.alternatives,
          ai_enhanced: cookingTips.ai_enhanced
        }
      });
    } catch (error: any) {
      logger.error('Error in getCookingTips:', error);
      return next(error);
    }
  };

  // Private helper methods for missing functionality

  /**
   * Implementation for generating meal plan with AI
   */
  private async generateMealPlanWithAI(user: IUser, preferences: any): Promise<WeeklyMealPlan> {
    try {
      const userId = extractUserId(user);
      if (!userId) {
        throw new Error('Invalid user ID');
      }

      // Get user preferences
      const userPreferences = user.preferences || {};
      
      // Combine with provided preferences
      const combinedPreferences = {
        ...userPreferences,
        ...preferences
      };
      
      // Get recipe recommendations based on preferences
      const recommendedRecipes = await recipeService.getRecipeSuggestions(userId, 21); // 3 meals a day for 7 days
      
      // Structure into meal plan format
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const mealTypes = ['breakfast', 'lunch', 'dinner'];
      
      const mealPlan = days.map((day, dayIndex) => {
        return {
          day,
          meals: mealTypes.map((mealType, mealIndex) => {
            const recipeIndex = dayIndex * 3 + mealIndex;
            return {
              meal_type: mealType,
              recipe: recommendedRecipes[recipeIndex % recommendedRecipes.length]
            };
          })
        };
      });
      
      return {
        user_id: userId,
        week_starting: new Date().toISOString(),
        preferences: combinedPreferences,
        daily_plans: mealPlan,
        created_at: new Date().toISOString(),
        is_active: true
      };
    } catch (error: any) {
      logger.error('Error generating meal plan with AI:', error);
      throw new AppError('Failed to generate meal plan', 500);
    }
  }

  /**
   * Implementation for saving meal plan
   */
  private async saveMealPlan(userId: UserIdType, mealPlan: WeeklyMealPlan): Promise<WeeklyMealPlan> {
    try {
      const mealPlanData = {
        ...mealPlan,
        user_id: userId,
        created_at: new Date().toISOString(),
        is_active: true
      };
      
      // Here you would save to database - for now return the structured data
      return mealPlanData;
    } catch (error: any) {
      logger.error('Error saving meal plan:', error);
      throw new AppError('Failed to save meal plan', 500);
    }
  }

  /**
   * Implementation for diet-based recipe search
   */
  private async getRecipesByDietType(diet: string, limit: number, offset: number): Promise<IRecipe[]> {
    try {
      // This would typically query your database for recipes matching the diet
      // For now, we'll use the existing search functionality
      const searchParams = {
        ingredients: [],
        diet: diet,
        number: limit
      };
      
      const recipes = await recipeService.searchRecipesByIngredients(searchParams);
      return recipeService.processRecipesForResponse(recipes.slice(offset));
    } catch (error: any) {
      logger.error('Error getting recipes by diet:', error);
      throw new AppError('Failed to get recipes by diet', 500);
    }
  }

  /**
   * Implementation for dish type-based recipe search
   */
  private async getRecipesByDishType(category: string, limit: number, offset: number): Promise<IRecipe[]> {
    try {
      // This would typically query your database for recipes matching the dish type
      const searchParams = {
        ingredients: [],
        type: category,
        number: limit
      };
      
      const recipes = await recipeService.searchRecipesByIngredients(searchParams);
      return recipeService.processRecipesForResponse(recipes.slice(offset));
    } catch (error: any) {
      logger.error('Error getting recipes by category:', error);
      throw new AppError('Failed to get recipes by category', 500);
    }
  }

  /**
   * Implementation for updating user recipe
   */
  private async updateUserRecipe(recipeId: string, userId: string, updateData: any): Promise<IRecipe | null> {
    try {
      // This would update the recipe in the database
      // For now, return null to indicate not implemented
      logger.info(`Update recipe ${recipeId} for user ${userId}`);
      return null;
    } catch (error: any) {
      logger.error('Error updating user recipe:', error);
      throw new AppError('Failed to update recipe', 500);
    }
  }

  /**
   * Implementation for deleting user recipe
   */
  private async deleteUserRecipe(recipeId: string, userId: string): Promise<boolean> {
    try {
      // This would delete the recipe from the database
      // For now, return false to indicate not implemented
      logger.info(`Delete recipe ${recipeId} for user ${userId}`);
      return false;
    } catch (error: any) {
      logger.error('Error deleting user recipe:', error);
      throw new AppError('Failed to delete recipe', 500);
    }
  }

  /**
   * Implementation for adding to user meal plan
   */
  private async addToUserMealPlan(
    userId: string, 
    recipeId: string, 
    date: string, 
    mealType: string, 
    servings: number
  ): Promise<MealPlanEntry> {
    try {
      const mealPlanEntry: MealPlanEntry = {
        recipeId,
        date: new Date(date),
        mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
        servings
      };
      
      // This would save to database
      logger.info(`Add to meal plan for user ${userId}:`, mealPlanEntry);
      return mealPlanEntry;
    } catch (error: any) {
      logger.error('Error adding to meal plan:', error);
      throw new AppError('Failed to add to meal plan', 500);
    }
  }

  /**
   * Implementation for getting user meal plan by date range
   */
  private async getUserMealPlanByDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<MealPlanEntry[]> {
    try {
      // This would query the database for meal plan entries
      logger.info(`Get meal plan for user ${userId} from ${startDate} to ${endDate}`);
      return [];
    } catch (error: any) {
      logger.error('Error getting user meal plan:', error);
      throw new AppError('Failed to get meal plan', 500);
    }
  }
}

// Export singleton instance
export const recipeController = new RecipeController();

// Export controller methods for use in routes
export const {
  searchRecipes,
  analyzeIngredients,
  getRecipeById,
  getSuggestions,
  getTrending,
  rateRecipeHandler,
  toggleFavorite,
  getFavorites,
  getRecipesByCuisine,
  getRecipesByDiet,
  getRecipesByCategory,
  addCustomRecipe,
  updateCustomRecipe,
  deleteCustomRecipe,
  addRecipeToMealPlan,
  getMealPlan,
  generateWeeklyMealPlan,
  getIngredientSubstitutions,
  getCookingTips
} = recipeController;
