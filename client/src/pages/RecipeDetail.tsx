// client/src/pages/RecipeDetail.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Layout from '../components/common/Layout';
import recipeApi, { Recipe } from '../api/recipes';
import authApi from '../api/auth';
import { 
  HiClock, HiUserGroup, HiHeart, HiOutlineHeart, 
  HiArrowLeft, HiLink, HiShieldCheck
} from 'react-icons/hi';

const RecipeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isFavoriteLoading, setIsFavoriteLoading] = useState<boolean>(false);
  const isAuthenticated = authApi.isAuthenticated();

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        const recipeData = await recipeApi.getRecipeById(id);
        setRecipe(recipeData);
        // Fix for TS2345: Argument of type 'boolean | undefined' is not assignable to parameter of type 'SetStateAction<boolean>'
        setIsFavorite(recipeData.isFavorite || false);
      } catch (error) {
        console.error('Error fetching recipe details:', error);
        toast.error('Failed to load recipe details');
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipeDetails();
  }, [id, navigate]);

  const handleFavoriteToggle = async () => {
    if (!isAuthenticated) {
      toast.info('Please log in to save favorites');
      return;
    }
    
    if (!recipe) return;
    
    setIsFavoriteLoading(true);
    try {
      await recipeApi.toggleFavorite(recipe.id);
      setIsFavorite(!isFavorite);
      toast.success(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    } finally {
      setIsFavoriteLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-teal-500"></div>
            <p className="mt-4 text-gray-600">Loading recipe details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!recipe) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Recipe not found</h2>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg"
            >
              {/* Fix for TS2786: Icon components cannot be used as JSX */}
              <HiArrowLeft className="mr-2" aria-hidden="true" /> Back to Home
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6"
        >
          {/* Fix for TS2786: Icon components cannot be used as JSX */}
          <HiArrowLeft className="mr-1" aria-hidden="true" /> Back
        </button>

        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="relative h-80 md:h-96">
            <img 
              src={recipe.image} 
              alt={recipe.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-recipe.jpg';
              }}
            />
            <button
              onClick={handleFavoriteToggle}
              disabled={isFavoriteLoading}
              className={`absolute top-4 right-4 p-3 rounded-full ${
                isFavorite 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white/90 text-gray-700 hover:bg-red-500 hover:text-white'
              } transition-colors shadow-sm`}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? (
                <HiHeart className="w-6 h-6" aria-hidden="true" />
              ) : (
                <HiOutlineHeart className="w-6 h-6" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
              {recipe.title}
            </h1>

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center text-gray-600">
                <HiClock className="w-5 h-5 mr-2 text-teal-600" aria-hidden="true" />
                <span>Ready in {recipe.readyInMinutes} minutes</span>
              </div>
              <div className="flex items-center text-gray-600">
                <HiUserGroup className="w-5 h-5 mr-2 text-teal-600" aria-hidden="true" />
                <span>{recipe.servings} servings</span>
              </div>
              {/* Fix for TS18048: 'recipe.healthScore' is possibly 'undefined' */}
              {recipe.healthScore !== undefined && recipe.healthScore > 0 && (
                <div className="flex items-center text-gray-600">
                  <HiShieldCheck className="w-5 h-5 mr-2 text-teal-600" aria-hidden="true" />
                  <span>Health Score: {recipe.healthScore}%</span>
                </div>
              )}
            </div>

            <div className="prose max-w-none mb-8">
              {/* Fix for TS2322: Type 'string | undefined' is not assignable to type 'string | TrustedHTML' */}
              <div dangerouslySetInnerHTML={{ __html: recipe.summary || '' }} />
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="md:col-span-1">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Ingredients</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    {/* Fix for TS2461: Type 'Ingredient[] | undefined' is not an array type */}
                    {[...(recipe.usedIngredients || []), ...(recipe.missedIngredients || [])].map((ingredient) => (
                      <li key={ingredient.id} className="flex items-start">
                        <span className={`inline-block w-2 h-2 rounded-full mt-2 mr-2 ${
                          // Fix for TS18048: 'recipe.usedIngredients' is possibly 'undefined'
                          recipe.usedIngredients?.some(i => i.id === ingredient.id)
                            ? 'bg-green-500'
                            : 'bg-orange-500'
                        }`}></span>
                        <span>{ingredient.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="md:col-span-2">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Instructions</h2>
                {recipe.instructions ? (
                  <div 
                    className="prose max-w-none" 
                    dangerouslySetInnerHTML={{ __html: recipe.instructions }}
                  />
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-700">
                      Full instructions are available on the original recipe source.
                    </p>
                    <a 
                      href={recipe.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center text-teal-600 hover:text-teal-800"
                    >
                      <HiLink className="mr-1" aria-hidden="true" /> View Original Recipe
                    </a>
                  </div>
                )}
              </div>
            </div>

            {recipe.sourceUrl && (
              <div className="mt-8 pt-4 border-t border-gray-200">
                <a 
                  href={recipe.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-teal-600 hover:text-teal-800"
                >
                  <HiLink className="mr-1" aria-hidden="true" /> View Original Recipe
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default RecipeDetail;