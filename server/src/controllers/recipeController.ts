import { Request, Response, NextFunction } from 'express';
import { 
  searchRecipesByIngredients,
  getRecipeDetails,
  processRecipesForResponse,
  getRecipeSuggestions,
  getTrendingRecipes,
  rateRecipe,
  toggleFavoriteRecipe,
  getFavoriteRecipes,
  saveRecipeToDatabase,
  enhanceRecipesWithAI
} from '../services/recipeService';
import { AppError } from '../middleware/error';
import { IUser } from '../models/User';
import Recipe from '../models/Recipe';
import winston from 'winston';
import mongoose from 'mongoose';

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

/**
 * Search recipes by ingredients
 * @route GET /api/recipes/search
 */
export const searchRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ingredients, cuisine, diet, intolerances, type, number = "10" } = req.query;
    
    // Validate ingredients input
    if (!ingredients) {
      return next(new AppError('Ingredients are required', 400));
    }
    
    // Parse ingredients from query
    const ingredientsList = Array.isArray(ingredients) 
      ? ingredients.map(String)
      : String(ingredients).split(',');
    
    // Performance logging start
    const startTime = Date.now();
    logger.debug(`Starting recipe search for ingredients: ${ingredientsList.join(', ')}`);
    
    // Search for basic recipes
    const basicRecipes = await searchRecipesByIngredients({
      ingredients: ingredientsList,
      cuisine: cuisine?.toString(),
      diet: diet?.toString(),
      intolerances: intolerances?.toString(),
      type: type?.toString(),
      number: parseInt(number.toString(), 10)
    });
    
    // Process recipes with detailed info and personalization
    const user = req.user as IUser | undefined;
    const processedRecipes = await processRecipesForResponse(basicRecipes, user);
    
    // Performance logging end
    const endTime = Date.now();
    logger.debug(`Recipe search completed in ${endTime - startTime}ms`);
    
    // Return the response
    return res.status(200).json({
      status: 'success',
      results: processedRecipes.length,
      data: {
        recipes: processedRecipes
      }
    });
  } catch (error) {
    logger.error('Error in searchRecipes:', error);
    return next(error);
  }
};

/**
 * Get a recipe by ID
 * @route GET /api/recipes/:id
 */
export const getRecipeById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    
    // Check if this is an internal ID or external ID
    let recipe;
    
    // If it's MongoDB ObjectId format
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      recipe = await Recipe.findById(id);
    } else {
      // Try to get by external ID
      const externalId = parseInt(id, 10);
      
      if (isNaN(externalId)) {
        return next(new AppError('Invalid recipe ID format', 400));
      }
      
      recipe = await getRecipeDetails(externalId);
    }
    
    if (!recipe) {
      return next(new AppError('Recipe not found', 404));
    }
    
    // Update view count if it's a MongoDB document
    if (recipe.updateOne) {
      await recipe.updateOne({ $inc: { viewCount: 1 } });
    }
    
    // Track user view if authenticated
    const user = req.user as IUser | undefined;
    if (user && recipe._id) {
      // Add to user's recently viewed (this would be implemented in userService)
      // await addToRecentlyViewed(user._id, recipe._id);
    }
    
    return res.status(200).json({
      status: 'success',
      data: {
        recipe
      }
    });
  } catch (error) {
    logger.error('Error in getRecipeById:', error);
    return next(error);
  }
};

/**
 * Get recipe suggestions for a user
 * @route GET /api/recipes/suggestions
 */
export const getSuggestions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 5;
    const suggestions = await getRecipeSuggestions(user, limit);
    
    return res.status(200).json({
      status: 'success',
      results: suggestions.length,
      data: {
        recipes: suggestions
      }
    });
  } catch (error) {
    logger.error('Error in getSuggestions:', error);
    return next(error);
  }
};

/**
 * Get trending recipes
 * @route GET /api/recipes/trending
 */
export const getTrending = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 5;
    const trending = await getTrendingRecipes(limit);
    
    return res.status(200).json({
      status: 'success',
      results: trending.length,
      data: {
        recipes: trending
      }
    });
  } catch (error) {
    logger.error('Error in getTrending:', error);
    return next(error);
  }
};

/**
 * Rate a recipe
 * @route POST /api/recipes/:id/rate
 */
export const rateRecipeHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return next(new AppError('Rating is required and must be a number between 1 and 5', 400));
    }
    
    const updatedRecipe = await rateRecipe(id, user._id.toString(), rating);
    
    return res.status(200).json({
      status: 'success',
      data: {
        recipe: updatedRecipe
      }
    });
  } catch (error) {
    logger.error('Error in rateRecipeHandler:', error);
    return next(error);
  }
};

/**
 * Toggle favorite recipe
 * @route POST /api/recipes/:id/favorite
 */
export const toggleFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const result = await toggleFavoriteRecipe(id, user._id.toString());
    
    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error in toggleFavorite:', error);
    return next(error);
  }
};

/**
 * Get user favorite recipes
 * @route GET /api/recipes/favorites
 */
export const getFavorites = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const favorites = await getFavoriteRecipes(user._id.toString());
    
    return res.status(200).json({
      status: 'success',
      results: favorites.length,
      data: {
        recipes: favorites
      }
    });
  } catch (error) {
    logger.error('Error in getFavorites:', error);
    return next(error);
  }
};

/**
 * Get recipe by cuisine
 * @route GET /api/recipes/cuisine/:cuisine
 */
export const getRecipesByCuisine = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { cuisine } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 10;
    const page = req.query.page ? parseInt(req.query.page.toString(), 10) : 1;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Recipe.countDocuments({
      cuisines: { $regex: new RegExp(cuisine, 'i') }
    });
    
    // Get recipes
    const recipes = await Recipe.find({
      cuisines: { $regex: new RegExp(cuisine, 'i') }
    })
    .sort({ popularity: -1 })
    .skip(skip)
    .limit(limit);
    
    return res.status(200).json({
      status: 'success',
      results: recipes.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: {
        recipes
      }
    });
  } catch (error) {
    logger.error('Error in getRecipesByCuisine:', error);
    return next(error);
  }
};

/**
 * Get recipes by diet
 * @route GET /api/recipes/diet/:diet
 */
export const getRecipesByDiet = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { diet } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 10;
    const page = req.query.page ? parseInt(req.query.page.toString(), 10) : 1;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Recipe.countDocuments({
      diets: { $regex: new RegExp(diet, 'i') }
    });
    
    // Get recipes
    const recipes = await Recipe.find({
      diets: { $regex: new RegExp(diet, 'i') }
    })
    .sort({ popularity: -1 })
    .skip(skip)
    .limit(limit);
    
    return res.status(200).json({
      status: 'success',
      results: recipes.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: {
        recipes: recipes
      }
    });
  } catch (error) {
    logger.error('Error in getRecipesByDiet:', error);
    return next(error);
  }
};

/**
 * Get recipes by category
 * @route GET /api/recipes/category/:category
 */
export const getRecipesByCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { category } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit.toString(), 10) : 10;
    const page = req.query.page ? parseInt(req.query.page.toString(), 10) : 1;
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const total = await Recipe.countDocuments({
      dishTypes: { $regex: new RegExp(category, 'i') }
    });
    
    // Get recipes
    const recipes = await Recipe.find({
      dishTypes: { $regex: new RegExp(category, 'i') }
    })
    .sort({ popularity: -1 })
    .skip(skip)
    .limit(limit);
    
    return res.status(200).json({
      status: 'success',
      results: recipes.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit
      },
      data: {
        recipes: recipes
      }
    });
  } catch (error) {
    logger.error('Error in getRecipesByCategory:', error);
    return next(error);
  }
};

/**
 * Add a custom recipe
 * @route POST /api/recipes/custom
 */
export const addCustomRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const {
      title,
      image,
      ingredients,
      instructions,
      cookTime,
      prepTime,
      servings,
      cuisines,
      diets,
      mealType,
      notes
    } = req.body;
    
    // Validate required fields
    if (!title || !ingredients || !instructions) {
      return next(new AppError('Title, ingredients, and instructions are required', 400));
    }
    
    // Create a new recipe document
    const recipe = new Recipe({
      title,
      image,
      ingredients,
      instructions,
      cookTime,
      prepTime,
      servings,
      cuisines,
      diets,
      dishTypes: mealType ? [mealType] : [],
      notes,
      userId: user._id,
      isCustom: true
    });
    
    await recipe.save();
    
    return res.status(201).json({
      status: 'success',
      data: {
        recipe
      }
    });
  } catch (error) {
    logger.error('Error in addCustomRecipe:', error);
    return next(error);
  }
};

/**
 * Update a custom recipe
 * @route PUT /api/recipes/custom/:id
 */
export const updateCustomRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    // First check if recipe exists and belongs to user
    const existingRecipe = await Recipe.findById(id);
    
    if (!existingRecipe) {
      return next(new AppError('Recipe not found', 404));
    }
    
    if (existingRecipe.userId?.toString() !== user._id.toString()) {
      return next(new AppError('Not authorized to update this recipe', 403));
    }
    
    // Update the recipe
    const updatedRecipe = await Recipe.findByIdAndUpdate(
      id,
      { ...req.body, userId: user._id },
      { new: true, runValidators: true }
    );
    
    return res.status(200).json({
      status: 'success',
      data: {
        recipe: updatedRecipe
      }
    });
  } catch (error) {
    logger.error('Error in updateCustomRecipe:', error);
    return next(error);
  }
};

/**
 * Delete a custom recipe
 * @route DELETE /api/recipes/custom/:id
 */
export const deleteCustomRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    // First check if recipe exists and belongs to user
    const existingRecipe = await Recipe.findById(id);
    
    if (!existingRecipe) {
      return next(new AppError('Recipe not found', 404));
    }
    
    if (existingRecipe.userId?.toString() !== user._id.toString()) {
      return next(new AppError('Not authorized to delete this recipe', 403));
    }
    
    await Recipe.findByIdAndDelete(id);
    
    return res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    logger.error('Error in deleteCustomRecipe:', error);
    return next(error);
  }
};

/**
 * Add recipe to meal plan
 * @route POST /api/recipes/user/mealplan
 */
export const addRecipeToMealPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const { recipeId, day, mealType } = req.body;
    
    if (!recipeId || !day || !mealType) {
      return next(new AppError('Recipe ID, day, and meal type are required', 400));
    }
    
    // Update user's meal plan (implementation would depend on your User model structure)
    const mealPlanEntry = {
      recipeId: new mongoose.Types.ObjectId(recipeId),
      day,
      mealType
    };
    
    // This assumes your User model has a mealPlan field that's an array
    await user.updateOne({
      $push: { mealPlan: mealPlanEntry }
    });
    
    // Fetch updated user with meal plan
    const updatedUser = await mongoose.model('User').findById(user._id).populate({
      path: 'mealPlan.recipeId',
      model: 'Recipe'
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        mealPlan: updatedUser?.mealPlan || []
      }
    });
  } catch (error) {
    logger.error('Error in addRecipeToMealPlan:', error);
    return next(error);
  }
};

/**
 * Get user meal plan
 * @route GET /api/recipes/user/mealplan
 */
export const getMealPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    // Fetch user with populated meal plan
    const userWithMealPlan = await mongoose.model('User').findById(user._id).populate({
      path: 'mealPlan.recipeId',
      model: 'Recipe'
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        mealPlan: userWithMealPlan?.mealPlan || []
      }
    });
  } catch (error) {
    logger.error('Error in getMealPlan:', error);
    return next(error);
  }
};

/**
 * Generate weekly meal plan
 * @route POST /api/recipes/user/mealplan/generate
 */
export const generateWeeklyMealPlan = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    const { preferences } = req.body;
    
    // Generate meal plan based on user preferences
    // This would be implemented according to your business logic
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const mealTypes = ['breakfast', 'lunch', 'dinner'];
    
    // Example implementation:
    // 1. Get suitable recipes based on preferences
    const dietPreference = preferences?.diet || user.preferences?.dietaryRestrictions?.[0];
    const cuisinePreference = preferences?.cuisine || user.preferences?.favoriteCuisines?.[0];
    
    // Find recipes matching preferences
    const matchingRecipes = await Recipe.find({
      ...(dietPreference ? { diets: { $regex: new RegExp(dietPreference, 'i') } } : {}),
      ...(cuisinePreference ? { cuisines: { $regex: new RegExp(cuisinePreference, 'i') } } : {})
    }).limit(21); // 3 meals x 7 days
    
    if (matchingRecipes.length < 7) {
      return next(new AppError('Not enough recipes found to create a meal plan', 400));
    }
    
    // 2. Create a meal plan structure
    const mealPlan = [];
    let recipeIndex = 0;
    
    for (const day of days) {
      for (const mealType of mealTypes) {
        if (recipeIndex < matchingRecipes.length) {
          mealPlan.push({
            recipeId: matchingRecipes[recipeIndex]._id,
            day,
            mealType
          });
          recipeIndex++;
        }
      }
    }
    
    // 3. Update user's meal plan
    await mongoose.model('User').findByIdAndUpdate(user._id, {
      $set: { mealPlan }
    });
    
    // 4. Return the populated meal plan
    const updatedUser = await mongoose.model('User').findById(user._id).populate({
      path: 'mealPlan.recipeId',
      model: 'Recipe'
    });
    
    return res.status(200).json({
      status: 'success',
      data: {
        mealPlan: updatedUser?.mealPlan || []
      }
    });
  } catch (error) {
    logger.error('Error in generateWeeklyMealPlan:', error);
    return next(error);
  }
};