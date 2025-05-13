import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { logger } from '../utils/logger';
import { IUser } from '../models/User';
import { MealPlanService } from '../services/mealPlanService';
import { AIService } from '../services/aiService';

export class MealPlanController {
  private mealPlanService: MealPlanService;
  private aiService: AIService;
  
  constructor() {
    this.mealPlanService = new MealPlanService();
    this.aiService = new AIService();
  }

  /**
   * Generate AI-powered weekly meal plan
   * @route POST /api/recipes/user/mealplan/generate
   */
  public generateWeeklyMealPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user = req.user as IUser;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      const { preferences } = req.body;
      
      // Generate meal plan with AI assistance
      const result = await this.mealPlanService.generateWeeklyMealPlan(user, preferences, this.aiService);
      
      if (!result.success) {
        return next(new AppError(result.error || 'Failed to create meal plan', 400));
      }
      
      return res.status(200).json({
        status: 'success',
        data: {
          mealPlan: result.mealPlan,
          ai_generated: result.ai_generated
        }
      });
    } catch (error) {
      logger.error('Error in generateWeeklyMealPlan:', error);
      return next(error);
    }
  };

  /**
   * Get AI-powered shopping list for recipe or meal plan
   * @route POST /api/recipes/shopping-list
   */
  public generateShoppingList = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { recipeIds, useMealPlan } = req.body;
      const user = req.user as IUser;
      
      if (!user) {
        return next(new AppError('Authentication required', 401));
      }
      
      // Validate either recipeIds or useMealPlan
      if (!recipeIds?.length && !useMealPlan) {
        return next(new AppError('Either recipeIds or useMealPlan must be provided', 400));
      }
      
      // Generate shopping list
      const shoppingList = await this.mealPlanService.generateShoppingList(
        user, 
        recipeIds, 
        useMealPlan,
        this.aiService
      );
      
      if (!shoppingList.success) {
        return next(new AppError(shoppingList.error || 'Failed to generate shopping list', 400));
      }
      
      return res.status(200).json({
        status: 'success',
        data: {
          shopping_list: shoppingList.items,
          organized_by_category: shoppingList.categorized || [],
          recipe_count: shoppingList.recipeCount,
          ai_enhanced: shoppingList.ai_enhanced
        }
      });
    } catch (error) {
      logger.error('Error in generateShoppingList:', error);
      return next(error);
    }
  };
}

// Export singleton instance
export const mealPlanController = new MealPlanController();