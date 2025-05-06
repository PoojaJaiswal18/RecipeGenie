import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { searchRecipesByIngredients, addIngredient, removeIngredient, clearIngredients } from '../../redux/slices/recipeSlice';
import { useDebounce } from '../../hooks/useDebounce';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchEngineProps {
  className?: string;
}

const SearchEngine: React.FC<SearchEngineProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const { ingredients, loading } = useAppSelector(state => state.recipes);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const debouncedInput = useDebounce(inputValue, 300);

  // Common ingredient suggestions based on input
  useEffect(() => {
    if (debouncedInput.length > 1) {
      // This would ideally be an API call to get ingredient suggestions
      // But for now we'll use a static list filtered by input
      const commonIngredients = [
        'chicken', 'beef', 'pork', 'tofu', 'rice', 'pasta', 'potato',
        'tomato', 'onion', 'garlic', 'bell pepper', 'carrot', 'broccoli',
        'spinach', 'lettuce', 'cucumber', 'cheese', 'milk', 'yogurt',
        'butter', 'olive oil', 'eggs', 'bread', 'flour', 'sugar', 'salt',
        'black pepper', 'oregano', 'basil', 'thyme', 'rosemary', 'cumin',
        'cinnamon', 'paprika', 'lemon', 'lime', 'apple', 'banana', 'orange'
      ];
      
      const filtered = commonIngredients
        .filter(ing => ing.toLowerCase().includes(debouncedInput.toLowerCase()))
        .filter(ing => !ingredients.includes(ing))
        .slice(0, 5);
      
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [debouncedInput, ingredients]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setError(null);
  };

  const handleAddIngredient = (ingredient: string = inputValue.trim()) => {
    if (!ingredient) {
      setError('Please enter an ingredient');
      return;
    }
    
    if (ingredients.includes(ingredient)) {
      setError('This ingredient is already in your list');
      return;
    }
    
    dispatch(addIngredient(ingredient));
    setInputValue('');
    setError(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddIngredient();
    }
  };

  const handleRemoveIngredient = (ingredient: string) => {
    dispatch(removeIngredient(ingredient));
  };

  const handleClearIngredients = () => {
    dispatch(clearIngredients());
  };

  const handleSearch = () => {
    if (ingredients.length === 0) {
      setError('Please add at least one ingredient');
      return;
    }
    
    dispatch(searchRecipesByIngredients(ingredients));
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Find Recipes With What You Have</h2>
        
        {/* Input row */}
        <div className="flex flex-wrap md:flex-nowrap gap-2 mb-4">
          <div className="relative w-full">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Enter an ingredient..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              data-testid="ingredient-input"
            />
            
            {/* Suggestions dropdown */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
                >
                  {suggestions.map((suggestion) => (
                    <div
                      key={suggestion}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleAddIngredient(suggestion)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <button
            onClick={() => handleAddIngredient()}
            className="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
            disabled={loading}
          >
            Add
          </button>
        </div>
        
        {/* Error message */}
        {error && (
          <p className="text-red-500 mb-3 text-sm">{error}</p>
        )}
        
        {/* Ingredient pills */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-2">
            <AnimatePresence>
              {ingredients.map((ingredient) => (
                <motion.div
                  key={ingredient}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full"
                >
                  <span className="mr-1">{ingredient}</span>
                  <button
                    onClick={() => handleRemoveIngredient(ingredient)}
                    className="ml-1 focus:outline-none"
                    aria-label={`Remove ${ingredient}`}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className="h-4 w-4" 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {ingredients.length > 0 && (
            <button
              onClick={handleClearIngredients}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
        </div>
        
        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={ingredients.length === 0 || loading}
          className={`w-full py-3 font-semibold rounded-lg transition-all ${
            ingredients.length === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700 shadow-md hover:shadow-lg'
          }`}
          data-testid="search-button"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Finding Recipes...
            </div>
          ) : (
            `Find Recipes (${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''})`
          )}
        </button>
      </div>
    </div>
  );
};

export default SearchEngine;