import { Types } from 'mongoose';
import Recipe from '../models/Recipe';
import User from '../models/User';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error';
import { IUser } from '../models/User';

/**
 * AI Enhancement Service Interface (Mock implementation for missing module)
 */
interface IAIEnhancementService {
  enhanceRecipes(recipes: any[], userPreferences: IUserPreferencesForAI, recentIngredients: string[]): Promise<any[]>;
  generateShoppingList(ingredients: string[]): Promise<{ shopping_list: string[]; categorized_list?: Array<{ category: string; items: string[]; }>; }>;
}

/**
 * Mock AI Enhancement Service
 */
class AIEnhancementService implements IAIEnhancementService {
  async enhanceRecipes(recipes: any[], userPreferences: IUserPreferencesForAI, recentIngredients: string[]): Promise<any[]> {
    // Mock implementation - returns recipes sorted by user preferences
    return recipes.sort((a, b) => {
      const aScore = this.calculateRecipeScore(a, userPreferences);
      const bScore = this.calculateRecipeScore(b, userPreferences);
      return bScore - aScore;
    });
  }

  async generateShoppingList(ingredients: string[]): Promise<{ shopping_list: string[]; categorized_list?: Array<{ category: string; items: string[]; }>; }> {
    // Mock implementation - returns organized shopping list
    const uniqueIngredients = [...new Set(ingredients)].sort();
    return {
      shopping_list: uniqueIngredients,
      categorized_list: [
        { category: 'Produce', items: uniqueIngredients.filter(item => /vegetable|fruit|herb/i.test(item)) },
        { category: 'Pantry', items: uniqueIngredients.filter(item => /spice|oil|vinegar|flour/i.test(item)) },
        { category: 'Protein', items: uniqueIngredients.filter(item => /meat|fish|chicken|beef/i.test(item)) },
        { category: 'Other', items: uniqueIngredients.filter(item => !/vegetable|fruit|herb|spice|oil|vinegar|flour|meat|fish|chicken|beef/i.test(item)) }
      ]
    };
  }

  private calculateRecipeScore(recipe: any, userPreferences: IUserPreferencesForAI): number {
    let score = 0;
    
    // Boost score for favorite recipes
    if (userPreferences.favorites.includes(recipe._id.toString())) {
      score += 10;
    }
    
    // Boost score for preferred cuisines
    if (recipe.cuisine && userPreferences.cuisine_preferences.includes(recipe.cuisine)) {
      score += 5;
    }
    
    // Boost score based on past ratings
    const pastInteraction = userPreferences.past_interactions.find(
      interaction => interaction.recipe_id === recipe._id.toString()
    );
    if (pastInteraction) {
      score += pastInteraction.rating;
    }
    
    return score;
  }
}

/**
 * User Repository Interface - Updated to accept string IDs and handle conversion internally
 */
interface IUserRepository {
  findById(userId: string): Promise<IEnhancedUser | null>;
  findByIdWithMealPlan(userId: string): Promise<IEnhancedUser | null>;
  saveMealPlan(userId: string, mealPlan: IMealPlanItem[]): Promise<void>;
  getMealPlanWithRecipes(userId: string): Promise<any>;
  clearMealPlan(userId: string): Promise<void>;
}

/**
 * Mock User Repository - Updated to handle string to ObjectId conversion internally
 */
class UserRepository implements IUserRepository {
  /**
   * Convert string ID to ObjectId safely
   */
  private convertToObjectId(userId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID format', 400);
    }
    return new Types.ObjectId(userId);
  }

  async findById(userId: string): Promise<IEnhancedUser | null> {
    try {
      const objectId = this.convertToObjectId(userId);
      const user = await User.findById(objectId).lean() as IEnhancedUser;
      return user;
    } catch (error) {
      logger.error(`Error finding user by ID: ${error}`);
      return null;
    }
  }

  async findByIdWithMealPlan(userId: string): Promise<IEnhancedUser | null> {
    try {
      const objectId = this.convertToObjectId(userId);
      const user = await User.findById(objectId).populate('mealPlan.recipeId').lean() as IEnhancedUser;
      return user;
    } catch (error) {
      logger.error(`Error finding user with meal plan: ${error}`);
      return null;
    }
  }

  async saveMealPlan(userId: string, mealPlan: IMealPlanItem[]): Promise<void> {
    try {
      const objectId = this.convertToObjectId(userId);
      await User.findByIdAndUpdate(objectId, { mealPlan });
    } catch (error) {
      logger.error(`Error saving meal plan: ${error}`);
      throw error;
    }
  }

  async getMealPlanWithRecipes(userId: string): Promise<any> {
    try {
      const objectId = this.convertToObjectId(userId);
      const user = await User.findById(objectId).populate('mealPlan.recipeId').lean();
      return user;
    } catch (error) {
      logger.error(`Error getting meal plan with recipes: ${error}`);
      throw error;
    }
  }

  async clearMealPlan(userId: string): Promise<void> {
    try {
      const objectId = this.convertToObjectId(userId);
      await User.findByIdAndUpdate(objectId, { $unset: { mealPlan: 1 } });
    } catch (error) {
      logger.error(`Error clearing meal plan: ${error}`);
      throw error;
    }
  }
}

/**
 * Meal plan DTOs and interfaces
 */
export interface IMealPlanPreferences {
  diet?: string;
  cuisine?: string;
  maxPrepTime?: number;
  excludeIngredients?: string[];
  caloriesPerDay?: number;
}

export type IMealDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type IMealType = 'breakfast' | 'lunch' | 'dinner';

export interface IMealPlanItem {
  recipeId: Types.ObjectId;
  day: IMealDay;
  mealType: IMealType;
  date?: Date;
  servings?: number;
}

export interface IRecipeHistory {
  recipeId: Types.ObjectId;
  lastViewed?: Date;
  rating?: number;
}

export interface IUserPreferences {
  dietaryRestrictions?: string[];
  favoriteCuisines?: string[];
}

export interface IEnhancedUser extends Omit<IUser, 'mealPlan'> {
  favorites?: Types.ObjectId[];
  recipeHistory?: IRecipeHistory[];
  preferences?: IUserPreferences;
  mealPlan?: IMealPlanItem[];
}

export interface IRecipePreferences {
  diet?: string;
  cuisine?: string;
  limit?: number;
}

export interface IUserPreferencesForAI {
  favorites: string[];
  dietary_restrictions: string[];
  cuisine_preferences: string[];
  past_interactions: Array<{
    recipe_id: string;
    rating: number;
  }>;
}

export interface IShoppingListOptions {
  recipeIds?: string[];
  useMealPlan?: boolean;
}

export interface IShoppingListResponse {
  shopping_list: string[];
  organized_by_category?: Array<{
    category: string;
    items: string[];
  }>;
  recipe_count: number;
  ai_enhanced: boolean;
}

export interface IMealPlanResponse {
  mealPlan: any;
  ai_generated: boolean;
}

export interface IRecipeSearchParams {
  dietaryRestrictionIds?: string[];
  cuisineIds?: string[];
  limit?: number;
}

/**
 * Recipe Repository Interface
 */
interface IRecipeRepository {
  searchRecipes(params: IRecipeSearchParams): Promise<any[]>;
}

/**
 * Recipe Repository Implementation
 */
class RecipeRepository implements IRecipeRepository {
  async searchRecipes(params: IRecipeSearchParams): Promise<any[]> {
    try {
      const query: any = {};
      
      if (params.dietaryRestrictionIds && params.dietaryRestrictionIds.length > 0) {
        query.dietaryRestrictions = { $in: params.dietaryRestrictionIds };
      }
      
      if (params.cuisineIds && params.cuisineIds.length > 0) {
        query.cuisine = { $in: params.cuisineIds };
      }
      
      const recipes = await Recipe.find(query)
        .limit(params.limit || 50)
        .lean();
      
      return recipes;
    } catch (error) {
      logger.error(`Error searching recipes: ${error}`);
      throw error;
    }
  }
}

/**
 * Meal Plan Service - Responsible for all meal planning operations
 * Implements domain logic for meal plan generation and management
 */
class MealPlanService {
  private readonly serviceLogger = logger;
  private readonly recipeRepository: IRecipeRepository;
  private readonly userRepository: IUserRepository;
  private readonly aiEnhancementService: IAIEnhancementService;
  private readonly days: IMealDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  private readonly mealTypes: IMealType[] = ['breakfast', 'lunch', 'dinner'];

  constructor() {
    this.recipeRepository = new RecipeRepository();
    this.userRepository = new UserRepository();
    this.aiEnhancementService = new AIEnhancementService();
  }

  /**
   * Convert string ID to ObjectId safely
   */
  private convertToObjectId(userId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError('Invalid user ID format', 400);
    }
    return new Types.ObjectId(userId);
  }

  /**
   * Generate a weekly meal plan for a user based on their preferences
   * @param userId User ID to generate meal plan for
   * @param preferences Optional preferences to customize meal plan
   * @returns Meal plan with populated recipe data
   */
  public async generateWeeklyMealPlan(
    userId: string, 
    preferences?: IMealPlanPreferences
  ): Promise<IMealPlanResponse> {
    this.serviceLogger.debug(`Generating weekly meal plan for user ${userId}`);
    
    const user = await this.userRepository.findById(userId);

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.serviceLogger.warn(`AI meal plan generation failed: ${errorMessage}. Falling back to basic plan.`);
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
  private async generateAIEnhancedMealPlan(
    user: IEnhancedUser, 
    preferences?: IMealPlanPreferences
  ): Promise<any | null> {
    // Extract user dietary preferences
    const dietPreference = preferences?.diet || user.preferences?.dietaryRestrictions?.[0];
    const cuisinePreference = preferences?.cuisine || user.preferences?.favoriteCuisines?.[0];
    
    // Find candidate recipes matching preferences
    const candidateRecipes = await this.recipeRepository.searchRecipes({
      dietaryRestrictionIds: dietPreference ? [dietPreference] : undefined,
      cuisineIds: cuisinePreference ? [cuisinePreference] : undefined,
      limit: 50
    });

    // If we don't have enough recipes, we can't generate a good meal plan
    if (candidateRecipes.length < 7) {
      this.serviceLogger.warn('Not enough candidate recipes found for AI-enhanced meal plan');
      return null;
    }

    // Extract context from user's recent viewed recipes
    const recentIngredients = await this.extractRecentIngredients(user);
    
    // Format user preferences for AI enhancement
    const userPreferences: IUserPreferencesForAI = {
      favorites: user.favorites?.map((id: Types.ObjectId) => id.toString()) || [],
      dietary_restrictions: preferences?.diet ? [preferences.diet] : user.preferences?.dietaryRestrictions || [],
      cuisine_preferences: preferences?.cuisine ? [preferences.cuisine] : user.preferences?.favoriteCuisines || [],
      past_interactions: user.recipeHistory?.map((history: IRecipeHistory) => ({
        recipe_id: history.recipeId.toString(),
        rating: history.rating || 0
      })) || []
    };

    // Get AI-enhanced recipe rankings
    const enhancedRecipes = await this.aiEnhancementService.enhanceRecipes(
      candidateRecipes,
      userPreferences,
      recentIngredients
    );

    if (!enhancedRecipes || enhancedRecipes.length === 0) {
      return null;
    }

    // Create meal plan using AI-ranked recipes
    return this.createMealPlanFromRecipes(user._id.toString(), enhancedRecipes);
  }

  /**
   * Generate a basic meal plan without AI enhancement
   * @param user User to generate plan for
   * @param preferences Optional meal plan preferences
   * @returns Basic meal plan
   */
  private async generateBasicMealPlan(
    user: IEnhancedUser, 
    preferences?: IMealPlanPreferences
  ): Promise<any> {
    // Extract user dietary preferences
    const dietPreference = preferences?.diet || user.preferences?.dietaryRestrictions?.[0];
    const cuisinePreference = preferences?.cuisine || user.preferences?.favoriteCuisines?.[0];
    
    // Find recipes matching preferences
    const matchingRecipes = await this.recipeRepository.searchRecipes({
      dietaryRestrictionIds: dietPreference ? [dietPreference] : undefined,
      cuisineIds: cuisinePreference ? [cuisinePreference] : undefined,
      limit: 21
    });

    if (matchingRecipes.length < 7) {
      throw new AppError('Not enough recipes found to create a meal plan', 400);
    }

    // Create and save the meal plan
    const mealPlan = this.createBasicMealPlan(user._id.toString(), matchingRecipes);
    await this.userRepository.saveMealPlan(user._id.toString(), mealPlan);

    // Return populated meal plan
    return await this.userRepository.getMealPlanWithRecipes(user._id.toString());
  }

  /**
   * Create a meal plan structure from AI-enhanced recipes
   * @param userId User ID to create plan for (as string)
   * @param recipes Enhanced recipes to use in the plan
   * @returns Meal plan structure
   */
  private async createMealPlanFromRecipes(userId: string, recipes: any[]): Promise<any> {
    const usedRecipeIds = new Set<string>();
    const mealPlan: IMealPlanItem[] = [];
    let recipeIndex = 0;

    for (const day of this.days) {
      for (const mealType of this.mealTypes) {
        const { recipe, index } = this.findSuitableRecipe(recipes, mealType, usedRecipeIds, recipeIndex);
        usedRecipeIds.add(recipe._id.toString());
        
        mealPlan.push({
          recipeId: recipe._id,
          day,
          mealType,
          date: new Date(),
          servings: 1
        });
        
        recipeIndex = index + 1;
      }
    }

    // Save the meal plan to the user
    await this.userRepository.saveMealPlan(userId, mealPlan);

    // Return populated meal plan
    return await this.userRepository.getMealPlanWithRecipes(userId);
  }

  /**
   * Find a suitable recipe for a specific meal type
   * @param recipes Available recipes
   * @param mealType Type of meal (breakfast, lunch, dinner)
   * @param usedIds Set of already used recipe IDs
   * @param startIndex Index to start searching from
   * @returns Suitable recipe and its index
   */
  private findSuitableRecipe(
    recipes: any[], 
    mealType: string, 
    usedIds: Set<string>, 
    startIndex: number
  ): { recipe: any; index: number } {
    // First try to find a recipe that matches the meal type
    for (let i = startIndex; i < recipes.length; i++) {
      const recipe = recipes[i];
      if (!usedIds.has(recipe._id.toString())) {
        if (mealType === 'breakfast' && recipe.dishTypes?.some((type: string) => 
          /breakfast|morning|brunch/.test(type.toLowerCase()))) {
          return { recipe, index: i };
        } else if (mealType === 'lunch' && recipe.dishTypes?.some((type: string) => 
          /lunch|salad|sandwich|soup/.test(type.toLowerCase()))) {
          return { recipe, index: i };
        } else if (mealType === 'dinner' && recipe.dishTypes?.some((type: string) => 
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
   * @param userId User ID to create plan for (as string)
   * @param recipes Available recipes
   * @returns Basic meal plan structure
   */
  private createBasicMealPlan(userId: string, recipes: any[]): IMealPlanItem[] {
    const mealPlan: IMealPlanItem[] = [];
    let recipeIndex = 0;
    
    for (const day of this.days) {
      for (const mealType of this.mealTypes) {
        if (recipeIndex < recipes.length) {
          mealPlan.push({
            recipeId: recipes[recipeIndex]._id,
            day,
            mealType,
            date: new Date(),
            servings: 1
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
  private async extractRecentIngredients(user: IEnhancedUser): Promise<string[]> {
    try {
      const recentHistory = (user.recipeHistory || [])
        .sort((a: IRecipeHistory, b: IRecipeHistory) => 
          (b.lastViewed?.getTime() || 0) - (a.lastViewed?.getTime() || 0))
        .slice(0, 5);
      
      const recipeIds = recentHistory.map((h: IRecipeHistory) => h.recipeId);
      
      const recipes = await Recipe.find({
        _id: { $in: recipeIds }
      });
      
      const allIngredients = recipes.flatMap((recipe: any) => 
        recipe.ingredients?.map((ing: any) => typeof ing === 'string' ? ing : ing.name) || []
      );
      
      return [...new Set(allIngredients)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.serviceLogger.error(`Error extracting recent ingredients: ${errorMessage}`);
      return [];
    }
  }

  /**
   * Generate a shopping list for a meal plan
   * @param userId User ID to generate shopping list for
   * @param options Options for shopping list generation
   * @returns Shopping list organized by category
   */
  public async generateShoppingList(
    userId: string, 
    options: IShoppingListOptions
  ): Promise<IShoppingListResponse> {
    const { recipeIds, useMealPlan } = options;
    let recipes: any[] = [];
    
    if (useMealPlan) {
      const userWithMealPlan = await this.userRepository.findByIdWithMealPlan(userId);
      if (userWithMealPlan?.mealPlan) {
        recipes = userWithMealPlan.mealPlan.map((meal: any) => meal.recipeId);
      }
    } else if (recipeIds && recipeIds.length > 0) {
      recipes = await Recipe.find({ _id: { $in: recipeIds } });
    } else {
      throw new AppError('Either recipeIds or useMealPlan must be provided', 400);
    }
    
    if (recipes.length === 0) {
      throw new AppError('No recipes found for shopping list', 404);
    }
    
    const allIngredients = recipes.flatMap((recipe: any) => 
      recipe.ingredients ? recipe.ingredients.map((ing: any) => 
        typeof ing === 'string' ? ing : ing.name
      ) : []
    );
    
    try {
      const aiShoppingList = await this.aiEnhancementService.generateShoppingList(allIngredients);
      if (aiShoppingList) {
        return {
          shopping_list: aiShoppingList.shopping_list,
          organized_by_category: aiShoppingList.categorized_list || [],
          recipe_count: recipes.length,
          ai_enhanced: true
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.serviceLogger.warn(`AI shopping list generation failed: ${errorMessage}`);
    }
    
    const uniqueIngredients = [...new Set(allIngredients)].sort();
    
    return {
      shopping_list: uniqueIngredients,
      recipe_count: recipes.length,
      ai_enhanced: false
    };
  }

  /**
   * Get meal plan for a specific user
   * @param userId User ID to get meal plan for
   * @returns User's current meal plan
   */
  public async getMealPlan(userId: string): Promise<any> {
    try {
      const userWithMealPlan = await this.userRepository.getMealPlanWithRecipes(userId);
      if (!userWithMealPlan) {
        throw new AppError('User not found', 404);
      }
      return userWithMealPlan;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.serviceLogger.error(`Error fetching meal plan for user ${userId}: ${errorMessage}`);
      throw new AppError(`Failed to fetch meal plan: ${errorMessage}`, 500);
    }
  }

  /**
   * Update meal plan preferences for a user
   * @param userId User ID to update preferences for
   * @param preferences New preferences to apply
   * @returns Updated meal plan
   */
  public async updateMealPlanPreferences(
    userId: string, 
    preferences: IMealPlanPreferences
  ): Promise<IMealPlanResponse> {
    try {
      return await this.generateWeeklyMealPlan(userId, preferences);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.serviceLogger.error(`Error updating meal plan preferences for user ${userId}: ${errorMessage}`);
      throw new AppError(`Failed to update meal plan preferences: ${errorMessage}`, 500);
    }
  }

  /**
   * Clear meal plan for a user
   * @param userId User ID to clear meal plan for
   */
  public async clearMealPlan(userId: string): Promise<void> {
    try {
      await this.userRepository.clearMealPlan(userId);
      this.serviceLogger.info(`Cleared meal plan for user ${userId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.serviceLogger.error(`Error clearing meal plan for user ${userId}: ${errorMessage}`);
      throw new AppError(`Failed to clear meal plan: ${errorMessage}`, 500);
    }
  }
}


export const mealPlanService = new MealPlanService();
