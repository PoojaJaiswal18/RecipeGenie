/**
 * Data Transfer Objects for recipes and related entities
 * 
 * These DTOs define the shape of data passed between layers of the application,
 * ensuring type safety and consistent data structures.
 */

import { Difficulty, CuisineType, DietaryRestriction, MealType } from '../enums/recipeEnums';

/**
 * Base recipe information used for creation and updates
 */
export interface RecipeBaseDto {
  title: string;
  description: string;
  preparationTimeMinutes: number;
  cookingTimeMinutes: number;
  servings: number;
  difficulty: Difficulty;
  cuisineType: CuisineType;
  dietaryRestrictions: DietaryRestriction[];
  mealType: MealType;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/**
 * Data needed to create a new recipe
 */
export interface CreateRecipeDto extends RecipeBaseDto {
  ingredients: IngredientDto[];
  instructions: string[];
  tags: string[];
  imageUrl?: string;
}

/**
 * Data returned when querying for a recipe
 */
export interface RecipeResponseDto extends RecipeBaseDto {
  id: string;
  ingredients: IngredientDto[];
  instructions: string[];
  tags: string[];
  imageUrl?: string;
  rating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
  favoriteCount: number;
  isUserFavorite?: boolean;
}

/**
 * Data needed to update an existing recipe
 */
export interface UpdateRecipeDto extends Partial<RecipeBaseDto> {
  ingredients?: IngredientDto[];
  instructions?: string[];
  tags?: string[];
  imageUrl?: string;
}

/**
 * Ingredient information
 */
export interface IngredientDto {
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

/**
 * Query parameters for searching recipes
 */
export interface RecipeSearchParams {
  query?: string;
  cuisineTypes?: CuisineType[];
  mealTypes?: MealType[];
  dietaryRestrictions?: DietaryRestriction[];
  difficulty?: Difficulty;
  maxPrepTime?: number;
  maxCookTime?: number;
  ingredients?: string[];
  minRating?: number;
  tags?: string[];
  page?: number;
  pageSize?: number;
  sortBy?: 'rating' | 'createdAt' | 'popularity';
  sortDirection?: 'asc' | 'desc';
}

/**
 * Paginated results for recipe queries
 */
export interface PaginatedRecipesResponseDto {
  recipes: RecipeResponseDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Data for recipe ratings
 */
export interface RecipeRatingDto {
  recipeId: string;
  userId: string;
  rating: number;
  comment?: string;
}