import api from '../api';

export interface Ingredient {
  id: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  image: string;
  missedIngredientCount?: number;
  usedIngredientCount?: number;
  missedIngredients?: Ingredient[];
  usedIngredients?: Ingredient[];
  readyInMinutes: number;
  servings: number;
  instructions?: string;
  summary?: string;
  sourceUrl?: string;
  healthScore?: number;
  isFavorite?: boolean;
}

export interface RecipeSearchParams {
  ingredients: string[];
  diet?: string;
  intolerances?: string[];
  limit?: number;
}

const recipeApi = {
  // Original method
  searchByIngredients: async (params: RecipeSearchParams): Promise<Recipe[]> => {
    const response = await api.post('/recipes/search', params);
    return response.data.recipes;
  },

  // New method
  searchRecipes: async (query: string, filters?: Record<string, any>): Promise<Recipe[]> => {
    const response = await api.get('/recipes/search', {
      params: {
        query,
        ...filters
      }
    });
    return response.data.results;
  },

  getRecipeById: async (id: string): Promise<Recipe> => {
    const response = await api.get(`/recipes/${id}`);
    return response.data.recipe || response.data;  // supports both response formats
  },

  // Original
  getFavorites: async (): Promise<Recipe[]> => {
    const response = await api.get('/recipes/favorites');
    return response.data.recipes;
  },

  // New alias
  getFavoriteRecipes: async (): Promise<Recipe[]> => {
    const response = await api.get('/recipes/favorites');
    return response.data.recipes || response.data;
  },

  // New method
  getRecentRecipes: async (): Promise<Recipe[]> => {
    const response = await api.get('/recipes/recent');
    return response.data;
  },

  // Original
  toggleFavorite: async (recipeId: string): Promise<{ isFavorite: boolean }> => {
    const response = await api.post(`/recipes/${recipeId}/favorite`);
    return response.data;
  },

  // New methods
  addToFavorites: async (recipeId: string): Promise<void> => {
    await api.post('/recipes/favorites', { recipeId });
  },

  removeFromFavorites: async (recipeId: string): Promise<void> => {
    await api.delete(`/recipes/favorites/${recipeId}`);
  },

  // Original
  getUserPreferences: async () => {
    const response = await api.get('/user/preferences');
    return response.data.preferences;
  },

  updateUserPreferences: async (preferences: any) => {
    const response = await api.put('/user/preferences', { preferences });
    return response.data;
  }
};

export default recipeApi;