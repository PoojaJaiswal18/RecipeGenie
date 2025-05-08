import express from 'express';
import { 
  searchRecipes,
  getRecipeById,
  getSuggestions,
  getTrending,
  rateRecipeHandler,
  toggleFavorite,
  getFavorites,
  getRecipesByCuisine,
  getRecipesByDiet,
  getRecipesByCategory,
  addCustomRecipe,
  updateCustomRecipe,
  deleteCustomRecipe,
  addRecipeToMealPlan,
  getMealPlan,
  generateWeeklyMealPlan
} from '../controllers/recipeController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Public routes (no authentication required)
router.get('/search', searchRecipes);
router.get('/trending', getTrending);
router.get('/cuisine/:cuisine', getRecipesByCuisine);
router.get('/diet/:diet', getRecipesByDiet);
router.get('/category/:category', getRecipesByCategory);
router.get('/:id', getRecipeById);

// Protected routes (authentication required)
router.use(protect); // Apply authentication middleware to all routes below

// Personalized suggestions
router.get('/suggestions', getSuggestions);

// Favorites management
router.get('/user/favorites', getFavorites);
router.post('/:id/favorite', toggleFavorite);

// Rating system
router.post('/:id/rate', rateRecipeHandler);

// Custom recipe management
router.post('/custom', addCustomRecipe);
router.put('/custom/:id', updateCustomRecipe);
router.delete('/custom/:id', deleteCustomRecipe);

// Meal planning features
router.get('/user/mealplan', getMealPlan);
router.post('/user/mealplan', addRecipeToMealPlan);
router.post('/user/mealplan/generate', generateWeeklyMealPlan);

export default router;