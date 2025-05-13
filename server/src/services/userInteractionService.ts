import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { IUser } from '../models/User';
import Recipe from '../models/Recipe';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error';
import { AIService } from './aiService';
import { UserRepository } from '../repositories/userRepository';
import { RecipeRepository } from '../repositories/recipeRepository';

/**
 * Service to handle user interactions with recipes
 */
export class UserInteractionService {
  private aiService: AIService;
  private userRepository: UserRepository;
  private recipeRepository: RecipeRepository;

  constructor() {
    this.aiService = new AIService();
    this.userRepository = new UserRepository();
    this.recipeRepository = new RecipeRepository();
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
    } catch (error) {
      logger.error(`Failed to record recipe view: ${error.message}`);
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
  ): Promise<any> {
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
      this.sendTrainingDataToAI(userId, recipe, rating);

      return recipe;
    } catch (error) {
      logger.error(`Failed to rate recipe: ${error.message}`);
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
  ): Promise<{ favorited: boolean; recipe: any }> {
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
        favId => favId.toString() === recipeId
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
        this.sendTrainingDataToAI(userId, recipe, 5, true);
        
        return { favorited: true, recipe };
      }
    } catch (error) {
      logger.error(`Failed to toggle favorite: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's favorite recipes
   * @param userId - User ID
   * @returns Array of favorite recipes
   */
  public async getFavoriteRecipes(userId: string): Promise<any[]> {
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

      return user.favorites || [];
    } catch (error) {
      logger.error(`Failed to get favorite recipes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's recipe history
   * @param userId - User ID
   * @param limit - Maximum number of history items
   * @returns Array of recent recipe interactions
   */
  public async getRecipeHistory(userId: string, limit: number = 10): Promise<any[]> {
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
    } catch (error) {
      logger.error(`Failed to get recipe history: ${error.message}`);
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
        .sort((a, b) => {
          return (b.lastViewed?.getTime() || 0) - (a.lastViewed?.getTime() || 0);
        })
        .slice(0, limit)
        .map(history => history.recipeId);

      // Find recipes
      const recipes = await this.recipeRepository.findByIds(recipeIds);

      // Extract and flatten ingredients
      const allIngredients = recipes.flatMap(recipe => 
        recipe.ingredients?.map(ing => typeof ing === 'string' ? ing : ing.name) || []
      );

      // Remove duplicates
      return [...new Set(allIngredients)];
    } catch (error) {
      logger.error(`Failed to get recent ingredients: ${error.message}`);
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
    recipe: any,
    rating: number,
    isFavorite: boolean = false
  ): Promise<void> {
    try {
      // Extract ingredients
      const ingredients = recipe.ingredients.map(ing => 
        typeof ing === 'string' ? ing : ing.name
      );

      // Create training data
      const trainingData = {
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
    } catch (error) {
      logger.warn(`Failed to send training data to AI: ${error.message}`);
      // Don't throw error to prevent disrupting the user flow
    }
  }
}