import { Types } from 'mongoose';
import Recipe from '../models/Recipe';
import User from '../models/User';
import { Logger } from '../utils/logger';
import { AppError } from '../middleware/error';
import { IMealPlanPreferences, IMealDay, IMealType, IMealPlanItem } from '../dto/mealPlanDto';
import { IUser } from '../models/User';
import { aiEnhancementService } from './aiEnhancementService';
import { userRepository } from '../repositories/userRepository';
import { recipeRepository } from '../repositories/recipeRepository';

/**
 * Meal Plan Service - Responsible for all meal planning operations
 * Implements domain logic for meal plan generation and management
 */
class MealPlanService {
  private readonly logger = new Logger('MealPlanService');
  private readonly days: IMealDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  private readonly mealTypes: IMealType[] = ['breakfast', 'lunch', 'dinner'];

  /**
   * Generate a weekly meal plan for a user based on their preferences
   * @param userId User ID to generate meal plan for
   * @param preferences Optional preferences to customize meal plan
   * @returns Meal plan with populated recipe data
   */
  public async generateWeeklyMealPlan(userId: string, preferences?: IMealPlanPreferences) {
    this.logger.debug(`Generating weekly meal plan for user ${userId}`);
    
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    try {
      // First try to generate AI-enhanced meal plan
      const aiMealPlan = await this.generateAIEnhancedMealPlan(user, preferences);
      if (aiMealPlan) {
        return {
          mealPlan: aiMealPlan,
          ai_generated: true
        };
      }
    } catch (error) {
      this.logger.warn(`AI meal plan generation failed: ${error.message}. Falling back to basic plan.`);
      // Fallback to basic generation if AI fails
    }

    // If AI-enhanced meal plan failed or returned no results, use basic generation
    const basicMealPlan = await this.generateBasicMealPlan(user, preferences);
    return {
      mealPlan: basicMealPlan,
      ai_generated: false
    };
  }

  /**
   * Generate a meal plan using AI enhancement
   * @param user User to generate plan for
   * @param preferences Optional meal plan preferences
   * @returns AI-enhanced meal plan or null if not possible
   */
  private async generateAIEnhancedMealPlan(user: IUser, preferences?: IMealPlanPreferences) {
    // Extract user dietary preferences
    const dietPreference = preferences?.diet || user.preferences?.dietaryRestrictions?.[0];
    const cuisinePreference = preferences?.cuisine || user.preferences?.favoriteCuisines?.[0];
    
    // Find candidate recipes matching preferences
    const candidateRecipes = await recipeRepository.findByPreferences({
      diet: dietPreference,
      cuisine: cuisinePreference,
      limit: 50 // Get more than needed for diversity
    });

    // If we don't have enough recipes, we can't generate a good meal plan
    if (candidateRecipes.length < 7) {
      this.logger.warn('Not enough candidate recipes found for AI-enhanced meal plan');
      return null;
    }

    // Extract context from user's recent viewed recipes
    const recentIngredients = await this.extractRecentIngredients(user);
    
    // Format user preferences for AI enhancement
    const userPreferences = {
      favorites: user.favorites?.map(id => id.toString()) || [],
      dietary_restrictions: preferences?.diet ? [preferences.diet] : user.preferences?.dietaryRestrictions || [],
      cuisine_preferences: preferences?.cuisine ? [preferences.cuisine] : user.preferences?.favoriteCuisines || [],
      past_interactions: user.recipeHistory?.map(history => ({
        recipe_id: history.recipeId.toString(),
        rating: history.rating || 0
      })) || []
    };

    // Get AI-enhanced recipe rankings
    const enhancedRecipes = await aiEnhancementService.enhanceRecipes(
      candidateRecipes,
      userPreferences,
      recentIngredients
    );

    if (!enhancedRecipes || enhancedRecipes.length === 0) {
      return null;
    }

    // Create meal plan using AI-ranked recipes
    return this.createMealPlanFromRecipes(user._id, enhancedRecipes);
  }

  /**
   * Generate a basic meal plan without AI enhancement
   * @param user User to generate plan for
   * @param preferences Optional meal plan preferences
   * @returns Basic meal plan
   */
  private async generateBasicMealPlan(user: IUser, preferences?: IMealPlanPreferences) {
    // Extract user dietary preferences
    const dietPreference = preferences?.diet || user.preferences?.dietaryRestrictions?.[0];
    const cuisinePreference = preferences?.cuisine || user.preferences?.favoriteCuisines?.[0];
    
    // Find recipes matching preferences - exact number needed for the plan
    const matchingRecipes = await recipeRepository.findByPreferences({
      diet: dietPreference,
      cuisine: cuisinePreference,
      limit: 21 // 3 meals x 7 days
    });

    if (matchingRecipes.length < 7) {
      throw new AppError('Not enough recipes found to create a meal plan', 400);
    }

    // Create and save the meal plan
    const mealPlan = this.createBasicMealPlan(user._id, matchingRecipes);
    await userRepository.saveMealPlan(user._id, mealPlan);

    // Return populated meal plan
    return await userRepository.getMealPlanWithRecipes(user._id);
  }

  /**
   * Create a meal plan structure from AI-enhanced recipes
   * @param userId User ID to create plan for
   * @param recipes Enhanced recipes to use in the plan
   * @returns Meal plan structure
   */
  private async createMealPlanFromRecipes(userId: Types.ObjectId, recipes: any[]) {
    // Track used recipe IDs to avoid duplicates
    const usedRecipeIds = new Set<string>();
    const mealPlan: IMealPlanItem[] = [];
    let recipeIndex = 0;

    // For each day and meal type, find a suitable recipe
    for (const day of this.days) {
      for (const mealType of this.mealTypes) {
        const { recipe, index } = this.findSuitableRecipe(recipes, mealType, usedRecipeIds, recipeIndex);
        usedRecipeIds.add(recipe._id.toString());
        
        mealPlan.push({
          recipeId: recipe._id,
          day,
          mealType
        });
        
        recipeIndex = index + 1;
      }
    }

    // Save the meal plan to the user
    await userRepository.saveMealPlan(userId, mealPlan);

    // Return populated meal plan
    return await userRepository.getMealPlanWithRecipes(userId);
  }

  /**
   * Find a suitable recipe for a specific meal type
   * @param recipes Available recipes
   * @param mealType Type of meal (breakfast, lunch, dinner)
   * @param usedIds Set of already used recipe IDs
   * @param startIndex Index to start searching from
   * @returns Suitable recipe and its index
   */
  private findSuitableRecipe(recipes: any[], mealType: string, usedIds: Set<string>, startIndex: number) {
    // First try to find a recipe that matches the meal type
    for (let i = startIndex; i < recipes.length; i++) {
      const recipe = recipes[i];
      if (!usedIds.has(recipe._id.toString())) {
        // Check if recipe is suitable for the meal type
        if (mealType === 'breakfast' && recipe.dishTypes?.some(type => 
          /breakfast|morning|brunch/.test(type.toLowerCase()))) {
          return { recipe, index: i };
        } else if (mealType === 'lunch' && recipe.dishTypes?.some(type => 
          /lunch|salad|sandwich|soup/.test(type.toLowerCase()))) {
          return { recipe, index: i };
        } else if (mealType === 'dinner' && recipe.dishTypes?.some(type => 
          /dinner|main course|entree|supper/.test(type.toLowerCase()))) {
          return { recipe, index: i };
        }
      }
    }
    
    // If no specific match found, use next available recipe
    for (let i = startIndex; i < recipes.length; i++) {
      if (!usedIds.has(recipes[i]._id.toString())) {
        return { recipe: recipes[i], index: i };
      }
    }
    
    // If all recipes have been used, cycle back to beginning
    return { recipe: recipes[startIndex % recipes.length], index: startIndex };
  }

  /**
   * Create a basic meal plan without specific meal type matching
   * @param userId User ID to create plan for
   * @param recipes Available recipes
   * @returns Basic meal plan structure
   */
  private createBasicMealPlan(userId: Types.ObjectId, recipes: any[]): IMealPlanItem[] {
    const mealPlan: IMealPlanItem[] = [];
    let recipeIndex = 0;
    
    for (const day of this.days) {
      for (const mealType of this.mealTypes) {
        if (recipeIndex < recipes.length) {
          mealPlan.push({
            recipeId: recipes[recipeIndex]._id,
            day,
            mealType
          });
          recipeIndex++;
        }
      }
    }
    
    return mealPlan;
  }

  /**
   * Extract ingredients from user's recently viewed recipes for context
   * @param user User to extract recent ingredients for
   * @returns List of ingredient names
   */
  private async extractRecentIngredients(user: IUser): Promise<string[]> {
    try {
      // Get user's recently viewed recipes
      const recentHistory = (user.recipeHistory || [])
        .sort((a, b) => (b.lastViewed?.getTime() || 0) - (a.lastViewed?.getTime() || 0))
        .slice(0, 5); // Get 5 most recent
      
      const recipeIds = recentHistory.map(h => h.recipeId);
      
      // Find recipes with these IDs
      const recipes = await Recipe.find({
        _id: { $in: recipeIds }
      });
      
      // Extract and flatten ingredients
      const allIngredients = recipes.flatMap(recipe => 
        recipe.ingredients?.map(ing => typeof ing === 'string' ? ing : ing.name) || []
      );
      
      // Remove duplicates
      return [...new Set(allIngredients)];
    } catch (error) {
      this.logger.error('Error extracting recent ingredients:', error);
      return [];
    }
  }

  /**
   * Generate a shopping list for a meal plan
   * @param userId User ID to generate shopping list for
   * @param options Options for shopping list generation
   * @returns Shopping list organized by category
   */
  public async generateShoppingList(userId: string, options: { recipeIds?: string[], useMealPlan?: boolean }) {
    const { recipeIds, useMealPlan } = options;
    let recipes = [];
    
    // Get recipes either from meal plan or provided IDs
    if (useMealPlan) {
      const userWithMealPlan = await userRepository.findByIdWithMealPlan(userId);
      if (userWithMealPlan?.mealPlan) {
        recipes = userWithMealPlan.mealPlan.map(meal => meal.recipeId);
      }
    } else if (recipeIds?.length > 0) {
      recipes = await Recipe.find({ _id: { $in: recipeIds } });
    } else {
      throw new AppError('Either recipeIds or useMealPlan must be provided', 400);
    }
    
    if (recipes.length === 0) {
      throw new AppError('No recipes found for shopping list', 404);
    }
    
    // Extract all ingredients
    const allIngredients = recipes.flatMap(recipe => 
      recipe.ingredients ? recipe.ingredients.map(ing => 
        typeof ing === 'string' ? ing : ing.name
      ) : []
    );
    
    // Try to get AI-enhanced shopping list
    try {
      const aiShoppingList = await aiEnhancementService.generateShoppingList(allIngredients);
      if (aiShoppingList) {
        return {
          shopping_list: aiShoppingList.shopping_list,
          organized_by_category: aiShoppingList.categorized_list || [],
          recipe_count: recipes.length,
          ai_enhanced: true
        };
      }
    } catch (error) {
      this.logger.warn(`AI shopping list generation failed: ${error.message}`);
    }
    
    // Fallback to basic shopping list
    const uniqueIngredients = [...new Set(allIngredients)].sort();
    
    return {
      shopping_list: uniqueIngredients,
      recipe_count: recipes.length,
      ai_enhanced: false
    };
  }
}

// Export as singleton instance
export const mealPlanService = new MealPlanService();