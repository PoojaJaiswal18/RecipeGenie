import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import recipesApi from '../../api/recipes';

export interface Ingredient {
  id: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  summary: string;
  instructions: string;
  missedIngredientCount: number;
  usedIngredientCount: number;
  likes: number;
  healthScore: number;
  cuisines: string[];
  dishTypes: string[];
  diets: string[];
  usedIngredients: Ingredient[];
  missedIngredients: Ingredient[];
}

interface RecipeState {
  recipes: Recipe[];
  filteredRecipes: Recipe[];
  currentRecipe: Recipe | null;
  ingredients: string[];
  loading: boolean;
  error: string | null;
  favoriteRecipes: string[];
  filters: {
    maxPrepTime: number | null;
    cuisineType: string | null;
    dietaryRestrictions: string[];
    minHealthScore: number | null;
  };
}

const initialState: RecipeState = {
  recipes: [],
  filteredRecipes: [],
  currentRecipe: null,
  ingredients: [],
  loading: false,
  error: null,
  favoriteRecipes: [],
  filters: {
    maxPrepTime: null,
    cuisineType: null,
    dietaryRestrictions: [],
    minHealthScore: null,
  },
};

// Async thunks
export const searchRecipesByIngredients = createAsyncThunk(
  'recipes/searchByIngredients',
  async (ingredients: string[], { rejectWithValue }) => {
    try {
      const response = await recipesApi.searchByIngredients(ingredients);
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unknown error occurred');
    }
  }
);

export const getRecipeDetails = createAsyncThunk(
  'recipes/getDetails',
  async (recipeId: string, { rejectWithValue }) => {
    try {
      const response = await recipesApi.getRecipeById(recipeId);
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unknown error occurred');
    }
  }
);

export const toggleFavoriteRecipe = createAsyncThunk(
  'recipes/toggleFavorite',
  async (recipeId: string, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { recipes: RecipeState };
      const isFavorited = state.recipes.favoriteRecipes.includes(recipeId);
      
      if (isFavorited) {
        await recipesApi.removeFromFavorites(recipeId);
      } else {
        await recipesApi.addToFavorites(recipeId);
      }
      
      return { recipeId, isFavorited };
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unknown error occurred');
    }
  }
);

export const getFavoriteRecipes = createAsyncThunk(
  'recipes/getFavorites',
  async (_, { rejectWithValue }) => {
    try {
      const response = await recipesApi.getFavorites();
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unknown error occurred');
    }
  }
);

const recipeSlice = createSlice({
  name: 'recipes',
  initialState,
  reducers: {
    addIngredient: (state, action: PayloadAction<string>) => {
      if (!state.ingredients.includes(action.payload)) {
        state.ingredients.push(action.payload);
      }
    },
    removeIngredient: (state, action: PayloadAction<string>) => {
      state.ingredients = state.ingredients.filter(ing => ing !== action.payload);
    },
    clearIngredients: (state) => {
      state.ingredients = [];
    },
    setFilters: (state, action: PayloadAction<Partial<RecipeState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      
      // Apply filters to recipes
      state.filteredRecipes = state.recipes.filter(recipe => {
        let passes = true;
        
        if (state.filters.maxPrepTime && recipe.readyInMinutes > state.filters.maxPrepTime) {
          passes = false;
        }
        
        if (state.filters.cuisineType && !recipe.cuisines.includes(state.filters.cuisineType)) {
          passes = false;
        }
        
        if (state.filters.dietaryRestrictions.length > 0) {
          const hasAllDiets = state.filters.dietaryRestrictions.every(diet => 
            recipe.diets.includes(diet)
          );
          if (!hasAllDiets) passes = false;
        }
        
        if (state.filters.minHealthScore && recipe.healthScore < state.filters.minHealthScore) {
          passes = false;
        }
        
        return passes;
      });
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.filteredRecipes = state.recipes;
    },
    setCurrentRecipe: (state, action: PayloadAction<Recipe>) => {
      state.currentRecipe = action.payload;
    },
    clearCurrentRecipe: (state) => {
      state.currentRecipe = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Search by ingredients
      .addCase(searchRecipesByIngredients.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchRecipesByIngredients.fulfilled, (state, action: PayloadAction<Recipe[]>) => {
        state.loading = false;
        state.recipes = action.payload;
        state.filteredRecipes = action.payload;
      })
      .addCase(searchRecipesByIngredients.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Get recipe details
      .addCase(getRecipeDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getRecipeDetails.fulfilled, (state, action: PayloadAction<Recipe>) => {
        state.loading = false;
        state.currentRecipe = action.payload;
      })
      .addCase(getRecipeDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Toggle favorite recipe
      .addCase(toggleFavoriteRecipe.fulfilled, (state, action) => {
        const { recipeId, isFavorited } = action.payload;
        if (isFavorited) {
          // Remove from favorites
          state.favoriteRecipes = state.favoriteRecipes.filter(id => id !== recipeId);
        } else {
          // Add to favorites
          state.favoriteRecipes.push(recipeId);
        }
      })
      
      // Get favorite recipes
      .addCase(getFavoriteRecipes.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.favoriteRecipes = action.payload;
      });
  },
});

export const { 
  addIngredient, 
  removeIngredient, 
  clearIngredients,
  setFilters,
  clearFilters,
  setCurrentRecipe,
  clearCurrentRecipe
} = recipeSlice.actions;

export default recipeSlice.reducer;