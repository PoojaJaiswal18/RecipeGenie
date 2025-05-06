import { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/store';
import { searchRecipesByIngredients, setFilters, Recipe } from '../redux/slices/recipeSlice';
import useDebounce from './useDebounce';

interface UseRecipeSearchResult {
  recipes: Recipe[];
  filteredRecipes: Recipe[];
  loading: boolean;
  error: string | null;
  ingredients: string[];
  search: (ingredients: string[]) => void;
  addIngredient: (ingredient: string) => void;
  removeIngredient: (ingredient: string) => void;
  applyFilters: (filters: any) => void;
  resetFilters: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchResults: Recipe[];
}

/**
 * A custom hook that manages recipe search functionality including
 * ingredients management, search operations, and search result filtering.
 * 
 * @returns Object containing search state and functions
 */
export function useRecipeSearch(): UseRecipeSearchResult {
  const dispatch = useAppDispatch();
  const { 
    recipes, 
    filteredRecipes, 
    ingredients, 
    loading, 
    error 
  } = useAppSelector(state => state.recipes);
  
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [searchResults, setSearchResults] = useState<Recipe[]>([]);

  // Function to search recipes by ingredients
  const search = useCallback((ingredientList: string[]) => {
    dispatch(searchRecipesByIngredients(ingredientList));
  }, [dispatch]);

  // Function to add an ingredient
  const addIngredient = useCallback((ingredient: string) => {
    const updatedIngredients = [...ingredients, ingredient];
    search(updatedIngredients);
  }, [ingredients, search]);

  // Function to remove an ingredient
  const removeIngredient = useCallback((ingredient: string) => {
    const updatedIngredients = ingredients.filter(ing => ing !== ingredient);
    search(updatedIngredients);
  }, [ingredients, search]);

  // Function to apply filters
  const applyFilters = useCallback((filters: any) => {
    dispatch(setFilters(filters));
  }, [dispatch]);

  // Function to reset filters
  const resetFilters = useCallback(() => {
    dispatch(setFilters({
      maxPrepTime: null,
      cuisineType: null,
      dietaryRestrictions: [],
      minHealthScore: null,
    }));
  }, [dispatch]);

  // Effect for filtering recipes based on search term
  useEffect(() => {
    if (debouncedSearchTerm.trim() === '') {
      setSearchResults(filteredRecipes);
      return;
    }

    const searchTermLower = debouncedSearchTerm.toLowerCase();
    const results = filteredRecipes.filter(recipe => {
      // Search in title
      if (recipe.title.toLowerCase().includes(searchTermLower)) {
        return true;
      }
      
      // Search in cuisines
      if (recipe.cuisines?.some(cuisine => 
        cuisine.toLowerCase().includes(searchTermLower)
      )) {
        return true;
      }
      
      // Search in diets
      if (recipe.diets?.some(diet => 
        diet.toLowerCase().includes(searchTermLower)
      )) {
        return true;
      }
      
      // Search in dish types
      if (recipe.dishTypes?.some(type => 
        type.toLowerCase().includes(searchTermLower)
      )) {
        return true;
      }
      
      return false;
    });
    
    setSearchResults(results);
  }, [debouncedSearchTerm, filteredRecipes]);

  return {
    recipes,
    filteredRecipes,
    loading,
    error,
    ingredients,
    search,
    addIngredient,
    removeIngredient,
    applyFilters,
    resetFilters,
    searchTerm,
    setSearchTerm,
    searchResults
  };
}

export default useRecipeSearch;