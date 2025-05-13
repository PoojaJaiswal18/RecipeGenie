import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { IUser } from '../models/User';
import { 
  enhanceRecipes, 
  analyzeIngredients, 
  trainModel, 
  generateShoppingList,
  getCookingTipsForRecipe
} from '../services/aiService';
import { 
  extractRecentIngredients, 
  formatUserPreferences 
} from '../services/userInteractionService';
import { Recipe } from '../models/Recipe';
import { logger } from '../utils/logger';
import { validateInputArray, validatePositiveNumber } from '../utils/validationUtils';
import { 
  EnhanceRecipesRequestDto, 
  AnalyzeIngredientsRequestDto, 
  TrainingDataDto, 
  ShoppingListRequestDto 
} from '../dto/aiDto';

/**
 * Enhances recipes using AI service with user preferences and context
 * @route POST /api/ai/enhance-recipes
 */
export const enhanceRecipesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { recipes, user_preferences, ingredients } = req.body as EnhanceRecipesRequestDto;
    
    // Validate input data
    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return next(new AppError('Valid recipes array is required', 400));
    }

    const startTime = Date.now();
    logger.debug(`Starting recipe enhancement for ${recipes.length} recipes`);
    
    // Call AI service to enhance recipes
    const enhancedRecipes = await enhanceRecipes(recipes, user_preferences, ingredients);
    
    const endTime = Date.now();
    logger.debug(`Recipe enhancement completed in ${endTime - startTime}ms`);
    
    return res.status(200).json({
      status: 'success',
      results: enhancedRecipes.length,
      data: {
        recipes: enhancedRecipes
      }
    });
  } catch (error) {
    logger.error('Error in enhanceRecipesHandler:', error);
    return next(error);
  }
};

/**
 * Analyzes ingredients for insights, substitutions, and cooking tips
 * @route POST /api/ai/analyze-ingredients
 */
export const analyzeIngredientsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { 
      ingredients, 
      dietary_restrictions, 
      recipe_title, 
      recipe_instructions,
      generate_shopping_list
    } = req.body as AnalyzeIngredientsRequestDto;
    
    // Validate ingredients input
    if (!validateInputArray(ingredients)) {
      return next(new AppError('Valid ingredients array is required', 400));
    }
    
    // Call AI service for ingredient analysis
    const analysis = await analyzeIngredients({
      ingredients,
      dietaryRestrictions: dietary_restrictions || [],
      recipeTitle: recipe_title,
      recipeInstructions: recipe_instructions,
      generateShoppingList: generate_shopping_list || false
    });
    
    return res.status(200).json({
      status: 'success',
      data: analysis
    });
  } catch (error) {
    logger.error('Error in analyzeIngredientsHandler:', error);
    return next(error);
  }
};

/**
 * Gets AI-powered cooking tips for a specific recipe
 * @route GET /api/ai/cooking-tips/:id
 */
export const getCookingTipsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    // Get recipe details
    let recipe;
    
    // Check if this is a MongoDB ObjectId or external ID
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      recipe = await Recipe.findById(id);
    } else {
      // Try to get by external ID
      const externalId = parseInt(id, 10);
      
      if (isNaN(externalId)) {
        return next(new AppError('Invalid recipe ID format', 400));
      }
      
      recipe = await Recipe.findOne({ externalId });
    }
    
    if (!recipe) {
      return next(new AppError('Recipe not found', 404));
    }
    
    // Extract ingredients from recipe
    const ingredients = recipe.ingredients.map(ing => 
      typeof ing === 'string' ? ing : ing.name
    );
    
    // Get cooking tips from AI service
    const cookingTips = await getCookingTipsForRecipe(
      ingredients,
      recipe.title,
      recipe.instructions
    );
    
    return res.status(200).json({
      status: 'success',
      data: {
        recipe_id: id,
        recipe_title: recipe.title,
        cooking_tips: cookingTips.cookingTips || [],
        technique_suggestions: cookingTips.techniqueSuggestions || [],
        alternative_methods: cookingTips.alternativeMethods || [],
        ai_enhanced: true
      }
    });
  } catch (error) {
    logger.error('Error in getCookingTipsHandler:', error);
    return next(error);
  }
};

/**
 * Generates an AI-optimized shopping list from recipes or meal plan
 * @route POST /api/ai/shopping-list
 */
export const generateShoppingListHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { recipeIds, useMealPlan } = req.body as ShoppingListRequestDto;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    // Validate input - either recipeIds or useMealPlan must be provided
    if ((!recipeIds || !Array.isArray(recipeIds) || recipeIds.length === 0) && !useMealPlan) {
      return next(new AppError('Either recipeIds or useMealPlan must be provided', 400));
    }
    
    // Get shopping list from service
    const shoppingListResult = await generateShoppingList(user, recipeIds, useMealPlan);
    
    if (!shoppingListResult.success) {
      return next(new AppError(shoppingListResult.error || 'Failed to generate shopping list', 400));
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        shopping_list: shoppingListResult.shoppingList,
        organized_by_category: shoppingListResult.categorizedList,
        recipe_count: shoppingListResult.recipeCount,
        ai_enhanced: shoppingListResult.aiEnhanced
      }
    });
  } catch (error) {
    logger.error('Error in generateShoppingListHandler:', error);
    return next(error);
  }
};

/**
 * Trains the AI model with new user interaction data
 * @route POST /api/ai/train
 * @access Admin only
 */
export const trainAIModelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { training_data, force_retrain } = req.body as { 
      training_data: TrainingDataDto[],
      force_retrain: boolean
    };
    
    // Verify admin status if bulk training
    if (force_retrain) {
      const user = req.user as IUser;
      if (!user || !user.isAdmin) {
        return next(new AppError('Admin access required for forced retraining', 403));
      }
    }
    
    // Validate training data
    if (!training_data || !Array.isArray(training_data) || training_data.length === 0) {
      return next(new AppError('Valid training data is required', 400));
    }
    
    // Call AI service for model training
    const trainingResult = await trainModel(training_data, force_retrain || false);
    
    return res.status(200).json({
      status: 'success',
      data: {
        success: true,
        model_info: trainingResult,
        records_processed: training_data.length
      }
    });
  } catch (error) {
    logger.error('Error in trainAIModelHandler:', error);
    return next(new AppError('Failed to train AI model', 500));
  }
};

/**
 * Gets personalized ingredient substitutions
 * @route POST /api/ai/substitutions
 */
export const getIngredientSubstitutionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ingredients, restrictions } = req.body;
    
    // Validate input
    if (!validateInputArray(ingredients)) {
      return next(new AppError('Valid ingredients array is required', 400));
    }
    
    // Get substitutions from AI service via ingredient analysis
    const analysisResult = await analyzeIngredients({
      ingredients,
      dietaryRestrictions: restrictions || [],
      generateSubstitutions: true
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        substitutions: analysisResult.suggestedAdditions || [],
        analysis: analysisResult.analysis || {}
      }
    });
  } catch (error) {
    logger.error('Error in getIngredientSubstitutionsHandler:', error);
    return next(error);
  }
};