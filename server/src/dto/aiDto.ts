import { ObjectId } from 'mongoose';

/**
 * Data Transfer Objects for AI-related functionality
 */

/**
 * Recipe enhancement result interface
 */
export interface AIRecipeEnhancementResult {
  recipes: any[];
  ai_enhanced: boolean;
  enhancement_quality?: string;
}

/**
 * User preferences for personalization
 */
export interface UserPreferences {
  favorites?: string[];
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  past_interactions?: {
    recipe_id: string;
    rating?: number;
    last_viewed?: string;
    saved?: boolean;
  }[];
}

/**
 * AI training data format
 */
export interface AITrainingData {
  user_id: string;
  recipe_id: string;
  rating?: number;
  is_favorite?: boolean;
  interaction_type?: string;
}

/**
 * Cooking tips response
 */
export interface AICookingTips {
  tips: string[];
  techniques: string[];
  alternatives: string[];
  time_saving_tips: string[];
  ai_enhanced: boolean;
}

/**
 * Ingredient analysis response
 */
export interface AIIngredientAnalysis {
  substitutions: any[];
  analysis: any;
  nutritional_info?: any;
  allergens?: string[];
  nutritional_impact?: any;
}

/**
 * Shopping list generation result
 */
export interface ShoppingListResult {
  shopping_list: string[];
  categorized_list: any[];
  estimated_cost?: number;
  recipe_count: number;
  ai_enhanced: boolean;
}

/**
 * Options for recipe analysis
 */
export interface AIRecipeAnalysisOptions {
  recipeTitle?: string;
  instructions?: string;
  dietaryRestrictions?: string[];
  generateShoppingList?: boolean;
  detailedNutrition?: boolean;
}

/**
 * AI model training result
 */
export interface AIModelTrainingResult {
  success: boolean;
  model_info?: any;
  records_processed?: number;
  training_time?: number;
}

/**
 * AI recipe analysis response
 */
export interface AIRecipeAnalysisResponse {
  recipes: any[];
  enhancement_quality?: string;
}