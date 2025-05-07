// client/src/pages/Home.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import IngredientInput from '../components/recipe/IngredientInput';
import RecipeList from '../components/recipe/RecipeList';
import recipeApi, { Recipe, RecipeSearchParams } from '../api/recipes';
import authApi from '../api/auth';
import { HiOutlineLightBulb, HiOutlineCube } from 'react-icons/hi';

const Home: React.FC = () => {
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useState<RecipeSearchParams>({
    ingredients: [],
    limit: 12
  });
  const isAuthenticated = authApi.isAuthenticated();
  const [userPreferences, setUserPreferences] = useState<{
    diet?: string;
    intolerances?: string[];
  }>({});

  // Load user preferences if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const fetchUserPreferences = async () => {
        try {
          const preferences = await recipeApi.getUserPreferences();
          setUserPreferences(preferences);
          
          // Update search params with user preferences
          setSearchParams(prevParams => ({
            ...prevParams,
            diet: preferences.diet,
            intolerances: preferences.intolerances
          }));
        } catch (error) {
          console.error('Error fetching user preferences:', error);
        }
      };
      
      fetchUserPreferences();
    }
  }, [isAuthenticated]);

  const handleIngredientsChange = useCallback((newIngredients: string[]) => {
    setIngredients(newIngredients);
    setSearchParams(prevParams => ({
      ...prevParams,
      ingredients: newIngredients
    }));
  }, []);

  const handleFindRecipes = async () => {
    if (ingredients.length === 0) {
      toast.warning('Please add at least one ingredient');
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const recipes = await recipeApi.searchByIngredients(searchParams);
      setRecipes(recipes);
    } catch (error) {
      console.error('Error searching recipes:', error);
      toast.error('Failed to search recipes. Please try again.');
      setRecipes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFavoriteToggle = async (recipeId: string) => {
    if (!isAuthenticated) {
      toast.info('Please log in to save favorites');
      return Promise.reject('Not authenticated');
    }
    
    try {
      await recipeApi.toggleFavorite(recipeId);
      return Promise.resolve();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
      return Promise.reject(error);
    }
  };

  return (
    <>
      <section className="bg-gradient-to-b from-teal-500 to-teal-600 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Turn Your Ingredients Into Delicious Meals
            </h1>
            <p className="text-lg md:text-xl opacity-90 mb-8">
              Enter the ingredients you have, and let Recipe Genie find perfect recipes for you.
            </p>
            
            <div className="bg-white rounded-xl shadow-lg p-6">
              <IngredientInput 
                onIngredientsChange={handleIngredientsChange}
                initialIngredients={ingredients}
              />
              
              <div className="mt-6">
                <button
                  onClick={handleFindRecipes}
                  disabled={isLoading || ingredients.length === 0}
                  className={`w-full py-3 rounded-lg font-medium text-lg transition-colors flex items-center justify-center ${
                    ingredients.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-teal-600 hover:bg-teal-700 text-white'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <span className="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full"></span>
                      Finding Recipes...
                    </>
                  ) : (
                    'Find Recipes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {(hasSearched || recipes.length > 0) && (
        <section className="py-12 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              {recipes.length === 0 ? 'No Matching Recipes Found' : 'Recipes for You'}
            </h2>
            
            <RecipeList 
              recipes={recipes} 
              isLoading={isLoading} 
              onFavoriteToggle={handleFavoriteToggle} 
            />
          </div>
        </section>
      )}

      {!hasSearched && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-10 text-center">
              Why Use Recipe Genie?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-teal-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center text-teal-600 mb-4">
                  {HiOutlineLightBulb({ className: "w-8 h-8" })}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Reduce Food Waste
                </h3>
                <p className="text-gray-600">
                  Use up ingredients you already have at home instead of letting them go to waste.
                </p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-teal-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center text-teal-600 mb-4">
                  {HiOutlineCube({ className: "w-8 h-8" })}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Personalized Results
                </h3>
                <p className="text-gray-600">
                  Our AI analyzes your preferences and cooking history to suggest recipes you'll love.
                </p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="bg-teal-100 w-16 h-16 mx-auto rounded-full flex items-center justify-center text-teal-600 mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-3">
                  Save Time
                </h3>
                <p className="text-gray-600">
                  Quickly find recipes based on what you have instead of making extra trips to the store.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default Home;