import React, { useState } from 'react';
import RecipeCard from './RecipeCard';
import { Recipe } from '../../api/recipes';
import { HiOutlineFilter, HiOutlineSearch, HiChevronDown } from 'react-icons/hi';

interface RecipeListProps {
  recipes: Recipe[];
  isLoading: boolean;
  onFavoriteToggle: (recipeId: string) => Promise<void>;
}

const RecipeList: React.FC<RecipeListProps> = ({ 
  recipes, 
  isLoading, 
  onFavoriteToggle 
}) => {
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredRecipes = recipes.filter(recipe => 
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const sortedRecipes = [...filteredRecipes].sort((a, b) => {
    switch (sortBy) {
      case 'time':
        return a.readyInMinutes - b.readyInMinutes;
      case 'missing-asc':
        return (a.missedIngredientCount || 0) - (b.missedIngredientCount || 0);
      case 'missing-desc':
        return (b.missedIngredientCount || 0) - (a.missedIngredientCount || 0);
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      default: 
        return ((b.usedIngredientCount || 0) - (b.missedIngredientCount || 0)) - 
               ((a.usedIngredientCount || 0) - (a.missedIngredientCount || 0));
    }
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-teal-500"></div>
        <p className="mt-4 text-gray-600">Finding perfect recipes for you...</p>
      </div>
    );
  }

  if (recipes.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
          {HiOutlineSearch({ className: "w-8 h-8 text-gray-500" })}
        </div>
        <h3 className="text-lg font-medium text-gray-800 mb-2">No recipes found</h3>
        <p className="text-gray-600">
          Try adding different ingredients or removing some filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {HiOutlineSearch({ className: "h-5 w-5 text-gray-400" })}
            </div>
            <input
              type="text"
              placeholder="Search recipes..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                {HiOutlineFilter({ className: "h-5 w-5 text-gray-500" })}
                <span>Filter</span>
                {HiChevronDown({ 
                  className: `h-4 w-4 text-gray-500 transition-transform ${filterMenuOpen ? 'transform rotate-180' : ''}` 
                })}
              </button>
              
              {filterMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg z-20">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b">
                      Sort by
                    </div>
                    {[
                      { id: 'relevance', label: 'Best match' },
                      { id: 'time', label: 'Cooking time' },
                      { id: 'missing-asc', label: 'Fewest missing ingredients' },
                      { id: 'missing-desc', label: 'Most missing ingredients' },
                      { id: 'alphabetical', label: 'Alphabetical' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        className={`block w-full text-left px-4 py-2 text-sm ${
                          sortBy === option.id
                            ? 'bg-teal-50 text-teal-800'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        onClick={() => {
                          setSortBy(option.id);
                          setFilterMenuOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRecipes.map((recipe) => (
          <RecipeCard 
            key={recipe.id} 
            recipe={recipe} 
            onFavoriteToggle={onFavoriteToggle} 
          />
        ))}
      </div>
    </div>
  );
};

export default RecipeList;