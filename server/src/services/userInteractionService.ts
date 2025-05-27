import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { IUser } from '../models/User';
import Recipe from '../models/Recipe';
import User from '../models/User';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error';

/**
 * User Repository Interface - Mock implementation for missing module
 */
interface IUserRepository {
  updateRecipeHistory(userId: string, recipeId: string, historyData: IRecipeHistoryUpdate): Promise<void>;
  findById(userId: string): Promise<IEnhancedUser | null>;
  findByIdWithFavorites(userId: string): Promise<IEnhancedUser | null>;
  findByIdWithRecipeHistory(userId: string, limit?: number): Promise<IEnhancedUser | null>;
  addToFavorites(userId: string, recipeId: string): Promise<void>;
  removeFromFavorites(userId: string, recipeId: string): Promise<void>;
}

/**
 * AI Service Interface - Mock implementation for missing methods
 */
interface IAIService {
  sendTrainingData(trainingData: IAITrainingData): Promise<void>;
}

/**
 * Enhanced interfaces and types
 */
interface IRecipeHistoryUpdate {
  lastViewed?: Date;
  rating?: number;
  lastUpdated?: Date;
}

interface IRecipeHistory {
  recipeId: Types.ObjectId;
  lastViewed?: Date;
  rating?: number;
  lastUpdated?: Date;
}

interface IUserPreferences {
  dietaryRestrictions?: string[];
  favoriteCuisines?: string[];
}

interface IEnhancedUser extends IUser {
  favorites?: Types.ObjectId[];
  recipeHistory?: IRecipeHistory[];
  preferences?: IUserPreferences;
}

interface IAITrainingData {
  user_id: string;
  recipe_id: string;
  recipe_title: string;
  recipe_ingredients: string[];
  recipe_description: string;
  cuisine: string;
  user_rating: number;
  is_favorite: boolean;
  timestamp: string;
}

/**
 * Recipe interface that matches the actual Recipe model structure
 * Using proper Mongoose 7+ typing without FlattenMaps issues
 */
interface IRecipeBase {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  ingredients: Array<string | { name: string }>;
  cuisines?: string[];
  rating?: number;
  ratingCount?: number;
  totalRating?: number;
  favoriteCount?: number;
  instructions?: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  dishTypes?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Recipe interface that matches the actual Recipe model structure
 */
interface IRecipeDocument extends IRecipeBase {
  __v?: number;
}

/**
 * Enhanced recipe interface with required rating fields
 */
interface IRecipeWithRating extends IRecipeDocument {
  rating: number;
  ratingCount: number;
  totalRating: number;
}

/**
 * Type guard to check if a recipe has rating information
 */
function isRecipeWithRating(recipe: IRecipeDocument): recipe is IRecipeWithRating {
  return typeof recipe.rating === 'number' && 
         typeof recipe.ratingCount === 'number' && 
         typeof recipe.totalRating === 'number';
}

/**
 * Convert a recipe document to a recipe with rating
 */
function ensureRecipeWithRating(recipe: IRecipeDocument): IRecipeWithRating {
  return {
    ...recipe,
    rating: recipe.rating ?? 0,
    ratingCount: recipe.ratingCount ?? 0,
    totalRating: recipe.totalRating ?? 0,
    favoriteCount: recipe.favoriteCount ?? 0
  };
}

/**
 * Safely convert any lean document to our recipe interface
 * This handles the FlattenMaps issue by using proper type assertions
 */
function convertLeanToRecipeDocument(leanDoc: any): IRecipeDocument {
  // Ensure _id is properly converted to ObjectId if it's not already
  const _id = leanDoc._id instanceof Types.ObjectId 
    ? leanDoc._id 
    : new Types.ObjectId(leanDoc._id);

  return {
    _id,
    title: leanDoc.title || '',
    description: leanDoc.description,
    ingredients: leanDoc.ingredients || [],
    cuisines: leanDoc.cuisines,
    rating: leanDoc.rating,
    ratingCount: leanDoc.ratingCount,
    totalRating: leanDoc.totalRating,
    favoriteCount: leanDoc.favoriteCount,
    instructions: leanDoc.instructions,
    prepTime: leanDoc.prepTime,
    cookTime: leanDoc.cookTime,
    servings: leanDoc.servings,
    difficulty: leanDoc.difficulty,
    dishTypes: leanDoc.dishTypes,
    createdAt: leanDoc.createdAt,
    updatedAt: leanDoc.updatedAt,
    __v: leanDoc.__v
  };
}

/**
 * Mock User Repository Implementation
 */
class UserRepository implements IUserRepository {
  async updateRecipeHistory(
    userId: string, 
    recipeId: string, 
    historyData: IRecipeHistoryUpdate
  ): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const recipeObjectId = new Types.ObjectId(recipeId);

      // First try to update existing history entry
      const updateResult = await User.findOneAndUpdate(
        { 
          _id: userObjectId,
          'recipeHistory.recipeId': recipeObjectId 
        },
        {
          $set: {
            'recipeHistory.$.lastViewed': historyData.lastViewed,
            'recipeHistory.$.rating': historyData.rating,
            'recipeHistory.$.lastUpdated': historyData.lastUpdated || new Date()
          }
        },
        { new: true }
      );

      // If no existing history entry was updated, create new one
      if (!updateResult) {
        await User.findByIdAndUpdate(
          userObjectId,
          {
            $addToSet: {
              recipeHistory: {
                recipeId: recipeObjectId,
                lastViewed: historyData.lastViewed || new Date(),
                rating: historyData.rating,
                lastUpdated: historyData.lastUpdated || new Date()
              }
            }
          }
        );
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error updating recipe history: ${errorMessage}`);
      throw error;
    }
  }

  async findById(userId: string): Promise<IEnhancedUser | null> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const user = await User.findById(userObjectId).lean();
      return user as IEnhancedUser | null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error finding user: ${errorMessage}`);
      return null;
    }
  }

  async findByIdWithFavorites(userId: string): Promise<IEnhancedUser | null> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const user = await User.findById(userObjectId)
        .populate({
          path: 'favorites',
          model: 'Recipe'
        })
        .lean();
      return user as IEnhancedUser | null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error finding user with favorites: ${errorMessage}`);
      return null;
    }
  }

  async findByIdWithRecipeHistory(userId: string, limit: number = 10): Promise<IEnhancedUser | null> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const user = await User.findById(userObjectId)
        .populate({
          path: 'recipeHistory.recipeId',
          model: 'Recipe',
          options: { limit }
        })
        .lean();
      return user as IEnhancedUser | null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error finding user with recipe history: ${errorMessage}`);
      return null;
    }
  }

  async addToFavorites(userId: string, recipeId: string): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const recipeObjectId = new Types.ObjectId(recipeId);

      await User.findByIdAndUpdate(
        userObjectId,
        { $addToSet: { favorites: recipeObjectId } }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error adding to favorites: ${errorMessage}`);
      throw error;
    }
  }

  async removeFromFavorites(userId: string, recipeId: string): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      const recipeObjectId = new Types.ObjectId(recipeId);

      await User.findByIdAndUpdate(
        userObjectId,
        { $pull: { favorites: recipeObjectId } }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error removing from favorites: ${errorMessage}`);
      throw error;
    }
  }
}

/**
 * Enhanced Recipe Repository with proper type handling
 */
class EnhancedRecipeRepository {
  async findById(id: string): Promise<IRecipeWithRating | null> {
    try {
      if (!mongoose.isValidObjectId(id)) {
        return null;
      }

      // Use type assertion to handle FlattenMaps issue
      const recipe = await Recipe.findById(id).lean() as any;
      
      if (!recipe) {
        return null;
      }

      const recipeDoc = convertLeanToRecipeDocument(recipe);
      return ensureRecipeWithRating(recipeDoc);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error finding recipe: ${errorMessage}`);
      return null;
    }
  }

  async findByIds(ids: Types.ObjectId[]): Promise<IRecipeWithRating[]> {
    try {
      const validIds = ids.filter(id => mongoose.isValidObjectId(id));
      
      // Use type assertion to handle FlattenMaps issue
      const recipes = await Recipe.find({ _id: { $in: validIds } }).lean() as any[];
      
      // Convert lean documents to our interface properly
      const recipeDocuments = recipes.map(recipe => convertLeanToRecipeDocument(recipe));
      return recipeDocuments.map(recipe => ensureRecipeWithRating(recipe));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error finding recipes by IDs: ${errorMessage}`);
      return [];
    }
  }

  async updateRecipeRating(recipeId: string, rating: number): Promise<IRecipeWithRating | null> {
    try {
      if (!mongoose.isValidObjectId(recipeId)) {
        throw new AppError('Invalid recipe ID', 400);
      }

      const recipe = await Recipe.findById(recipeId) as IRecipeDocument | null;
      if (!recipe) {
        return null;
      }

      // Calculate new rating
      const currentTotal = recipe.totalRating || (recipe.rating ? recipe.rating * (recipe.ratingCount || 1) : 0);
      const currentCount = recipe.ratingCount || 0;
      const newCount = currentCount + 1;
      const newTotal = currentTotal + rating;
      const newRating = newTotal / newCount;

      // Use type assertion to handle FlattenMaps issue
      const updatedRecipe = await Recipe.findByIdAndUpdate(
        recipeId,
        {
          rating: newRating,
          ratingCount: newCount,
          totalRating: newTotal
        },
        { new: true }
      ).lean() as any;

      if (!updatedRecipe) {
        return null;
      }

      const recipeDoc = convertLeanToRecipeDocument(updatedRecipe);
      return ensureRecipeWithRating(recipeDoc);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error updating recipe rating: ${errorMessage}`);
      throw error;
    }
  }

  async incrementFavoriteCount(recipeId: string): Promise<void> {
    try {
      await Recipe.findByIdAndUpdate(
        recipeId,
        { $inc: { favoriteCount: 1 } }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error incrementing favorite count: ${errorMessage}`);
      throw error;
    }
  }

  async decrementFavoriteCount(recipeId: string): Promise<void> {
    try {
      await Recipe.findByIdAndUpdate(
        recipeId,
        { $inc: { favoriteCount: -1 } }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error decrementing favorite count: ${errorMessage}`);
      throw error;
    }
  }
}

/**
 * Enhanced AI Service with missing methods
 */
class EnhancedAIService implements IAIService {
  async sendTrainingData(trainingData: IAITrainingData): Promise<void> {
    try {
      // Mock implementation - in real scenario, this would send data to AI service
      logger.debug(`Sending training data for user ${trainingData.user_id} and recipe ${trainingData.recipe_id}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Training data sent successfully to AI service');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Error sending training data to AI: ${errorMessage}`);
      throw error;
    }
  }
}

/**
 * Service to handle user interactions with recipes
 * Implements comprehensive user interaction tracking and AI integration
 */
export class UserInteractionService {
  private aiService: IAIService;
  private userRepository: IUserRepository;
  private recipeRepository: EnhancedRecipeRepository;

  constructor() {
    this.aiService = new EnhancedAIService();
    this.userRepository = new UserRepository();
    this.recipeRepository = new EnhancedRecipeRepository();
  }

  /**
   * Record that a user viewed a recipe
   * @param recipeId - Recipe ID
   * @param userId - User ID
   * @returns Updated user history
   */
  public async recordRecipeView(
    recipeId: string,
    userId: string
  ): Promise<void> {
    try {
      // Validate IDs
      if (!mongoose.isValidObjectId(recipeId) || !mongoose.isValidObjectId(userId)) {
        throw new AppError('Invalid recipe or user ID', 400);
      }

      // Update user history
      await this.userRepository.updateRecipeHistory(userId, recipeId, {
        lastViewed: new Date()
      });

      logger.debug(`Recorded recipe view: User ${userId} viewed recipe ${recipeId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Failed to record recipe view: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Rate a recipe and update user history
   * @param recipeId - Recipe ID
   * @param userId - User ID
   * @param rating - Rating (1-5)
   * @returns Updated recipe with rating
   */
  public async rateRecipe(
    recipeId: string,
    userId: string,
    rating: number
  ): Promise<IRecipeWithRating> {
    try {
      // Validate inputs
      if (!mongoose.isValidObjectId(recipeId) || !mongoose.isValidObjectId(userId)) {
        throw new AppError('Invalid recipe or user ID', 400);
      }
      
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        throw new AppError('Rating must be a number between 1 and 5', 400);
      }

      // Update recipe ratings
      const recipe = await this.recipeRepository.updateRecipeRating(recipeId, rating);
      
      if (!recipe) {
        throw new AppError('Recipe not found', 404);
      }

      // Update user history
      await this.userRepository.updateRecipeHistory(userId, recipeId, {
        rating,
        lastUpdated: new Date()
      });

      // Send training data to AI service
      await this.sendTrainingDataToAI(userId, recipe, rating);

      return recipe;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Failed to rate recipe: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Toggle favorite status for a recipe
   * @param recipeId - Recipe ID
   * @param userId - User ID
   * @returns Update result with favorite status
   */
  public async toggleFavoriteRecipe(
    recipeId: string,
    userId: string
  ): Promise<{ favorited: boolean; recipe: IRecipeWithRating }> {
    try {
      // Validate IDs
      if (!mongoose.isValidObjectId(recipeId) || !mongoose.isValidObjectId(userId)) {
        throw new AppError('Invalid recipe or user ID', 400);
      }

      // Check if recipe exists
      const recipe = await this.recipeRepository.findById(recipeId);
      
      if (!recipe) {
        throw new AppError('Recipe not found', 404);
      }

      // Check current favorite status
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const isFavorite = user.favorites?.some(
        (favId: Types.ObjectId) => favId.toString() === recipeId
      );

      // Toggle favorite status
      if (isFavorite) {
        // Remove from favorites
        await this.userRepository.removeFromFavorites(userId, recipeId);
        
        // Update recipe favorite count
        await this.recipeRepository.decrementFavoriteCount(recipeId);
        
        return { favorited: false, recipe };
      } else {
        // Add to favorites
        await this.userRepository.addToFavorites(userId, recipeId);
        
        // Update recipe favorite count
        await this.recipeRepository.incrementFavoriteCount(recipeId);
        
        // Send training data to AI service for favorites
        await this.sendTrainingDataToAI(userId, recipe, 5, true);
        
        return { favorited: true, recipe };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Failed to toggle favorite: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get user's favorite recipes
   * @param userId - User ID
   * @returns Array of favorite recipes
   */
  public async getFavoriteRecipes(userId: string): Promise<IRecipeWithRating[]> {
    try {
      // Validate ID
      if (!mongoose.isValidObjectId(userId)) {
        throw new AppError('Invalid user ID', 400);
      }

      // Get user with populated favorites
      const user = await this.userRepository.findByIdWithFavorites(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Handle the case where favorites might be ObjectIds or populated recipes
      if (!user.favorites || user.favorites.length === 0) {
        return [];
      }

      // If favorites are populated recipes, convert them
      const firstFavorite = user.favorites[0];
      if (typeof firstFavorite === 'object' && 'title' in firstFavorite) {
        // Favorites are already populated recipes - use type assertion to handle FlattenMaps
        return (user.favorites as any[])
          .map(recipe => convertLeanToRecipeDocument(recipe))
          .map(recipe => ensureRecipeWithRating(recipe));
      } else {
        // Favorites are ObjectIds, need to fetch recipes
        const favoriteIds = user.favorites as Types.ObjectId[];
        return await this.recipeRepository.findByIds(favoriteIds);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Failed to get favorite recipes: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get user's recipe history
   * @param userId - User ID
   * @param limit - Maximum number of history items
   * @returns Array of recent recipe interactions
   */
  public async getRecipeHistory(userId: string, limit: number = 10): Promise<IRecipeHistory[]> {
    try {
      // Validate ID
      if (!mongoose.isValidObjectId(userId)) {
        throw new AppError('Invalid user ID', 400);
      }

      // Get user with populated recipe history
      const user = await this.userRepository.findByIdWithRecipeHistory(userId, limit);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user.recipeHistory || [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Failed to get recipe history: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get recent ingredients from user's recipe history
   * @param userId - User ID
   * @param limit - Maximum number of recipes to analyze
   * @returns Array of unique ingredients
   */
  public async getRecentIngredients(userId: string, limit: number = 5): Promise<string[]> {
    try {
      // Validate ID
      if (!mongoose.isValidObjectId(userId)) {
        throw new AppError('Invalid user ID', 400);
      }

      // Get user with populated recipe history
      const user = await this.userRepository.findByIdWithRecipeHistory(userId, limit);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Extract recipe IDs from history
      const recipeIds = (user.recipeHistory || [])
        .sort((a: IRecipeHistory, b: IRecipeHistory) => {
          return (b.lastViewed?.getTime() || 0) - (a.lastViewed?.getTime() || 0);
        })
        .slice(0, limit)
        .map((history: IRecipeHistory) => history.recipeId);

      // Find recipes
      const recipes = await this.recipeRepository.findByIds(recipeIds);

      // Extract and flatten ingredients
      const allIngredients = recipes.flatMap((recipe: IRecipeWithRating) => 
        recipe.ingredients?.map((ing: string | { name: string }) => 
          typeof ing === 'string' ? ing : ing.name
        ) || []
      );

      // Remove duplicates and return as string array
      return [...new Set(allIngredients)];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.error(`Failed to get recent ingredients: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Send training data to AI service
   * @param userId - User ID
   * @param recipe - Recipe object
   * @param rating - User rating
   * @param isFavorite - Whether recipe was favorited
   */
  private async sendTrainingDataToAI(
    userId: string,
    recipe: IRecipeWithRating,
    rating: number,
    isFavorite: boolean = false
  ): Promise<void> {
    try {
      // Extract ingredients
      const ingredients = recipe.ingredients.map((ing: string | { name: string }) => 
        typeof ing === 'string' ? ing : ing.name
      );

      // Create training data
      const trainingData: IAITrainingData = {
        user_id: userId,
        recipe_id: recipe._id.toString(),
        recipe_title: recipe.title,
        recipe_ingredients: ingredients,
        recipe_description: recipe.description || recipe.title,
        cuisine: recipe.cuisines?.[0] || '',
        user_rating: rating,
        is_favorite: isFavorite,
        timestamp: new Date().toISOString()
      };

      // Send training data asynchronously
      await this.aiService.sendTrainingData(trainingData);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger.warn(`Failed to send training data to AI: ${errorMessage}`);
      // Don't throw error to prevent disrupting the user flow
    }
  }
}
