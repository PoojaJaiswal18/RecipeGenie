import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import authApi from '../api/auth';
import { updateUser } from '../redux/slices/authSlice';
import { RootState } from '../redux/store';
import {
  HiUser,
  HiMail,
  HiPencil,
  HiSave,
  HiX,
  HiExclamationCircle,
  HiCheck,
  HiOutlineHeart,
  HiOutlineClock,
} from 'react-icons/hi';
import recipesApi from '../api/recipes';
import RecipeCard from '../components/recipe/RecipeCard';
import Layout from '../components/common/Layout';

// Define types for API data
interface Recipe {
  id: string;
  title: string;
  image: string;
  readyInMinutes: number;
  servings: number;
  // Add other recipe properties as needed
}

// Define UserPreferences interface
interface UserPreferences {
  diet?: string;
  intolerances?: string[];
  favoriteIngredients?: string[];
}

// Define User interface
interface User {
  id?: string;
  name?: string;
  email?: string;
  preferences?: UserPreferences;
}

// Define UI-specific preferences that include cuisines
interface UIPreferences extends UserPreferences {
  cuisines?: string[];
}

// Diet options for preferences
const DIET_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten Free',
  'Ketogenic',
  'Pescetarian',
  'Paleo',
  'Primal',
];

// Common cuisine options
const CUISINE_OPTIONS = [
  'American',
  'Chinese',
  'French',
  'Greek',
  'Indian',
  'Italian',
  'Japanese',
  'Korean',
  'Mexican',
  'Thai',
];

// Common food intolerances
const INTOLERANCE_OPTIONS = [
  'Dairy',
  'Egg',
  'Gluten',
  'Grain',
  'Peanut',
  'Seafood',
  'Sesame',
  'Shellfish',
  'Soy',
  'Tree Nut',
  'Wheat',
];

const Profile: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  
  // Use UIPreferences to include cuisines for UI state
  const [preferencesData, setPreferencesData] = useState<UIPreferences>({
    diet: user?.preferences?.diet || undefined,
    intolerances: user?.preferences?.intolerances || [],
    favoriteIngredients: user?.preferences?.favoriteIngredients || [],
    cuisines: (user?.preferences as UIPreferences)?.cuisines || [], // Safe cast for UI-only field
  });
  
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    loadUserRecipes();
  }, []);
  
  const loadUserRecipes = async () => {
    setIsLoading(true);
    try {
      const [favorites, recent] = await Promise.all([
        recipesApi.getFavoriteRecipes(),
        recipesApi.getRecentRecipes(),
      ]);
      
      setFavoriteRecipes(favorites);
      setRecentRecipes(recent);
    } catch (error) {
      console.error('Error loading recipes:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value,
    });
  };
  
  const togglePreference = (type: keyof UIPreferences, value: string) => {
    setPreferencesData(prev => {
      // Handle diet selection differently (single selection)
      if (type === 'diet') {
        return {
          ...prev,
          [type]: value,
        };
      }
      
      // For arrays like cuisines, intolerances, and favoriteIngredients
      const current = prev[type] as string[] || [];
      return {
        ...prev,
        [type]: current.includes(value)
          ? current.filter(item => item !== value)
          : [...current, value],
      };
    });
  };
  
  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const updatedUser = await authApi.updateProfile(profileData);
      dispatch(updateUser(updatedUser));
      setIsEditingProfile(false);
      showMessage('Profile updated successfully', 'success');
    } catch (error) {
      console.error('Error updating profile:', error);
      showMessage('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSavePreferences = async () => {
    setIsSaving(true);
    try {
      // Extract only the fields that the API expects (exclude cuisines)
      const apiPreferences: UserPreferences = {
        diet: preferencesData.diet,
        intolerances: preferencesData.intolerances,
        favoriteIngredients: preferencesData.favoriteIngredients,
      };
      
      // Send only the preferences to the API
      const updatedUser = await authApi.updateProfile({ 
        preferences: apiPreferences
      });
      
      // Create a new user object with the API response plus our UI-specific cuisines
      const userWithUiPrefs = {
        ...updatedUser,
        preferences: {
          ...updatedUser.preferences,
          cuisines: preferencesData.cuisines
        } as UIPreferences
      };
      
      dispatch(updateUser(userWithUiPrefs));
      setIsEditingPreferences(false);
      showMessage('Preferences updated successfully', 'success');
    } catch (error) {
      console.error('Error updating preferences:', error);
      showMessage('Failed to update preferences', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };
  
  const handleFavoriteToggle = async (recipeId: string) => {
    // This will be implemented in the RecipeCard component
    // Just refresh the recipes after toggle
    await loadUserRecipes();
  };
  
  // Safely access user preferences with UI fields
  const uiPreferences = user?.preferences as UIPreferences || {};
  
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600 mt-1">Manage your account and preferences</p>
        </div>
        
        {message && (
          <div className={`rounded-md p-4 mb-6 ${
            message.type === 'success' ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {message.type === 'success' ? (
                  <HiCheck className="h-5 w-5 text-green-400" />
                ) : (
                  <HiExclamationCircle className="h-5 w-5 text-red-400" />
                )}
              </div>
              <div className="ml-3">
                <p className={`text-sm font-medium ${
                  message.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {message.text}
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile and Preferences Section */}
          <div className="md:col-span-1 space-y-6">
            {/* Profile Info Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Account Information</h2>
                {!isEditingProfile && (
                  <button
                    onClick={() => setIsEditingProfile(true)}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center"
                  >
                    <HiPencil className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>
              
              {isEditingProfile ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Full Name
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiUser className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="name"
                        id="name"
                        value={profileData.name}
                        onChange={handleProfileChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email Address
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <HiMail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        value={profileData.email}
                        onChange={handleProfileChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <HiX className="h-4 w-4 mr-2 -ml-1" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <HiSave className="h-4 w-4 mr-2 -ml-1" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center">
                    <HiUser className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-800">{user?.name}</span>
                  </div>
                  <div className="flex items-center">
                    <HiMail className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-gray-800">{user?.email}</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Preferences Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Dietary Preferences</h2>
                {!isEditingPreferences && (
                  <button
                    onClick={() => setIsEditingPreferences(true)}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center"
                  >
                    <HiPencil className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>
              
              {isEditingPreferences ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Diet</h3>
                    <div className="flex flex-wrap gap-2">
                      {DIET_OPTIONS.map(diet => (
                        <button
                          key={diet}
                          type="button"
                          onClick={() => togglePreference('diet', diet)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                            preferencesData.diet === diet
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {diet}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Favorite Cuisines</h3>
                    <div className="flex flex-wrap gap-2">
                      {CUISINE_OPTIONS.map(cuisine => (
                        <button
                          key={cuisine}
                          type="button"
                          onClick={() => togglePreference('cuisines', cuisine)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                            preferencesData.cuisines?.includes(cuisine)
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {cuisine}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Food Intolerances</h3>
                    <div className="flex flex-wrap gap-2">
                      {INTOLERANCE_OPTIONS.map(intolerance => (
                        <button
                          key={intolerance}
                          type="button"
                          onClick={() => togglePreference('intolerances', intolerance)}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                            preferencesData.intolerances?.includes(intolerance)
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          {intolerance}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingPreferences(false)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <HiX className="h-4 w-4 mr-2 -ml-1" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePreferences}
                      disabled={isSaving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <HiSave className="h-4 w-4 mr-2 -ml-1" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Diet</h3>
                    <div className="flex flex-wrap gap-2">
                      {uiPreferences.diet ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800">
                          {uiPreferences.diet}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">No diet preferences set</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Favorite Cuisines</h3>
                    <div className="flex flex-wrap gap-2">
                      {uiPreferences.cuisines && uiPreferences.cuisines.length > 0 ? (
                        uiPreferences.cuisines.map(cuisine => (
                          <span key={cuisine} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 text-indigo-800">
                            {cuisine}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No cuisine preferences set</span>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Food Intolerances</h3>
                    <div className="flex flex-wrap gap-2">
                      {uiPreferences.intolerances && uiPreferences.intolerances.length > 0 ? (
                        uiPreferences.intolerances.map(intolerance => (
                          <span key={intolerance} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">
                            {intolerance}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No intolerances set</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* User Recipe History Section */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="flex" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('favorites')}
                    className={`${
                      activeTab === 'favorites'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                  >
                    <div className="flex items-center justify-center">
                      <HiOutlineHeart className="h-5 w-5 mr-2" />
                      Favorite Recipes
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('recent')}
                    className={`${
                      activeTab === 'recent'
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                  >
                    <div className="flex items-center justify-center">
                      <HiOutlineClock className="h-5 w-5 mr-2" />
                      Recently Viewed
                    </div>
                  </button>
                </nav>
              </div>
              
              <div className="p-4">
                {isLoading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                  </div>
                ) : (
                  <>
                    {activeTab === 'favorites' && (
                      <>
                        {favoriteRecipes.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {favoriteRecipes.map(recipe => (
                              <RecipeCard 
                                key={recipe.id} 
                                recipe={recipe} 
                                onFavoriteToggle={handleFavoriteToggle} 
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <HiOutlineHeart className="h-12 w-12 text-gray-400 mx-auto" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No favorites yet</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Start adding recipes to your favorites.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    
                    {activeTab === 'recent' && (
                      <>
                        {recentRecipes.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {recentRecipes.map(recipe => (
                              <RecipeCard 
                                key={recipe.id} 
                                recipe={recipe} 
                                onFavoriteToggle={handleFavoriteToggle} 
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12">
                            <HiOutlineClock className="h-12 w-12 text-gray-400 mx-auto" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No recent recipes</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Recipes you view will appear here.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;