import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../redux/store';
import { setFilters, clearFilters } from '../../redux/slices/recipeSlice';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface RecipeFiltersProps {
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

const RecipeFilters: React.FC<RecipeFiltersProps> = ({ 
  className, 
  isOpen,
  onClose
}) => {
  const dispatch = useAppDispatch();
  const currentFilters = useAppSelector(state => state.recipes.filters);
  
  // Local state for form handling
  const [maxPrepTime, setMaxPrepTime] = useState<number | null>(currentFilters.maxPrepTime);
  const [cuisineType, setCuisineType] = useState<string | null>(currentFilters.cuisineType);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>(
    currentFilters.dietaryRestrictions || []
  );
  const [minHealthScore, setMinHealthScore] = useState<number | null>(currentFilters.minHealthScore);

  // Available options
  const cuisineOptions = [
    'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 
    'Thai', 'Mediterranean', 'French', 'American', 'Middle Eastern'
  ];
  
  const dietOptions = [
    'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 
    'keto', 'paleo', 'low-carb', 'low-fat'
  ];

  // Handle checkbox changes for diet restrictions
  const handleDietChange = (diet: string) => {
    if (dietaryRestrictions.includes(diet)) {
      setDietaryRestrictions(dietaryRestrictions.filter(d => d !== diet));
    } else {
      setDietaryRestrictions([...dietaryRestrictions, diet]);
    }
  };

  // Apply filters
  const handleApplyFilters = () => {
    dispatch(setFilters({
      maxPrepTime,
      cuisineType,
      dietaryRestrictions,
      minHealthScore
    }));
    onClose();
  };

  // Reset filters
  const handleResetFilters = () => {
    setMaxPrepTime(null);
    setCuisineType(null);
    setDietaryRestrictions([]);
    setMinHealthScore(null);
    dispatch(clearFilters());
    onClose();
  };

  return (
    <Transition show={isOpen} as={React.Fragment}>
      <Dialog 
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
        onClose={onClose}
      >
        <div className="min-h-screen px-4 flex items-center justify-center">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-30 transition-opacity" />
          </Transition.Child>

          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className={`relative bg-white w-full max-w-md p-6 rounded-lg shadow-xl ${className}`}>
              <div className="flex justify-between items-center mb-6">
                <Dialog.Title className="text-xl font-bold text-gray-900">
                  Filter Recipes
                </Dialog.Title>
                <button
                  type="button"
                  className="text-gray-400 hover:text-gray-700 focus:outline-none"
                  onClick={onClose}
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              
              <div className="space-y-6">
                {/* Prep Time Slider */}
                <div>
                  <label htmlFor="prep-time" className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Preparation Time: {maxPrepTime ? `${maxPrepTime} minutes` : 'Any'}
                  </label>
                  <input
                    type="range"
                    id="prep-time"
                    min="5"
                    max="120"
                    step="5"
                    value={maxPrepTime || 120}
                    onChange={(e) => setMaxPrepTime(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>5 min</span>
                    <span>120 min</span>
                  </div>
                </div>
                
                {/* Cuisine Type Dropdown */}
                <div>
                  <label htmlFor="cuisine-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Cuisine Type
                  </label>
                  <select
                    id="cuisine-type"
                    value={cuisineType || ''}
                    onChange={(e) => setCuisineType(e.target.value || null)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">Any Cuisine</option>
                    {cuisineOptions.map((cuisine) => (
                      <option key={cuisine} value={cuisine}>
                        {cuisine}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Dietary Restrictions */}
                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-2">
                    Dietary Restrictions
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {dietOptions.map((diet) => (
                      <div key={diet} className="flex items-center">
                        <input
                          id={`diet-${diet}`}
                          type="checkbox"
                          checked={dietaryRestrictions.includes(diet)}
                          onChange={() => handleDietChange(diet)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`diet-${diet}`} className="ml-2 text-sm text-gray-700 capitalize">
                          {diet}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Health Score */}
                <div>
                  <label htmlFor="health-score" className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Health Score: {minHealthScore || 0}
                  </label>
                  <input
                    type="range"
                    id="health-score"
                    min="0"
                    max="100"
                    step="10"
                    value={minHealthScore || 0}
                    onChange={(e) => setMinHealthScore(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

// Make sure to include this import at the top of your file
import { Transition } from '@headlessui/react';

export default RecipeFilters;