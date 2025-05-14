/**
 * Enum definitions for recipe-related properties
 * 
 * These enums provide standardized options for recipe categorization
 * and attributes across the application.
 */

/**
 * Represents the difficulty level of preparing a recipe
 */
export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

/**
 * Represents the type of cuisine for a recipe
 */
export enum CuisineType {
  ITALIAN = 'ITALIAN',
  MEXICAN = 'MEXICAN',
  CHINESE = 'CHINESE',
  JAPANESE = 'JAPANESE',
  INDIAN = 'INDIAN',
  AMERICAN = 'AMERICAN',
  FRENCH = 'FRENCH',
  MEDITERRANEAN = 'MEDITERRANEAN',
  THAI = 'THAI',
  GREEK = 'GREEK',
  SPANISH = 'SPANISH',
  MIDDLE_EASTERN = 'MIDDLE_EASTERN',
  KOREAN = 'KOREAN',
  VIETNAMESE = 'VIETNAMESE',
  CARIBBEAN = 'CARIBBEAN',
  OTHER = 'OTHER'
}

/**
 * Represents dietary restrictions that a recipe accommodates
 */
export enum DietaryRestriction {
  VEGETARIAN = 'VEGETARIAN',
  VEGAN = 'VEGAN',
  GLUTEN_FREE = 'GLUTEN_FREE',
  DAIRY_FREE = 'DAIRY_FREE',
  NUT_FREE = 'NUT_FREE',
  LOW_CARB = 'LOW_CARB',
  KETO = 'KETO',
  PALEO = 'PALEO',
  PESCATARIAN = 'PESCATARIAN',
  HALAL = 'HALAL',
  KOSHER = 'KOSHER'
}

/**
 * Represents the type of meal for which a recipe is intended
 */
export enum MealType {
  BREAKFAST = 'BREAKFAST',
  LUNCH = 'LUNCH',
  DINNER = 'DINNER',
  APPETIZER = 'APPETIZER',
  SNACK = 'SNACK',
  DESSERT = 'DESSERT',
  DRINK = 'DRINK',
  SIDE = 'SIDE',
  SAUCE = 'SAUCE',
  SOUP = 'SOUP',
  SALAD = 'SALAD',
  BAKED_GOODS = 'BAKED_GOODS'
}