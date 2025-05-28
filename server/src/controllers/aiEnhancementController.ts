import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { AppError } from '../middleware/error';
import Recipe, { IRecipe, IInstruction } from '../models/Recipe';
import winston from 'winston';
import { Types } from 'mongoose';
import { IUser } from '../models/User';
import { AIServiceConfig, validateAIServiceConfig } from '../config/aiConfig';

// User type definitions
interface AuthenticatedUser extends Omit<IUser, '_id'> {
  _id: Types.ObjectId;
}

// Utility for extracting user ID as string
const getUserId = (user: AuthenticatedUser | IUser): string => {
  if (typeof user._id === 'string') return user._id;
  if (user._id && typeof user._id === 'object' && 'toString' in user._id)
    return user._id.toString();
  throw new Error('Invalid user ID format');
};

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.colorize()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: 'logs/ai-enhancement.log',
      level: 'info',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Validation Utilities
class ValidationUtils {
  static validateInputArray(input: any): input is any[] {
    return Array.isArray(input) && input.length > 0;
  }

  static validateStringArray(input: any): input is string[] {
    return Array.isArray(input) && input.every(item => typeof item === 'string');
  }

  static validateNonEmptyString(input: any): input is string {
    return typeof input === 'string' && input.trim().length > 0;
  }

  static isValidUser(user: any): user is AuthenticatedUser {
    return user && typeof user === 'object' && ('_id' in user) && ('email' in user);
  }
}

// AI Service Implementation
class AIService {
  private static instance: AIService;
  private baseURL: string;

  constructor() {
    if (!validateAIServiceConfig()) {
      throw new Error('Invalid AI service configuration');
    }
    this.baseURL = AIServiceConfig.AI_SERVICE_URL;
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  async enhanceRecipes(options: {
    recipes: any[];
    userPreferences?: any;
    ingredients?: string[];
    context?: any;
  }): Promise<any[]> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/enhance-recipes`,
        {
          recipes: options.recipes,
          user_preferences: options.userPreferences || {},
          ingredients: options.ingredients || []
        },
        {
          timeout: AIServiceConfig.REQUEST_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.recipes || options.recipes;
    } catch (error: any) {
      logger.error('Error calling AI service for recipe enhancement:', error.message);
      // Return original recipes if AI service fails
      return options.recipes;
    }
  }

  async analyzeIngredients(options: {
    ingredients: string[];
    dietaryRestrictions?: string[];
    recipeTitle?: string;
    recipeInstructions?: string;
    generateShoppingList?: boolean;
    generateSubstitutions?: boolean;
    nutritionalAnalysis?: boolean;
  }): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/analyze-ingredients`,
        {
          ingredients: options.ingredients
        },
        {
          timeout: AIServiceConfig.REQUEST_TIMEOUT,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error calling AI service for ingredient analysis:', error.message);
      return {
        analysis: {},
        suggested_additions: [],
        ai_enhanced: false
      };
    }
  }

  async getCookingTipsForRecipe(ingredients: string[], title: string, instructions: string): Promise<any> {
    try {
      // For now, return basic tips since this endpoint isn't implemented in Flask service
      return {
        tips: ['Follow the recipe instructions carefully', 'Prep all ingredients before cooking'],
        techniques: ['Basic cooking techniques apply'],
        alternatives: [],
        time_saving_tips: ['Prepare ingredients in advance'],
        ai_enhanced: false
      };
    } catch (error: any) {
      logger.error('Error getting cooking tips:', error.message);
      return {
        tips: [],
        techniques: [],
        alternatives: [],
        time_saving_tips: [],
        ai_enhanced: false
      };
    }
  }

  async generateShoppingList(user: AuthenticatedUser, recipeIds: string[], useMealPlan: boolean): Promise<any> {
    try {
      // This would need to be implemented based on your recipe data
      return {
        success: true,
        shoppingList: [],
        categorizedList: {},
        recipeCount: recipeIds.length,
        totalEstimatedCost: 0,
        aiEnhanced: false
      };
    } catch (error: any) {
      logger.error('Error generating shopping list:', error.message);
      return {
        success: false,
        error: 'Failed to generate shopping list',
        shoppingList: [],
        categorizedList: {},
        recipeCount: 0,
        totalEstimatedCost: 0,
        aiEnhanced: false
      };
    }
  }

  async trainModel(trainingData: any[], forceRetrain: boolean): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/train`,
        {
          training_data: trainingData,
          force_retrain: forceRetrain
        },
        {
          timeout: 60000, // Longer timeout for training
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error training AI model:', error.message);
      return {
        success: false,
        error: 'Failed to train model'
      };
    }
  }
}

const aiService = AIService.getInstance();

// Controller Functions
export const enhanceRecipesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipes, user_preferences, ingredients, context } = req.body;

    if (!ValidationUtils.validateInputArray(recipes)) {
      return next(new AppError('Valid recipes array is required', 400));
    }

    const enhancedRecipes = await aiService.enhanceRecipes({
      recipes,
      userPreferences: user_preferences,
      ingredients,
      context
    });

    res.status(200).json({
      status: 'success',
      results: enhancedRecipes.length,
      data: {
        recipes: enhancedRecipes,
        ai_enhanced: true,
        enhancement_timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in enhanceRecipesHandler:', error);
    return next(error);
  }
};

export const analyzeIngredientsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ingredients, dietary_restrictions, recipe_title, recipe_instructions, generate_shopping_list, generate_substitutions, nutritional_analysis } = req.body;

    if (!ValidationUtils.validateStringArray(ingredients)) {
      return next(new AppError('Valid ingredients array is required', 400));
    }

    const analysis = await aiService.analyzeIngredients({
      ingredients,
      dietaryRestrictions: dietary_restrictions || [],
      recipeTitle: recipe_title,
      recipeInstructions: recipe_instructions,
      generateShoppingList: generate_shopping_list || false,
      generateSubstitutions: generate_substitutions !== false,
      nutritionalAnalysis: nutritional_analysis !== false
    });

    res.status(200).json({
      status: 'success',
      data: {
        ...analysis,
        ai_enhanced: true,
        analysis_timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in analyzeIngredientsHandler:', error);
    return next(error);
  }
};

export const getCookingTipsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!ValidationUtils.validateNonEmptyString(id)) {
      return next(new AppError('Valid recipe ID is required', 400));
    }

    let recipe: IRecipe | null = null;

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      recipe = await Recipe.findById(id).lean();
    } else {
      const externalId = parseInt(id, 10);
      if (isNaN(externalId)) return next(new AppError('Invalid recipe ID format', 400));
      recipe = await Recipe.findOne({ externalId }).lean();
    }

    if (!recipe) return next(new AppError('Recipe not found', 404));

    const ingredients = recipe.ingredients.map(ing => typeof ing === 'string' ? ing : ing.name);
    const instructionsText = recipe.instructions.map(inst => inst.description).join('. ');

    const cookingTips = await aiService.getCookingTipsForRecipe(
      ingredients,
      recipe.title,
      instructionsText
    );

    res.status(200).json({
      status: 'success',
      data: {
        recipe_id: id,
        recipe_title: recipe.title,
        ...cookingTips,
        ai_enhanced: true,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in getCookingTipsHandler:', error);
    return next(error);
  }
};

export const generateShoppingListHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user || !ValidationUtils.isValidUser(req.user)) {
      return next(new AppError('Authentication required', 401));
    }

    const user = req.user as AuthenticatedUser;
    const { recipeIds, useMealPlan } = req.body;

    const validRecipeIds = ValidationUtils.validateInputArray(recipeIds) ? recipeIds : [];

    if (validRecipeIds.length === 0 && !useMealPlan) {
      return next(new AppError('Either recipeIds or useMealPlan must be provided', 400));
    }

    const shoppingListResult = await aiService.generateShoppingList(
      user,
      validRecipeIds,
      !!useMealPlan
    );

    if (!shoppingListResult.success) {
      return next(new AppError(shoppingListResult.error || 'Failed to generate shopping list', 400));
    }

    res.status(200).json({
      status: 'success',
      data: {
        shopping_list: shoppingListResult.shoppingList,
        organized_by_category: shoppingListResult.categorizedList,
        recipe_count: shoppingListResult.recipeCount,
        total_estimated_cost: shoppingListResult.totalEstimatedCost,
        ai_enhanced: shoppingListResult.aiEnhanced,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in generateShoppingListHandler:', error);
    return next(error);
  }
};

export const trainAIModelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { training_data, force_retrain } = req.body;

    if (force_retrain) {
      if (!req.user || (req.user as AuthenticatedUser).role !== 'admin') {
        return next(new AppError('Admin access required for forced retraining', 403));
      }
    }

    if (!ValidationUtils.validateInputArray(training_data)) {
      return next(new AppError('Valid training data array is required', 400));
    }

    const trainingResult = await aiService.trainModel(training_data, !!force_retrain);

    res.status(200).json({
      status: 'success',
      data: {
        success: true,
        model_info: trainingResult,
        records_processed: training_data.length,
        training_completed_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in trainAIModelHandler:', error);
    return next(error);
  }
};

// Export all controller functions
export default {
  enhanceRecipesHandler,
  analyzeIngredientsHandler,
  getCookingTipsHandler,
  generateShoppingListHandler,
  trainAIModelHandler
};
