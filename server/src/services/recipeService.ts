import axios, { AxiosInstance } from 'axios';
import mongoose, { PipelineStage } from 'mongoose';
import { config } from '../config/env';
import Recipe, { IRecipe, IIngredient, IInstruction, INutrition } from '../models/Recipe';
import User from '../models/User';
import { AppError } from '../middleware/error';
import winston from 'winston';

// Enhanced interfaces
interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType?: string;
  usedIngredientCount?: number;
  missedIngredientCount?: number;
  missedIngredients?: any[];
  usedIngredients?: any[];
  unusedIngredients?: any[];
  likes?: number;
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
  extendedIngredients?: any[];
  aggregateLikes?: number;
  spoonacularScore?: number;
}

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

interface EnhancedRecipeResponse {
  recipes: IRecipe[];
  personalizedOrder?: number[];
  recommendations?: any;
}

interface RecipeRating {
  userId: string;
  rating: number;
  date: Date;
}

interface MealPlanEntry {
  recipeId: string;
  date: Date;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
}

// Extended config interface to include AI service configuration
interface ExtendedConfig {
  spoonacularBaseUrl: string;
  spoonacularApiKey: string;
  logLevel?: string;
  aiServiceUrl?: string;
  aiServiceApiKey?: string;
}

// Type assertion for config with AI service properties
const extendedConfig = config as ExtendedConfig;

// Enhanced User interface extensions
declare module '../models/User' {
  interface IUser {
    _id: string;
    favoriteRecipes?: string[];
    lastActivity?: Date;
    searchHistory?: string[];
    mealPlan?: MealPlanEntry[];
    preferences?: {
      dietaryRestrictions?: string[];
      favoriteCuisines?: string[];
      allergies?: string[];
      dislikedIngredients?: string[];
    };
  }
}

// Initialize optimized logger configuration
const logger = winston.createLogger({
  level: extendedConfig.logLevel || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
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
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Create optimized axios instance with retry configuration
const spoonacularApi: AxiosInstance = axios.create({
  baseURL: extendedConfig.spoonacularBaseUrl,
  params: { apiKey: extendedConfig.spoonacularApiKey },
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'RecipeGenie/1.0'
  }
});

// Add request interceptor for retry logic
spoonacularApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    if (config.retry < 3 && (error.response?.status >= 500 || error.code === 'ECONNABORTED')) {
      config.retry += 1;
      logger.warn(`Retrying API request (attempt ${config.retry})`);
      return spoonacularApi(config);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Enhanced error handler with detailed error mapping
 */
const handleApiError = (error: any): never => {
  logger.error(`API error: ${error.message}`, { 
    stack: error.stack,
    response: error.response?.data,
    config: {
      url: error.config?.url,
      method: error.config?.method
    }
  });
  
  if (error.response) {
    const { status, data } = error.response;
    
    const errorMap: Record<number, { message: string; statusCode: number }> = {
      401: { message: 'Authentication error with recipe service', statusCode: 401 },
      402: { message: 'API quota exceeded. Please try again later.', statusCode: 429 },
      403: { message: 'Access forbidden to recipe service', statusCode: 403 },
      404: { message: 'Recipe not found in external service', statusCode: 404 },
      429: { message: 'Rate limit exceeded. Please try again later.', statusCode: 429 },
      500: { message: 'External recipe service error', statusCode: 502 }
    };
    
    const errorInfo = errorMap[status] || { 
      message: `External API error: ${data?.message || 'Unknown error'}`, 
      statusCode: status >= 500 ? 502 : status 
    };
    
    throw new AppError(errorInfo.message, errorInfo.statusCode);
  }
  
  if (error.request) {
    throw new AppError('Unable to reach recipe service. Please try again later.', 503);
  }
  
  throw new AppError('Unexpected error when fetching recipes', 500);
};

/**
 * Optimized cache key search with better performance
 */
const findByCacheKey = async (cacheKey: string): Promise<IRecipe[]> => {
  try {
    const keyParts = cacheKey.split(':');
    if (keyParts.length < 2) return [];
    
    const ingredients = keyParts[1]?.split(',').filter(Boolean) || [];
    if (!ingredients.length) return [];
    
    const regexPatterns = ingredients.map(ing => new RegExp(ing.trim(), 'i'));
    
    return await Recipe.find({
      'ingredients.name': { $in: regexPatterns }
    })
    .sort({ popularity: -1, userRating: -1 })
    .limit(10)
    .lean()
    .exec();
  } catch (error: any) {
    logger.error(`Cache key search error: ${error.message}`);
    return [];
  }
};

/**
 * Enhanced ingredient formatting with validation
 */
const formatIngredients = (ingredients: string[]): string => {
  return ingredients
    .filter(ing => ing && typeof ing === 'string')
    .map(ing => ing.trim().toLowerCase())
    .filter(ing => ing.length > 0 && ing.length <= 50) // Reasonable length limit
    .slice(0, 20) // Limit to 20 ingredients for API efficiency
    .join(',');
};

/**
 * Optimized recipe data transformation with proper type handling
 */
const transformRecipeData = (spoonacularRecipe: SpoonacularRecipe): Partial<IRecipe> => {
  // Transform ingredients with enhanced error handling
  const ingredients: IIngredient[] = (spoonacularRecipe.extendedIngredients || [])
    .map((ing: any) => ({
      id: Number(ing.id) || 0,
      name: String(ing.name || 'Unknown ingredient').trim(),
      amount: Number(ing.amount) || 0,
      unit: String(ing.unit || '').trim(),
      image: ing.image ? String(ing.image) : undefined
    }))
    .filter(ing => ing.name !== 'Unknown ingredient');
  
  // Transform instructions with proper typing - Fixed parameter type
  const instructions: IInstruction[] = (spoonacularRecipe.analyzedInstructions?.[0]?.steps || [])
    .map((step: any, index: number) => ({
      step: Number(step.number) || index + 1,
      description: String(step.step || 'No description provided').trim(),
      equipment: Array.isArray(step.equipment) 
        ? step.equipment.map((eq: any) => String(eq.name || '')).filter(Boolean)
        : []
    }))
    .filter((inst: IInstruction) => inst.description !== 'No description provided'); // Fixed parameter type
  
  // Transform nutrition with proper typing
  const nutrition: INutrition = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0
  };
  
  if (spoonacularRecipe.nutrition?.nutrients && Array.isArray(spoonacularRecipe.nutrition.nutrients)) {
    spoonacularRecipe.nutrition.nutrients.forEach((nutrient: any) => {
      const name = String(nutrient.name || '').toLowerCase();
      const amount = Number(nutrient.amount) || 0;
      
      switch (name) {
        case 'calories':
          nutrition.calories = amount;
          break;
        case 'protein':
          nutrition.protein = amount;
          break;
        case 'fat':
        case 'total fat':
          nutrition.fat = amount;
          break;
        case 'carbohydrates':
        case 'carbs':
        case 'total carbohydrates':
          nutrition.carbs = amount;
          break;
      }
    });
  }
  
  // Calculate enhanced popularity score
  const likes = Number(spoonacularRecipe.aggregateLikes) || 0;
  const score = Number(spoonacularRecipe.spoonacularScore) || 0;
  const popularity = Math.round(likes + (score / 10));
  
  return {
    externalId: Number(spoonacularRecipe.id),
    title: String(spoonacularRecipe.title || 'Untitled Recipe').trim(),
    summary: String(spoonacularRecipe.summary || '').trim(),
    image: String(spoonacularRecipe.image || ''),
    readyInMinutes: Math.max(1, Number(spoonacularRecipe.readyInMinutes) || 30),
    servings: Math.max(1, Number(spoonacularRecipe.servings) || 1),
    sourceUrl: spoonacularRecipe.sourceUrl || undefined,
    sourceName: spoonacularRecipe.sourceName || undefined,
    dishTypes: Array.isArray(spoonacularRecipe.dishTypes) ? spoonacularRecipe.dishTypes : [],
    cuisines: Array.isArray(spoonacularRecipe.cuisines) ? spoonacularRecipe.cuisines : [],
    diets: Array.isArray(spoonacularRecipe.diets) ? spoonacularRecipe.diets : [],
    occasions: Array.isArray(spoonacularRecipe.occasions) ? spoonacularRecipe.occasions : [],
    ingredients,
    instructions,
    nutrition,
    popularity,
    updatedAt: new Date()
  };
};

/**
 * Optimized database save with enhanced error handling
 */
export const saveRecipeToDatabase = async (recipeData: SpoonacularRecipe): Promise<IRecipe> => {
  try {
    const transformedRecipe = transformRecipeData(recipeData);
    
    if (!transformedRecipe.externalId) {
      throw new AppError('Recipe is missing external ID', 400);
    }
    
    const savedRecipe = await Recipe.findOneAndUpdate(
      { externalId: transformedRecipe.externalId },
      { 
        $set: transformedRecipe,
        $inc: { viewCount: 1 }
      },
      { 
        new: true, 
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        lean: false
      }
    );
    
    if (!savedRecipe) {
      throw new AppError('Failed to save recipe to database', 500);
    }
    
    return savedRecipe;
  } catch (error: any) {
    logger.error(`Database save error: ${error.message}`, { 
      stack: error.stack,
      externalId: recipeData.id 
    });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(`Failed to save recipe: ${error.message}`, 500);
  }
};

/**
 * Enhanced cached recipe details retrieval
 */
const getCachedRecipeDetails = async (recipeId: number): Promise<SpoonacularRecipe> => {
  try {
    // Check cache first with optimized query
    const cachedRecipe = await Recipe.findOne({ externalId: recipeId })
      .lean()
      .exec();
    
    if (cachedRecipe) {
      logger.debug(`Cache hit for recipe ID: ${recipeId}`);
      
      // Transform cached recipe back to SpoonacularRecipe format
      return {
        id: cachedRecipe.externalId,
        title: cachedRecipe.title,
        summary: cachedRecipe.summary,
        image: cachedRecipe.image,
        readyInMinutes: cachedRecipe.readyInMinutes,
        servings: cachedRecipe.servings,
        sourceUrl: cachedRecipe.sourceUrl,
        sourceName: cachedRecipe.sourceName,
        dishTypes: cachedRecipe.dishTypes,
        cuisines: cachedRecipe.cuisines,
        diets: cachedRecipe.diets,
        occasions: cachedRecipe.occasions,
        extendedIngredients: cachedRecipe.ingredients,
        analyzedInstructions: cachedRecipe.instructions.length > 0 ? [{
          steps: cachedRecipe.instructions.map(inst => ({
            number: inst.step,
            step: inst.description,
            equipment: (inst.equipment || []).map(eq => ({ name: eq }))
          }))
        }] : [],
        nutrition: {
          nutrients: cachedRecipe.nutrition ? [
            { name: 'calories', amount: cachedRecipe.nutrition.calories },
            { name: 'protein', amount: cachedRecipe.nutrition.protein },
            { name: 'fat', amount: cachedRecipe.nutrition.fat },
            { name: 'carbs', amount: cachedRecipe.nutrition.carbs }
          ] : []
        },
        aggregateLikes: cachedRecipe.popularity
      };
    }
    
    logger.info(`Fetching recipe details from API for ID: ${recipeId}`);
    const response = await spoonacularApi.get(`/recipes/${recipeId}/information`, {
      params: { 
        includeNutrition: true,
        addWinePairing: false,
        addTasteData: false
      }
    });
    
    // Cache in background without blocking
    setImmediate(() => {
      saveRecipeToDatabase(response.data).catch(err => {
        logger.error(`Background caching failed: ${err.message}`);
      });
    });
    
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Enhanced recipe search with optimized caching strategy
 */
export const searchRecipesByIngredients = async (
  params: RecipeSearchParams
): Promise<SpoonacularRecipe[]> => {
  try {
    const { ingredients, number = 10, ...otherParams } = params;
    
    if (!ingredients?.length) {
      throw new AppError('At least one ingredient is required', 400);
    }
    
    if (ingredients.length > 20) {
      throw new AppError('Maximum 20 ingredients allowed', 400);
    }
    
    const formattedIngredients = formatIngredients(ingredients);
    if (!formattedIngredients) {
      throw new AppError('No valid ingredients provided', 400);
    }
    
    const cacheKey = `ingredients:${formattedIngredients}:${number}:${JSON.stringify(otherParams)}`;
    const cachedResults = await findByCacheKey(cacheKey);
    
    if (cachedResults?.length >= Math.min(number, 10)) {
      logger.info(`Cache hit for ingredients search: ${formattedIngredients}`);
      return cachedResults.map(recipe => ({
        id: recipe.externalId,
        title: recipe.title,
        image: recipe.image,
        imageType: 'jpg',
        usedIngredientCount: recipe.ingredients?.length || 0,
        usedIngredients: recipe.ingredients || [],
        likes: recipe.popularity || 0,
        summary: recipe.summary
      } as SpoonacularRecipe));
    }
    
    logger.info(`API search for ingredients: ${formattedIngredients}`);
    const response = await spoonacularApi.get('/recipes/findByIngredients', {
      params: {
        ingredients: formattedIngredients,
        number: Math.min(number, 100), // API limit
        ranking: 2, 
        ignorePantry: true,
        limitLicense: false,
        ...otherParams
      }
    });
    
    if (!response.data?.length) {
      logger.info('No recipes found for ingredients');
      return [];
    }
    
    // Background caching with rate limiting
    const cachePromises = response.data
      .slice(0, 10) // Limit background caching
      .map((recipe: SpoonacularRecipe) => 
        getCachedRecipeDetails(recipe.id).catch(err => {
          logger.warn(`Background detail fetch failed for recipe ${recipe.id}: ${err.message}`);
        })
      );
    
    // Don't await - let it run in background
    Promise.allSettled(cachePromises);
    
    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Enhanced recipe details retrieval
 */
export const getRecipeDetails = async (recipeId: number): Promise<SpoonacularRecipe> => {
  if (!recipeId || recipeId <= 0) {
    throw new AppError('Invalid recipe ID provided', 400);
  }
  
  return getCachedRecipeDetails(recipeId);
};

/**
 * Optimized user search history update
 */
const updateUserSearchHistory = async (userId: string, recipes: SpoonacularRecipe[]): Promise<void> => {
  try {
    if (!userId || !recipes?.length) return;
    
    const ingredients = new Set<string>();
    
    recipes.forEach(recipe => {
      if (recipe.usedIngredients && Array.isArray(recipe.usedIngredients)) {
        recipe.usedIngredients.forEach(ingredient => {
          if (ingredient?.name && typeof ingredient.name === 'string') {
            ingredients.add(ingredient.name.toLowerCase().trim());
          }
        });
      }
    });
    
    if (ingredients.size === 0) return;
    
    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          searchHistory: {
            $each: Array.from(ingredients).slice(0, 10), // Limit new entries
            $slice: -50 // Keep last 50 entries
          }
        },
        lastActivity: new Date()
      },
      { 
        upsert: false,
        runValidators: false // Skip validation for performance
      }
    );
  } catch (error: any) {
    logger.error(`Search history update error: ${error.message}`, { userId });
  }
};

/**
 * Enhanced AI service integration with proper error handling
 */
export const enhanceRecipesWithAI = async (
  recipes: IRecipe[],
  userId?: string
): Promise<EnhancedRecipeResponse> => {
  try {
    // Skip if AI service isn't configured or in test mode
    if (!extendedConfig.aiServiceUrl || process.env.NODE_ENV === 'test') {
      logger.debug('AI service not configured or in test mode');
      return { recipes };
    }
    
    if (!recipes?.length) {
      return { recipes: [] };
    }
    
    // Get user preferences if available
    let userPrefs = null;
    if (userId) {
      try {
        const user = await User.findById(userId)
          .select('preferences searchHistory')
          .lean()
          .exec();
          
        if (user?.preferences) {
          userPrefs = {
            dietaryRestrictions: user.preferences.dietaryRestrictions || [],
            favoriteCuisines: user.preferences.favoriteCuisines || [],
            allergies: user.preferences.allergies || [],
            dislikedIngredients: user.preferences.dislikedIngredients || [],
            searchHistory: user.searchHistory?.slice(-20) || [] // Last 20 searches
          };
        }
      } catch (userError: any) {
        logger.warn(`Failed to fetch user preferences: ${userError.message}`);
      }
    }
    
    if (!extendedConfig.aiServiceApiKey) {
      logger.warn('AI service API key not configured');
      return { recipes };
    }
    
    // Enhanced AI service call with retry logic
    const callAIService = async (retries = 2): Promise<any> => {
      try {
        const response = await axios.post(
          extendedConfig.aiServiceUrl!,
          {
            recipes: recipes.slice(0, 20), // Limit payload size
            userPreferences: userPrefs
          },
          {
            timeout: 20000,
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': extendedConfig.aiServiceApiKey,
              'User-Agent': 'RecipeGenie/1.0'
            }
          }
        );
        
        return response;
      } catch (error: any) {
        if (retries > 0 && (
          error.code === 'ECONNABORTED' || 
          error.response?.status >= 500 ||
          error.response?.status === 429
        )) {
          logger.warn(`AI service retry (${retries} left): ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries))); // Exponential backoff
          return callAIService(retries - 1);
        }
        throw error;
      }
    };
    
    const response = await callAIService();
    
    if (response.data && typeof response.data === 'object') {
      return {
        recipes: response.data.recipes || recipes,
        personalizedOrder: response.data.personalizedOrder,
        recommendations: response.data.recommendations
      };
    }
    
    return { recipes };
  } catch (error: any) {
    logger.error(`AI enhancement error: ${error.message}`, { 
      userId,
      recipeCount: recipes.length 
    });
    return { recipes };
  }
};

/**
 * Optimized recipe processing with parallel execution
 */
export const processRecipesForResponse = async (
  basicRecipes: SpoonacularRecipe[],
  userId?: string
): Promise<IRecipe[]> => {
  try {
    if (!basicRecipes?.length) {
      return [];
    }
    
    // Update user search history in background
    if (userId) {
      setImmediate(() => {
        updateUserSearchHistory(userId, basicRecipes).catch(err => {
          logger.error(`Background search history update failed: ${err.message}`);
        });
      });
    }
    
    // Process recipes in batches to avoid overwhelming the system
    const batchSize = 5;
    const processedRecipes: IRecipe[] = [];
    
    for (let i = 0; i < basicRecipes.length; i += batchSize) {
      const batch = basicRecipes.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (recipe) => {
        try {
          const detailedRecipe = await getRecipeDetails(recipe.id);
          return await saveRecipeToDatabase(detailedRecipe);
        } catch (error: any) {
          logger.error(`Failed to process recipe ${recipe.id}: ${error.message}`);
          return null;
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          processedRecipes.push(result.value);
        }
      });
      
      // Small delay between batches to prevent rate limiting
      if (i + batchSize < basicRecipes.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return processedRecipes;
  } catch (error: any) {
    logger.error(`Recipe processing error: ${error.message}`);
    throw new AppError(`Failed to process recipes: ${error.message}`, 500);
  }
};

/**
 * Enhanced recipe suggestions with machine learning approach
 */
export const getRecipeSuggestions = async (
  userId: string,
  limit: number = 5
): Promise<IRecipe[]> => {
  try {
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const user = await User.findById(userId)
      .select('preferences searchHistory favoriteRecipes lastActivity')
      .lean()
      .exec();
      
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Build intelligent query based on user data
    const query: any = {};
    const sortCriteria: any = { popularity: -1, userRating: -1 };
    
    // Apply user preferences
    if (user.preferences) {
      const { favoriteCuisines, dietaryRestrictions, allergies, dislikedIngredients } = user.preferences;
      
      if (favoriteCuisines?.length) {
        query.cuisines = { $in: favoriteCuisines };
        sortCriteria.cuisineMatch = -1; // Prioritize favorite cuisines
      }
      
      if (dietaryRestrictions?.length) {
        query.diets = { $in: dietaryRestrictions };
      }
      
      if (allergies?.length) {
        query['ingredients.name'] = { 
          $not: { 
            $elemMatch: { 
              $in: allergies.map(a => new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
            } 
          } 
        };
      }
      
      if (dislikedIngredients?.length) {
        if (query['ingredients.name']) {
          query['ingredients.name'].$not.$elemMatch.$in.push(
            ...dislikedIngredients.map(ing => new RegExp(ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
          );
        } else {
          query['ingredients.name'] = { 
            $not: { 
              $elemMatch: { 
                $in: dislikedIngredients.map(ing => new RegExp(ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
              } 
            } 
          };
        }
      }
    }
    
    // Exclude already favorited recipes
    if (user.favoriteRecipes?.length) {
      query._id = { $nin: user.favoriteRecipes };
    }
    
    // Get personalized recipes
    const personalizedRecipes = await Recipe.find(query)
      .sort(sortCriteria)
      .limit(limit)
      .lean()
      .exec();
    
    // If not enough personalized recipes, supplement with trending ones
    if (personalizedRecipes.length < limit) {
      const remainingNeeded = limit - personalizedRecipes.length;
      const existingIds = personalizedRecipes.map(r => r._id);
      
      const supplementQuery: any = { 
        _id: { $nin: existingIds }
      };
      
      if (user.favoriteRecipes?.length) {
        supplementQuery._id.$nin.push(...user.favoriteRecipes);
      }
      
      const trendingRecipes = await Recipe.find(supplementQuery)
        .sort({ popularity: -1, userRating: -1, viewCount: -1 })
        .limit(remainingNeeded)
        .lean()
        .exec();
      
      personalizedRecipes.push(...trendingRecipes);
    }
    
    return personalizedRecipes as IRecipe[];
  } catch (error: any) {
    logger.error(`Suggestions error: ${error.message}`, { userId });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(`Failed to get suggestions: ${error.message}`, 500);
  }
};

/**
 * Enhanced trending recipes with time-based analysis - Fixed aggregation pipeline
 */
export const getTrendingRecipes = async (limit: number = 5): Promise<IRecipe[]> => {
  try {
    // Fixed aggregation pipeline with proper typing
    const aggregationPipeline: PipelineStage[] = [
      {
        $addFields: {
          trendingScore: {
            $add: [
              { $multiply: ['$popularity', 0.4] },
              { $multiply: [{ $ifNull: ['$userRating', 0] }, 20] }, // Scale rating to match popularity
              { $multiply: [{ $ifNull: ['$viewCount', 0] }, 0.1] }
            ]
          }
        }
      },
      {
        $match: {
          updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
          trendingScore: { $gt: 0 }
        }
      },
      {
        $sort: { trendingScore: -1 as const, updatedAt: -1 as const } // Fixed with const assertion
      },
      {
        $limit: limit
      }
    ];
    
    const trendingRecipes = await Recipe.aggregate(aggregationPipeline).exec();
    
    return trendingRecipes as IRecipe[];
  } catch (error: any) {
    logger.error(`Trending recipes error: ${error.message}`);
    throw new AppError(`Failed to get trending recipes: ${error.message}`, 500);
  }
};

/**
 * Enhanced recipe rating with validation and analytics
 */
export const rateRecipe = async (
  recipeId: string, 
  userId: string, 
  rating: number
): Promise<IRecipe> => {
  try {
    // Validate inputs
    if (!recipeId || !userId) {
      throw new AppError('Recipe ID and User ID are required', 400);
    }
    
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError('Rating must be an integer between 1 and 5', 400);
    }
    
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }
    
    // Initialize ratings array if not present
    const ratings: RecipeRating[] = recipe.ratings || [];
    
    // Update or add rating
    const existingIndex = ratings.findIndex(r => r.userId === userId);
    
    if (existingIndex >= 0) {
      ratings[existingIndex].rating = rating;
      ratings[existingIndex].date = new Date();
    } else {
      ratings.push({
        userId,
        rating,
        date: new Date()
      });
    }
    
    // Calculate weighted average (recent ratings have more weight)
    const now = Date.now();
    const weightedSum = ratings.reduce((sum, r) => {
      const daysSinceRating = (now - r.date.getTime()) / (1000 * 60 * 60 * 24);
      const weight = Math.max(0.1, 1 - (daysSinceRating / 365)); // Decay over a year
      return sum + (r.rating * weight);
    }, 0);
    
    const totalWeight = ratings.reduce((sum, r) => {
      const daysSinceRating = (now - r.date.getTime()) / (1000 * 60 * 60 * 24);
      const weight = Math.max(0.1, 1 - (daysSinceRating / 365));
      return sum + weight;
    }, 0);
    
    const avgRating = totalWeight > 0 ? weightedSum / totalWeight : 0;
    
    // Update recipe with new rating data
    const updatedRecipe = await Recipe.findByIdAndUpdate(
      recipeId,
      { 
        $set: { 
          ratings,
          userRating: Math.round(avgRating * 100) / 100, // Round to 2 decimal places
          userRatingsCount: ratings.length
        }
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedRecipe) {
      throw new AppError('Failed to update rating', 500);
    }
    
    return updatedRecipe;
  } catch (error: any) {
    logger.error(`Rating error: ${error.message}`, { recipeId, userId, rating });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(`Failed to rate recipe: ${error.message}`, 500);
  }
};

/**
 * Enhanced favorite toggle with analytics
 */
export const toggleFavoriteRecipe = async (
  recipeId: string,
  userId: string
): Promise<{ isFavorite: boolean; favoriteCount: number }> => {
  try {
    if (!recipeId || !userId) {
      throw new AppError('Recipe ID and User ID are required', 400);
    }
    
    // Verify recipe exists
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      throw new AppError('Recipe not found', 404);
    }
    
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    const favorites = user.favoriteRecipes || [];
    const recipeIndex = favorites.findIndex(id => id.toString() === recipeId);
    
    let isFavorite: boolean;
    let favoriteCountChange: number;
    
    if (recipeIndex >= 0) {
      // Remove from favorites
      favorites.splice(recipeIndex, 1);
      isFavorite = false;
      favoriteCountChange = -1;
    } else {
      // Add to favorites
      favorites.push(recipeId);
      isFavorite = true;
      favoriteCountChange = 1;
    }
    
    // Update user and recipe in parallel
    const [, updatedRecipe] = await Promise.all([
      User.findByIdAndUpdate(userId, { favoriteRecipes: favorites }),
      Recipe.findByIdAndUpdate(
        recipeId,
        { $inc: { userFavoriteCount: favoriteCountChange } },
        { new: true }
      )
    ]);
    
    return { 
      isFavorite, 
      favoriteCount: updatedRecipe?.userFavoriteCount || 0 
    };
  } catch (error: any) {
    logger.error(`Favorite toggle error: ${error.message}`, { recipeId, userId });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(`Failed to update favorite: ${error.message}`, 500);
  }
};

/**
 * Enhanced favorite recipes retrieval
 */
export const getFavoriteRecipes = async (userId: string): Promise<IRecipe[]> => {
  try {
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }
    
    const user = await User.findById(userId)
      .populate({
        path: 'favoriteRecipes',
        options: { 
          sort: { userRating: -1, popularity: -1 },
          limit: 50 // Reasonable limit
        }
      })
      .lean()
      .exec();
      
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return (user.favoriteRecipes || []) as unknown as IRecipe[];
  } catch (error: any) {
    logger.error(`Favorites fetch error: ${error.message}`, { userId });
    
    if (error instanceof AppError) {
      throw error;
    }
    
    throw new AppError(`Failed to get favorites: ${error.message}`, 500);
  }
};

/**
 * Enhanced cuisine-based recipe search
 */
export const getRecipesByCuisine = async (
  cuisine: string,
  limit: number = 10,
  offset: number = 0
): Promise<IRecipe[]> => {
  try {
    if (!cuisine?.trim()) {
      throw new AppError('Cuisine parameter is required', 400);
    }
    
    const normalizedCuisine = cuisine.trim().toLowerCase();
    const sanitizedLimit = Math.min(Math.max(1, limit), 50); // Limit between 1-50
    const sanitizedOffset = Math.max(0, offset);
    
    // Enhanced cache search with better matching
    const cachedRecipes = await Recipe.find({
      cuisines: { $regex: new RegExp(normalizedCuisine, 'i') }
    })
      .sort({ popularity: -1, userRating: -1 })
      .skip(sanitizedOffset)
      .limit(sanitizedLimit)
      .lean()
      .exec();

    if (cachedRecipes.length >= sanitizedLimit) {
      return cachedRecipes as IRecipe[];
    }

    // Fetch from API with enhanced parameters
    const response = await spoonacularApi.get('/recipes/complexSearch', {
      params: {
        cuisine: cuisine,
        number: sanitizedLimit,
        offset: sanitizedOffset,
        addRecipeInformation: true,
        fillIngredients: true,
        addRecipeNutrition: true,
        sort: 'popularity',
        sortDirection: 'desc'
      }
    });

    if (!response.data?.results?.length) {
      return cachedRecipes as IRecipe[];
    }

    // Process new recipes efficiently
    const newRecipes = await Promise.allSettled(
      response.data.results.map((recipe: any) => saveRecipeToDatabase(recipe))
    );
    
    const successfulRecipes = newRecipes
      .filter((result): result is PromiseFulfilledResult<IRecipe> => result.status === 'fulfilled')
      .map(result => result.value);
    
    // Combine and deduplicate results
    const cachedIds = new Set(cachedRecipes.map(r => r.externalId));
    const uniqueNewRecipes = successfulRecipes.filter(r => !cachedIds.has(r.externalId));
    
    return [...cachedRecipes, ...uniqueNewRecipes].slice(0, sanitizedLimit) as IRecipe[];
  } catch (error) {
    return handleApiError(error);
  }
};

// Export all enhanced functions
export default {
  searchRecipesByIngredients,
  getRecipeDetails,
  processRecipesForResponse,
  getRecipeSuggestions,
  getTrendingRecipes,
  rateRecipe,
  toggleFavoriteRecipe,
  getFavoriteRecipes,
  getRecipesByCuisine,
  enhanceRecipesWithAI,
  saveRecipeToDatabase
};
