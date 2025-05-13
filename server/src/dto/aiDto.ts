import { ObjectId } from 'mongoose';

/**
 * Data Transfer Objects for AI-related functionality
 */

/**
 * Recipe enhancement request DTO
 */
export interface EnhanceRecipesRequestDto {
  recipes: any[];
  user_preferences?: UserPreferencesDto;
  ingredients?: string[];
}

/**
 * User preferences for personalization
 */
export interface UserPreferencesDto {
  favorites?: string[];
  dietary_restrictions?: string[];
  cuisine_preferences?: string[];
  past_interactions?: UserInteractionDto[];
}

/**
 * User interaction history for recipe personalization
 */
export interface UserInteractionDto {
  recipe_id: string;
  rating?: number;
  last_viewed?: string;
  saved?: boolean;
}

/**
 * Enhanced recipe response
 */
export interface EnhancedRecipeDto {
  _id: string | ObjectId;
  title: string;
  relevance_score?: number;
  personalization_score?: number;
  ingredients: any[];
  instructions: string;
  nutritionalInfo?: any;
  suggestedModifications?: string[];
  cookingTips?: string[];
  [key: string]: any; // Allow additional fields
}

/**
 * Ingredient analysis request parameters
 */
export interface IngredientAnalysisRequestDto {
  ingredients: string[];
  dietaryRestrictions?: string[];
  recipeTitle?: string;
  recipeInstructions?: string;
  generateShoppingList?: boolean;
  generateSubstitutions?: boolean;
}

/**
 * Ingredient analysis response
 */
export interface IngredientAnalysisDto {
  analysis?: {
    nutritional_summary?: any;
    flavor_profile?: any;
    cooking_tips?: string[];
    technique_suggestions?: string[];
    alternative_methods?: string[];
    shopping_list?: string[];
    categorized_list?: CategoryListItem[];
  };
  suggested_additions?: IngredientSubstitution[];
  missing_essentials?: string[];
}

/**
 * Ingredient substitution suggestion
 */
export interface IngredientSubstitution {
  original: string;
  substitutes: string[];
  reason?: string;
}

/**
 * Categorized shopping list item
 */
export interface CategoryListItem {
  category: string;
  items: string[];
}

/**
 * AI training data format
 */
export interface TrainingDataDto {
  user_id: string;
  recipe_id: string;
  recipe_title: string;
  recipe_ingredients: string[];
  recipe_description?: string;
  cuisine?: string;
  user_rating?: number;
  is_favorite?: boolean;
  timestamp: string;
}

/**
 * Cooking tips response
 */
export interface CookingTipsDto {
  cookingTips: string[];
  techniqueSuggestions?: string[];
  alternativeMethods?: string[];
}

/**
 * Analyze ingredients response
 */
export interface ShoppingListRequestDto {
  recipeIds?: string[];
  useMealPlan?: boolean;
}

/**
 * Shopping list generation result
 */
export interface ShoppingListResultDto {
  success: boolean;
  error?: string;
  shoppingList: string[];
  categorizedList?: CategoryListItem[];
  recipeCount: number;
  aiEnhanced: boolean;
}