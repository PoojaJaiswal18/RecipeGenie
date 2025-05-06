import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Recipe } from '../../api/recipes';
// Import icons as elements rather than components
import { HiClock, HiUserGroup, HiHeart, HiOutlineHeart } from 'react-icons/hi';

interface RecipeCardProps {
  recipe: Recipe;
  onFavoriteToggle: (recipeId: string) => Promise<void>;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onFavoriteToggle }) => {
  const [isFavorite, setIsFavorite] = useState(recipe.isFavorite);
  const [isLoading, setIsLoading] = useState(false);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await onFavoriteToggle(recipe.id);
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle missing image
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = '/placeholder-recipe.jpg';
  };

  return (
    <Link 
      to={`/recipe/${recipe.id}`}
      className="group bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden flex flex-col h-full"
    >
      <div className="relative pb-[60%] overflow-hidden">
        <img
          src={recipe.image}
          alt={recipe.title}
          onError={handleImageError}
          className="absolute inset-0 h-full w-full object-cover transform group-hover:scale-105 transition-transform duration-300"
        />
        <button
          onClick={handleFavoriteClick}
          disabled={isLoading}
          className={`absolute top-3 right-3 p-2 rounded-full ${
            isFavorite 
              ? 'bg-red-500 text-white' 
              : 'bg-white/80 text-gray-700 hover:bg-red-500 hover:text-white'
          } transition-colors shadow-sm`}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? (
            HiHeart({ className: "w-5 h-5", size: 20 })
          ) : (
            HiOutlineHeart({ className: "w-5 h-5", size: 20 })
          )}
        </button>
      </div>
      
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
          {recipe.title}
        </h3>
        
        <div className="flex items-center text-sm text-gray-600 mt-auto pt-3">
          <div className="flex items-center mr-4">
            {HiClock({ className: "w-4 h-4 mr-1", size: 16 })}
            <span>{recipe.readyInMinutes} min</span>
          </div>
          <div className="flex items-center">
            {HiUserGroup({ className: "w-4 h-4 mr-1", size: 16 })}
            <span>{recipe.servings} servings</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center text-xs">
            <span className="text-green-600 font-medium">
              {recipe.usedIngredientCount || 0} ingredients matched
            </span>
            {(recipe.missedIngredientCount || 0) > 0 && (
              <span className="ml-auto text-orange-500">
                {recipe.missedIngredientCount} missing
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

export default RecipeCard;