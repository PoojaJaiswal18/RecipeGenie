import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
// Create logger if it doesn't exist
const logger = {
  debug: (message: string) => console.log(`[DEBUG] ${message}`),
  error: (message: string, error?: any) => console.error(`[ERROR] ${message}`, error || '')
};
import { IUser } from '../models/User';
// Import recipe service functions directly
import * as recipeService from '../services/recipeService';
import * as aiServiceModule from '../services/aiService';
import * as userInteractionServiceModule from '../services/userInteractionService';

// Define a type for the user ID to handle both string and ObjectId
type UserIdType = string | any; // 'any' here allows for ObjectId

// Define the SearchRecipeParams interface if it's not exported
interface SearchRecipeParams {
  ingredients: string[];
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  type?: string;
  number: number;
}

// Simple validation function
const validateRecipeInput = (data: any) => {
  // Basic validation logic
  const requiredFields = ['title', 'ingredients', 'instructions'];
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    return {
      validData: null,
      error: `Missing required fields: ${missingFields.join(', ')}`
    };
  }
  
  return {
    validData: data,
    error: null
  };
};

// Helper function to safely extract user ID
const extractUserId = (user: IUser | undefined): UserIdType | undefined => {
  if (!user) return undefined;
  
  // Handle both string IDs and ObjectId
  return user._id ? (typeof user._id === 'object' && user._id.toString ? user._id.toString() : user._id) : undefined;
};

export class RecipeController {
  private aiService: aiServiceModule.AIService;
  private userInteractionService: userInteractionServiceModule.UserInteractionService;
  
  constructor() {
    // No longer need to instantiate RecipeService as we import functions directly
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
  ) => {
    try {
      const { ingredients, cuisine, diet, intolerances, type, number = "10" } = req.query;
      
      // Validate ingredients input
      if (!ingredients) {
        return next(new AppError('Ingredients are required', 400));
      }
      
      // Parse ingredients from query
      const ingredientsList = Array.isArray(ingredients) 
        ? ingredients.map(String)
        : String(ingredients).split(',');
      
      const startTime = Date.now();
      logger.debug(`Starting recipe search for ingredients: ${ingredientsList.join(', ')}`);
      
      // Search parameters
      const searchParams: SearchRecipeParams = {
        ingredients: ingredientsList,
        cuisine: cuisine?.toString(),
        diet: diet?.toString(),
        intolerances: intolerances?.toString(),
        type: type?.toString(),
        number: parseInt(number.toString(), 10)
      };
      
      // Get user for personalization if authenticated
      const user = req.user as IUser | undefined;
      
      // Get base recipes and try to enhance with AI
      const basicRecipes = await recipeService.searchRecipesByIngredients(searchParams);
      const processedRecipes = await recipeService.processRecipesForResponse(basicRecipes, user);
      
      // AI enhancement is now handled within processRecipesForResponse
      const recipes = {
        recipes: processedRecipes,
        ai_enhanced: true // This will be set correctly by the enhancement function
      };
      
      const endTime = Date.now();
      logger.debug(`Recipe search completed in ${endTime - startTime}ms`);
      
      // Return the response
      return res.status(200).json({
        status: 'success',
        results: recipes.recipes.length,
        data: {
          recipes: recipes.recipes,
          ai_enhanced: recipes.ai_enhanced
        }
      });
    } catch (error) {
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
  ) => {
    try {
      const { ingredients } = req.body;
      
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return next(new AppError('Valid ingredients array is required', 400));
      }
      
      const analysis = await this.aiService.analyzeIngredients(ingredients);
      
      return res.status(200).json({
        status: 'success',
        data: analysis
      });
    } catch (error) {
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
  ) => {
    try {
      const { id } = req.params;
      const user = req.user as IUser | undefined;
      
      // Use the exported function directly instead of method from class
      const recipeDetails = await recipeService.getRecipeDetails(parseInt(id, 10));
      
      if (!recipeDetails) {
        return next(new AppError('Recipe not found', 404));
      }
      
      // Track user view if authenticated
      if (user) {
        // Extract user ID safely
        const userId = extractUserId(user);
        if (userId) {
          await this.userInteractionService.recordRecipeView(userId, id);
        }
      }
      
      // Convert the detailed recipe to our format
      const recipe = await recipeService.saveRecipeToDatabase(recipeDetails);
      
      // Try to enhance recipe with AI if applicable
      const enhancedRecipe = await this.aiService.enhanceSingleRecipe(recipe, user);
      
      return res.status(200).json({
        status: 'success',
        data: {
          recipe: enhancedRecipe
        }
      });
    } catch (error) {
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
  ) => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 5;
      
      // Get recipe suggestions using the exported function
      const suggestions = await recipeService.getRecipeSuggestions(user, limit);
      
      // Enhance with AI
      const enhancedResult = await recipeService.enhanceRecipesWithAI(suggestions, user);
      
      const result = {
        recipes: enhancedResult.recipes || suggestions,
        ai_enhanced: !!enhancedResult.recipes
      };
      
      return res.status(200).json({
        status: 'success',
        results: result.recipes.length,
        data: {
          recipes: result.recipes,
          ai_enhanced: result.ai_enhanced
        }
      });
    } catch (error) {
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
  ) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 5;
      const user = req.user as IUser | undefined;
      
      // Get trending recipes using the exported function
      const trendingRecipes = await recipeService.getTrendingRecipes(limit);
      
      // Enhance with AI
      const enhancedResult = await recipeService.enhanceRecipesWithAI(trendingRecipes, user);
      
      const result = {
        recipes: enhancedResult.recipes || trendingRecipes,
        ai_enhanced: !!enhancedResult.recipes
      };
      
      return res.status(200).json({
        status: 'success',
        results: result.recipes.length,
        data: {
          recipes: result.recipes,
          ai_enhanced: result.ai_enhanced
        }
      });
    } catch (error) {
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
  ) => {
    try {
      const { id } = req.params;
      const { rating } = req.body;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return next(new AppError('Rating is required and must be a number between 1 and 5', 400));
      }
      
      // Extract user ID safely
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user ID', 400));
      }
      
      // Update rating in database
      const updatedRecipe = await recipeService.rateRecipe(id, userId, rating);
      
      // Train the AI model with new rating data (async, don't block response)
      this.aiService.trainWithUserInteraction({
        user_id: userId,
        recipe_id: id,
        rating,
        interaction_type: 'rating'
      });
      
      return res.status(200).json({
        status: 'success',
        data: {
          recipe: updatedRecipe
        }
      });
    } catch (error) {
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
  ) => {
    try {
      const { id } = req.params;
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      // Extract user ID safely
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user ID', 400));
      }
      
      // Toggle favorite in database
      const result = await recipeService.toggleFavoriteRecipe(id, userId);
      
      // Train AI if the action was "favorite" (not unfavorite)
      if (result.isFavorite) {
        this.aiService.trainWithUserInteraction({
          user_id: userId,
          recipe_id: id,
          is_favorite: true,
          interaction_type: 'favorite'
        });
      }
      
      return res.status(200).json({
        status: 'success',
        data: result
      });
    } catch (error) {
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
  ) => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user ID', 400));
      }
      
      // Get favorites using the exported function
      const favoriteRecipes = await recipeService.getFavoriteRecipes(userId);
      
      // Enhance with AI
      const enhancedResult = await recipeService.enhanceRecipesWithAI(favoriteRecipes, user);
      
      const result = {
        recipes: enhancedResult.recipes || favoriteRecipes,
        ai_enhanced: !!enhancedResult.recipes
      };
      
      return res.status(200).json({
        status: 'success',
        results: result.recipes.length,
        data: {
          recipes: result.recipes,
          ai_enhanced: result.ai_enhanced
        }
      });
    } catch (error) {
      logger.error('Error in getFavorites:', error);
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
  ) => {
    try {
      const user = req.user as IUser | undefined;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const { validData, error } = validateRecipeInput(req.body);
      
      if (error) {
        return next(new AppError(error, 400));
      }
      
      // Extract user ID safely
      const userId = extractUserId(user);
      if (!userId) {
        return next(new AppError('Invalid user ID', 400));
      }
      
      // Add user ID to recipe data
      const recipeData = {
        ...validData,
        createdBy: userId,
        isCustom: true
      };
      
      // Enhance with AI
      const result = await recipeService.enhanceRecipesWithAI([recipeData], user);
      
      // Save to database - use the first recipe from the enhanced list
      const enhancedRecipe = result.recipes && result.recipes.length > 0 ? result.recipes[0] : recipeData;
      const savedRecipe = await recipeService.saveRecipeToDatabase(enhancedRecipe);
      
      return res.status(201).json({
        status: 'success',
        data: {
          recipe: savedRecipe,
          ai_enhanced: !!result.recipes
        }
      });
    } catch (error) {
      logger.error('Error in addCustomRecipe:', error);
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
  ) => {
    try {
      const { ingredients, restrictions } = req.body;
      
      if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
        return next(new AppError('Valid ingredients array is required', 400));
      }
      
      const result = await this.aiService.getIngredientSubstitutions(ingredients, restrictions);
      
      return res.status(200).json({
        status: 'success',
        data: {
          substitutions: result.substitutions,
          analysis: result.analysis
        }
      });
    } catch (error) {
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
  ) => {
    try {
      const { id } = req.params;
      
      // Get recipe details using the exported function
      const recipeDetails = await recipeService.getRecipeDetails(parseInt(id, 10));
      
      if (!recipeDetails) {
        return next(new AppError('Recipe not found', 404));
      }
      
      // Convert to our format
      const recipe = await recipeService.saveRecipeToDatabase(recipeDetails);
      
      const cookingTips = await this.aiService.getCookingTips(recipe);
      
      return res.status(200).json({
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
    } catch (error) {
      logger.error('Error in getCookingTips:', error);
      return next(error);
    }
  };
}

// Export singleton instance
export const recipeController = new RecipeController();