import axios from 'axios';
import { config } from '../config/env';
import Recipe, { IRecipe } from '../models/Recipe';
import User, { IUser } from '../models/User';
import { AppError } from '../middleware/error';
import winston from 'winston';

// Initialize logger
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Spoonacular API interface
interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType: string;
  usedIngredientCount: number;
  missedIngredientCount: number;
  missedIngredients: any[];
  usedIngredients: any[];
  unusedIngredients: any[];
  likes: number;
  summary?: string;
  readyInMinutes?: number;
  servings?: number;
  sourceUrl?: string;
  sourceName?: string;
  cuisines?: string[];
  dishTypes?: string[];
  diets?: string[];
  occasions?: string[];
  analyzedInstructions?: any[];
  nutrition?: any;
}

// Recipe search parameters
interface RecipeSearchParams {
  ingredients: string[];
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  type?: string;
  sort?: string;
  sortDirection?: string;
  number?: number;
  offset?: number;
}

// AI-enhanced recipe response
interface EnhancedRecipeResponse {
  recipes: IRecipe[];
  personalizedOrder?: number[];
  recommendations?: any;
}

// Create a cached instance of axios with Spoonacular API configuration
const spoonacularApi = axios.create({
  baseURL: config.spoonacularBaseUrl,
  params: {
    apiKey: config.spoonacularApiKey
  },
  timeout: 10000
});

/**
 * Handle Spoonacular API errors with detailed logging and appropriate responses
 */
const handleApiError = (error: any): never => {
  logger.error(`Spoonacular API error: ${error.message}`, { 
    stack: error.stack,
    response: error.response?.data
  });
  
  if (error.response) {
    const { status, data } = error.response;
    
    if (status === 402) {
      throw new AppError('API quota exceeded. Please try again later.', 429);
    }
    
    if (status === 401) {
      logger.error('Invalid Spoonacular API key');
      throw new AppError('Authentication error with recipe service', 500);
    }
    
    throw new AppError(
      `External API error: ${data.message || 'Unknown error'}`,
      status
    );
  }
  
  if (error.request) {
    throw new AppError('Unable to reach recipe service. Please try again later.', 503);
  }
  
  throw new AppError('Unexpected error when fetching recipes', 500);
};

/**
 * Format ingredients list for Spoonacular API
 */
const formatIngredients = (ingredients: string[]): string => {
  return ingredients
    .map(ing => ing.trim().toLowerCase())
    .filter(Boolean) // Remove empty strings
    .join(',');
};

/**
 * Search recipes by ingredients with optimized caching strategy
 */
export const searchRecipesByIngredients = async (
  params: RecipeSearchParams
): Promise<SpoonacularRecipe[]> => {
  try {
    const { ingredients, number = 10, ...otherParams } = params;
    
    if (!ingredients || !ingredients.length) {
      throw new AppError('At least one ingredient is required', 400);
    }
    
    const formattedIngredients = formatIngredients(ingredients);
    
    // Try to fetch from cache first
    const cacheKey = `ingredients:${formattedIngredients}:${number}:${JSON.stringify(otherParams)}`;
    const cachedResults = await Recipe.findByCacheKey(cacheKey);
    
    if (cachedResults && cachedResults.length >= number) {
      logger.info(`Returning cached results for ${cacheKey}`);
      return cachedResults.map(recipe => ({
        id: recipe.externalId,
        title: recipe.title,
        image: recipe.image,
        imageType: 'jpg',
        usedIngredientCount: recipe.ingredients.length,
        missedIngredientCount: 0,
        missedIngredients: [],
        usedIngredients: recipe.ingredients,
        unusedIngredients: [],
        likes: recipe.popularity || 0
      } as SpoonacularRecipe));
    }
    
    logger.info(`Fetching recipes from Spoonacular for ingredients: ${formattedIngredients}`);
    const response = await spoonacularApi.get('/recipes/findByIngredients', {
      params: {
        ingredients: formattedIngredients,
        number,
        ranking: 2, // Maximize used ingredients (1: minimize missing, 2: maximize used)
        ignorePantry: true, // Ignore typical pantry items
        ...otherParams
      }
    });
    
    // Cache results for future use
    if (response.data && response.data.length) {
      response.data.forEach((recipe: SpoonacularRecipe) => {
        getCachedRecipeDetails(recipe.id);
      });
    }
    
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Get cached recipe details or fetch from API
 */
const getCachedRecipeDetails = async (recipeId: number): Promise<any> => {
  try {
    const cachedRecipe = await Recipe.findByExternalId(recipeId);
    
    if (cachedRecipe) {
      logger.debug(`Using cached recipe for ID: ${recipeId}`);
      return cachedRecipe;
    }
    
    logger.info(`Fetching recipe details for ID: ${recipeId}`);
    const response = await spoonacularApi.get(`/recipes/${recipeId}/information`, {
      params: {
        includeNutrition: true
      }
    });
    
    // Save to cache in background
    saveRecipeToDatabase(response.data).catch(err => {
      logger.error(`Failed to cache recipe: ${err.message}`);
    });
    
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Public method to get recipe details by ID
 */
export const getRecipeDetails = async (recipeId: number): Promise<any> => {
  return getCachedRecipeDetails(recipeId);
};

/**
 * Transform Spoonacular recipe to our Recipe model format
 */
const transformRecipeData = (spoonacularRecipe: any): Partial<IRecipe> => {
  // Extract ingredients with error handling
  const ingredients = (spoonacularRecipe.extendedIngredients || []).map((ing: any) => ({
    id: ing.id || 0,
    name: ing.name || 'Unknown ingredient',
    amount: ing.amount || 0,
    unit: ing.unit || '',
    image: ing.image || ''
  }));
  
  // Extract instructions with error handling
  const instructions = (spoonacularRecipe.analyzedInstructions?.[0]?.steps || []).map((step: any, index: number) => ({
    step: step.number || index + 1,
    description: step.step || 'No description provided',
    equipment: (step.equipment || []).map((eq: any) => eq.name || 'Unknown equipment')
  }));
  
  // Extract nutrition with error handling
  const nutrition: any = {};
  if (spoonacularRecipe.nutrition?.nutrients) {
    spoonacularRecipe.nutrition.nutrients.forEach((nutrient: any) => {
      const name = nutrient.name.toLowerCase();
      if (['calories', 'protein', 'fat', 'carbs'].includes(name)) {
        nutrition[name] = nutrient.amount || 0;
      }
    });
  }
  
  // Calculate popularity score with defaults
  const popularity = (spoonacularRecipe.aggregateLikes || 0) + 
                    (spoonacularRecipe.spoonacularScore || 0) / 10;
  
  return {
    externalId: spoonacularRecipe.id,
    title: spoonacularRecipe.title || 'Untitled Recipe',
    summary: spoonacularRecipe.summary || '',
    image: spoonacularRecipe.image || '',
    readyInMinutes: spoonacularRecipe.readyInMinutes || 30,
    servings: spoonacularRecipe.servings || 1,
    sourceUrl: spoonacularRecipe.sourceUrl || '',
    sourceName: spoonacularRecipe.sourceName || 'Unknown Source',
    dishTypes: spoonacularRecipe.dishTypes || [],
    cuisines: spoonacularRecipe.cuisines || [],
    diets: spoonacularRecipe.diets || [],
    occasions: spoonacularRecipe.occasions || [],
    ingredients,
    instructions,
    nutrition,
    popularity,
    lastRefreshed: new Date()
  };
};

/**
 * Save a recipe to our database with optimized upsert
 */
export const saveRecipeToDatabase = async (recipeData: any): Promise<IRecipe> => {
  try {
    // Transform the data
    const transformedRecipe = transformRecipeData(recipeData);
    
    if (!transformedRecipe.externalId) {
      throw new AppError('Recipe is missing external ID', 400);
    }
    
    // Use findOneAndUpdate with upsert for atomic operation
    const recipe = await Recipe.findOneAndUpdate(
      { externalId: transformedRecipe.externalId },
      { 
        $set: transformedRecipe,
        $inc: { viewCount: 1 } // Track popularity
      },
      { 
        new: true, 
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );
    
    return recipe;
  } catch (error: any) {
    logger.error(`Error saving recipe to database: ${error.message}`, { stack: error.stack });
    throw new AppError(`Failed to save recipe: ${error.message}`, 500);
  }
};

/**
 * Send recipes to AI service for enhancement
 */
export const enhanceRecipesWithAI = async (
  recipes: any[],
  user?: IUser
): Promise<EnhancedRecipeResponse> => {
  try {
    // If AI service URL is not configured or in test mode, return original recipes
    if (!config.aiServiceUrl || process.env.NODE_ENV === 'test') {
      logger.info('AI service enhancement skipped (not configured or in test mode)');
      return { recipes };
    }
    
    // Prepare user preferences data if user is provided
    const userPrefs = user ? {
      dietaryRestrictions: user.preferences?.dietaryRestrictions || [],
      favoriteCuisines: user.preferences?.favoriteCuisines || [],
      allergies: user.preferences?.allergies || [],
      dislikedIngredients: user.preferences?.dislikedIngredients || [],
      searchHistory: user.searchHistory || []
    } : null;
    
    // Send request to AI service with retry logic
    const callAIService = async (retries = 3): Promise<any> => {
      try {
        return await axios.post(config.aiServiceUrl, {
          recipes,
          userPreferences: userPrefs
        }, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': config.aiServiceApiKey || ''
          }
        });
      } catch (error: any) {
        if (retries > 0 && (error.code === 'ECONNABORTED' || error.response?.status >= 500)) {
          logger.warn(`AI service call failed, retrying (${retries} attempts left)`);
          return callAIService(retries - 1);
        }
        throw error;
      }
    };
    
    const response = await callAIService();
    
    logger.info('Recipes enhanced with AI service');
    return response.data;
  } catch (error: any) {
    logger.error(`Error enhancing recipes with AI: ${error.message}`, { stack: error.stack });
    // Return original recipes if AI enhancement fails
    return { recipes };
  }
};

/**
 * Process and prepare recipes for response with optimized parallel processing
 */
export const processRecipesForResponse = async (
  basicRecipes: SpoonacularRecipe[],
  user?: IUser
): Promise<IRecipe[]> => {
  try {
    // Update user search history in background
    if (user) {
      updateUserSearchHistory(user, basicRecipes).catch(err => {
        logger.error(`Failed to update user search history: ${err.message}`);
      });
    }
    
    // Use Promise.all to fetch detailed information for each recipe in parallel
    const detailedRecipesPromises = basicRecipes.map(recipe => 
      getRecipeDetails(recipe.id)
    );
    
    const detailedRecipes = await Promise.all(detailedRecipesPromises);
    
    // Use Promise.all to save recipes to database in parallel
    const savedRecipesPromises = detailedRecipes.map(recipe => 
      saveRecipeToDatabase(recipe)
    );
    
    const savedRecipes = await Promise.all(savedRecipesPromises);
    
    // Use AI service to enhance and personalize recipes
    const enhancedRecipesResponse = await enhanceRecipesWithAI(savedRecipes, user);
    
    return enhancedRecipesResponse.recipes;
  } catch (error) {
    logger.error(`Error processing recipes: ${error}`);
    throw error;
  }
};

/**
 * Update user search history in background
 */
const updateUserSearchHistory = async (user: IUser, recipes: SpoonacularRecipe[]): Promise<void> => {
  try {
    // Extract ingredients from search
    const ingredients = new Set<string>();
    recipes.forEach(recipe => {
      (recipe.usedIngredients || []).forEach(ingredient => {
        if (ingredient.name) {
          ingredients.add(ingredient.name.toLowerCase());
        }
      });
    });
    
    // Update user search history (limit to 20 entries)
    await User.findByIdAndUpdate(user._id, {
      $push: {
        searchHistory: {
          $each: Array.from(ingredients),
          $slice: -20
        }
      },
      lastActivity: new Date()
    });
    
    logger.debug(`Updated search history for user ${user._id}`);
  } catch (error: any) {
    logger.error(`Failed to update user search history: ${error.message}`);
    // Non-blocking operation, so just log the error
  }
};

/**
 * Get recipe suggestions based on user preferences and popular recipes
 */
export const getRecipeSuggestions = async (
  user: IUser,
  limit: number = 5
): Promise<IRecipe[]> => {
  try {
    // Start with base query - highest rated recipes
    let query: any = Recipe.find({})
      .sort({ popularity: -1, viewCount: -1 })
      .limit(limit);
    
    // If user has preferences, refine query
    if (user?.preferences) {
      const { favoriteCuisines, dietaryRestrictions, allergies } = user.preferences;
      
      // Build query conditions
      const conditions: any[] = [];
      
      // Include favorite cuisines if available
      if (favoriteCuisines?.length) {
        conditions.push({ cuisines: { $in: favoriteCuisines } });
      }
      
      // Exclude recipes with dietary restrictions
      if (dietaryRestrictions?.length) {
        conditions.push({ diets: { $all: dietaryRestrictions } });
      }
      
      // Exclude allergies
      if (allergies?.length) {
        conditions.push({ 
          ingredients: { 
            $not: { 
              $elemMatch: { name: { $in: allergies.map(a => new RegExp(a, 'i')) } } 
            } 
          } 
        });
      }
      
      // Apply all conditions if they exist
      if (conditions.length > 0) {
        query = Recipe.find({ $and: conditions })
          .sort({ popularity: -1, viewCount: -1 })
          .limit(limit);
      }
    }
    
    const recipes = await query.exec();
    
    // If not enough recipes found with strict criteria, supplement with popular ones
    if (recipes.length < limit) {
      const remainingNeeded = limit - recipes.length;
      const existingIds = recipes.map(r => r._id);
      
      const additionalRecipes = await Recipe
        .find({ _id: { $nin: existingIds } })
        .sort({ popularity: -1, viewCount: -1 })
        .limit(remainingNeeded);
      
      recipes.push(...additionalRecipes);
    }
    
    return recipes;
  } catch (error: any) {
    logger.error(`Error getting recipe suggestions: ${error.message}`);
    throw new AppError(`Failed to get recipe suggestions: ${error.message}`, 500);
  }
};

/**
 * Get trending recipes based on recent views and popularity
 */
export const getTrendingRecipes = async (limit: number = 5): Promise<IRecipe[]> => {
  try {
    // Get recipes updated in the last 7 days with high view counts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recipes = await Recipe.find({
      updatedAt: { $gte: sevenDaysAgo }
    })
    .sort({ viewCount: -1, popularity: -1 })
    .limit(limit);
    
    return recipes;
  } catch (error: any) {
    logger.error(`Error getting trending recipes: ${error.message}`);
    throw new AppError(`Failed to get trending recipes: ${error.message}`, 500);
  }
};

/**
 * Rate a recipe by user
 */
export const rateRecipe = async (
  recipeId: string, 
  userId: string, 
  rating: number
): Promise<IRecipe> => {
  try {
    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new AppError('Rating must be between 1 and 5', 400);
    }
    
    // Update recipe rating
    const recipe = await Recipe.findById(recipeId);
    
    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }
    
    // Check if user already rated this recipe
    const existingRatingIndex = recipe.ratings.findIndex(
      r => r.userId.toString() === userId
    );
    
    if (existingRatingIndex >= 0) {
      // Update existing rating
      recipe.ratings[existingRatingIndex].rating = rating;
    } else {
      // Add new rating
      recipe.ratings.push({
        userId,
        rating,
        date: new Date()
      });
    }
    
    // Calculate average rating
    const totalRating = recipe.ratings.reduce((sum, r) => sum + r.rating, 0);
    recipe.userRating = recipe.ratings.length > 0 ? totalRating / recipe.ratings.length : 0;
    
    await recipe.save();
    
    return recipe;
  } catch (error: any) {
    logger.error(`Error rating recipe: ${error.message}`);
    throw new AppError(`Failed to rate recipe: ${error.message}`, 500);
  }
};

/**
 * Mark a recipe as favorite for a user
 */
export const toggleFavoriteRecipe = async (
  recipeId: string,
  userId: string
): Promise<{ isFavorite: boolean }> => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const recipeIndex = user.favorites.indexOf(recipeId);
    
    if (recipeIndex >= 0) {
      // Remove from favorites
      user.favorites.splice(recipeIndex, 1);
      await user.save();
      return { isFavorite: false };
    } else {
      // Add to favorites
      user.favorites.push(recipeId);
      await user.save();
      return { isFavorite: true };
    }
  } catch (error: any) {
    logger.error(`Error toggling favorite recipe: ${error.message}`);
    throw new AppError(`Failed to update favorite: ${error.message}`, 500);
  }
};

/**
 * Get user's favorite recipes
 */
export const getFavoriteRecipes = async (userId: string): Promise<IRecipe[]> => {
  try {
    const user = await User.findById(userId).populate('favorites');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return user.favorites as unknown as IRecipe[];
  } catch (error: any) {
    logger.error(`Error getting favorite recipes: ${error.message}`);
    throw new AppError(`Failed to get favorites: ${error.message}`, 500);
  }
};