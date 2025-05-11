import numpy as np
import pandas as pd
import joblib
import os
import time
import logging
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from scipy.sparse import hstack, csr_matrix

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RecipeRecommender:
    """
    AI-powered recipe recommendation system that enhances and personalizes recipe suggestions
    based on user preferences, available ingredients, and historical interactions.
    """
    
    def __init__(self):
        """Initialize the recommender with necessary models and data structures."""
        self.model_path = os.path.join(os.path.dirname(__file__), '../data/models')
        self.tfidf_vectorizer = None
        self.ingredient_vectorizer = None
        self.cuisine_vectorizer = None
        self.preference_scaler = None
        self.feature_weights = {
            'ingredient_match': 0.4,
            'user_preference': 0.3,
            'popularity': 0.2,
            'complexity': 0.1
        }
        self.processing_metadata = {}
        self._load_models()
        
    def _load_models(self):
        """Load pre-trained models and vectorizers."""
        try:
            # Create model directory if it doesn't exist
            os.makedirs(self.model_path, exist_ok=True)
            
            # Try to load existing models
            tfidf_path = os.path.join(self.model_path, 'tfidf_vectorizer.joblib')
            ingredient_path = os.path.join(self.model_path, 'ingredient_vectorizer.joblib')
            cuisine_path = os.path.join(self.model_path, 'cuisine_vectorizer.joblib')
            scaler_path = os.path.join(self.model_path, 'preference_scaler.joblib')
            
            # Load if they exist, otherwise initialize new ones
            if os.path.exists(tfidf_path):
                self.tfidf_vectorizer = joblib.load(tfidf_path)
                logger.info("Loaded TF-IDF vectorizer from disk")
            else:
                self.tfidf_vectorizer = TfidfVectorizer(max_features=5000, stop_words='english')
                logger.info("Initialized new TF-IDF vectorizer")
                
            if os.path.exists(ingredient_path):
                self.ingredient_vectorizer = joblib.load(ingredient_path)
                logger.info("Loaded ingredient vectorizer from disk")
            else:
                self.ingredient_vectorizer = TfidfVectorizer(max_features=1000)
                logger.info("Initialized new ingredient vectorizer")
                
            if os.path.exists(cuisine_path):
                self.cuisine_vectorizer = joblib.load(cuisine_path)
                logger.info("Loaded cuisine vectorizer from disk")
            else:
                self.cuisine_vectorizer = TfidfVectorizer(max_features=100)
                logger.info("Initialized new cuisine vectorizer")
                
            if os.path.exists(scaler_path):
                self.preference_scaler = joblib.load(scaler_path)
                logger.info("Loaded preference scaler from disk")
            else:
                self.preference_scaler = StandardScaler()
                logger.info("Initialized new preference scaler")
                
        except Exception as e:
            logger.error(f"Error loading models: {str(e)}")
            # Initialize with defaults if loading fails
            self.tfidf_vectorizer = TfidfVectorizer(max_features=5000, stop_words='english')
            self.ingredient_vectorizer = TfidfVectorizer(max_features=1000)
            self.cuisine_vectorizer = TfidfVectorizer(max_features=100)
            self.preference_scaler = StandardScaler()
            logger.info("Initialized new models due to loading error")
            
    def _save_models(self):
        """Save trained models and vectorizers to disk."""
        try:
            # Create model directory if it doesn't exist
            os.makedirs(self.model_path, exist_ok=True)
            
            # Save models
            joblib.dump(self.tfidf_vectorizer, os.path.join(self.model_path, 'tfidf_vectorizer.joblib'))
            joblib.dump(self.ingredient_vectorizer, os.path.join(self.model_path, 'ingredient_vectorizer.joblib'))
            joblib.dump(self.cuisine_vectorizer, os.path.join(self.model_path, 'cuisine_vectorizer.joblib'))
            joblib.dump(self.preference_scaler, os.path.join(self.model_path, 'preference_scaler.joblib'))
            
            logger.info("Successfully saved models to disk")
            return True
        except Exception as e:
            logger.error(f"Error saving models: {str(e)}")
            return False
            
    def train(self, training_data, force=False):
        """
        Train or update the recommendation models using historical data.
        
        Args:
            training_data: List of dictionaries containing recipe interactions and user preferences
            force: Boolean indicating whether to force retrain even if recent training has occurred
            
        Returns:
            Dictionary containing training results and model information
        """
        start_time = time.time()
        
        # Check if we need to train
        last_trained = self.processing_metadata.get('last_trained')
        if last_trained and not force:
            # Don't train if less than a day has passed since last training
            last_trained_date = datetime.fromisoformat(last_trained)
            if (datetime.now() - last_trained_date).days < 1:
                logger.info("Skipping training as models were recently updated")
                return {
                    "status": "skipped",
                    "last_trained": last_trained,
                    "message": "Models were recently trained"
                }
        
        # Extract relevant data from training set
        try:
            # Create dataframes from training data
            if not training_data:
                raise ValueError("Empty training data provided")
                
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(training_data)
            
            # Train text vectorizers if we have enough data
            if 'recipe_description' in df.columns and len(df) > 10:
                self.tfidf_vectorizer.fit(df['recipe_description'].fillna(''))
            
            if 'ingredients' in df.columns and len(df) > 10:
                # Join ingredients lists into strings for vectorization
                ingredient_texts = df['ingredients'].apply(lambda x: ' '.join(x) if isinstance(x, list) else str(x))
                self.ingredient_vectorizer.fit(ingredient_texts)
            
            if 'cuisine' in df.columns and len(df) > 5:
                self.cuisine_vectorizer.fit(df['cuisine'].fillna(''))
                
            # Train preference scaler if we have user ratings
            if 'user_rating' in df.columns and len(df) > 10:
                ratings = df[['user_rating']].values
                self.preference_scaler.fit(ratings)
                
            # Save the trained models
            self._save_models()
            
            # Update metadata
            training_time = time.time() - start_time
            self.processing_metadata = {
                'last_trained': datetime.now().isoformat(),
                'training_samples': len(df),
                'training_time_seconds': training_time,
                'model_version': datetime.now().strftime('%Y%m%d%H%M')
            }
            
            logger.info(f"Model training completed in {training_time:.2f} seconds with {len(df)} samples")
            
            return {
                "status": "success",
                "training_time": training_time,
                "samples_processed": len(df),
                "last_trained": self.processing_metadata['last_trained'],
                "model_version": self.processing_metadata['model_version']
            }
            
        except Exception as e:
            logger.error(f"Error during model training: {str(e)}")
            return {
                "status": "error",
                "error": str(e),
                "message": "Failed to train models"
            }
    
    def recommend(self, recipes, user_preferences=None, ingredients=None):
        """
        Generate personalized recipe recommendations based on user preferences and ingredients.
        
        Args:
            recipes: List of recipe dictionaries from external API
            user_preferences: Dictionary containing user preference data
            ingredients: List of preprocessed ingredients available to the user
            
        Returns:
            List of enhanced recipe dictionaries, sorted by personalized relevance score
        """
        start_time = time.time()
        
        try:
            if not recipes:
                return []
                
            # Convert recipes to DataFrame for easier manipulation
            df = pd.DataFrame(recipes)
            
            # Add initial score column (will be updated with our algorithm)
            df['ai_relevance_score'] = 0.0
            
            # 1. Calculate ingredient match scores
            if ingredients and 'ingredients' in df.columns:
                df['ingredient_match_score'] = df['ingredients'].apply(
                    lambda recipe_ingredients: self._calculate_ingredient_match(recipe_ingredients, ingredients)
                )
                # Normalize scores to 0-1 range
                if not df['ingredient_match_score'].empty and df['ingredient_match_score'].max() > 0:
                    df['ingredient_match_score'] = df['ingredient_match_score'] / df['ingredient_match_score'].max()
                
                # Update the relevance score with ingredient match component
                df['ai_relevance_score'] += df['ingredient_match_score'] * self.feature_weights['ingredient_match']
            
            # 2. Apply user preference boosting if available
            if user_preferences and 'favorites' in user_preferences:
                df['preference_score'] = df.apply(
                    lambda row: self._calculate_preference_score(row, user_preferences), 
                    axis=1
                )
                # Normalize preference scores
                if not df['preference_score'].empty and df['preference_score'].max() > 0:
                    df['preference_score'] = df['preference_score'] / df['preference_score'].max()
                
                # Update the relevance score with preference component
                df['ai_relevance_score'] += df['preference_score'] * self.feature_weights['user_preference']
            
            # 3. Factor in recipe popularity if available
            if 'popularity' in df.columns:
                # Normalize popularity to 0-1
                if not df['popularity'].empty and df['popularity'].max() > 0:
                    df['normalized_popularity'] = df['popularity'] / df['popularity'].max()
                    df['ai_relevance_score'] += df['normalized_popularity'] * self.feature_weights['popularity']
            
            # 4. Consider recipe complexity if available
            if 'complexity' in df.columns:
                # For complexity, we might prefer medium complexity, not too simple or too complex
                # Transform complexity to favor middle values (assume 0-1 scale)
                df['complexity_score'] = 1 - abs(df['complexity'] - 0.5) * 2
                df['ai_relevance_score'] += df['complexity_score'] * self.feature_weights['complexity']
            
            # Sort by the final relevance score
            df = df.sort_values('ai_relevance_score', ascending=False)
            
            # Add rank and round the score for readability
            df['ai_rank'] = range(1, len(df) + 1)
            df['ai_relevance_score'] = df['ai_relevance_score'].round(4)
            
            # Update processing metadata
            processing_time = time.time() - start_time
            self.processing_metadata = {
                **self.processing_metadata,
                'last_recommendation_time': datetime.now().isoformat(),
                'recipes_processed': len(recipes),
                'processing_time_seconds': processing_time
            }
            
            logger.info(f"Generated recommendations in {processing_time:.3f} seconds for {len(recipes)} recipes")
            
            # Convert back to list of dictionaries and return
            enhanced_recipes = df.to_dict('records')
            return enhanced_recipes
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {str(e)}")
            # If something fails, return original recipes
            return recipes
    
    def _calculate_ingredient_match(self, recipe_ingredients, user_ingredients):
        """
        Calculate how well a recipe's ingredients match with user's available ingredients.
        
        Args:
            recipe_ingredients: List of ingredients required by the recipe
            user_ingredients: List of ingredients available to the user
            
        Returns:
            Float representing the match score (higher is better)
        """
        if not recipe_ingredients or not user_ingredients:
            return 0.0
            
        # Convert inputs to lists if they're not already
        if isinstance(recipe_ingredients, str):
            recipe_ingredients = [recipe_ingredients]
        if isinstance(user_ingredients, str):
            user_ingredients = [user_ingredients]
            
        # Convert everything to lowercase for comparison
        recipe_ingredients_lower = [str(ing).lower() for ing in recipe_ingredients]
        user_ingredients_lower = [str(ing).lower() for ing in user_ingredients]
        
        # Count how many required ingredients the user has
        matched_ingredients = sum(any(user_ing in recipe_ing for user_ing in user_ingredients_lower) 
                                  for recipe_ing in recipe_ingredients_lower)
        
        # Calculate match percentage
        total_required = len(recipe_ingredients)
        if total_required == 0:
            return 0.0
            
        match_percentage = matched_ingredients / total_required
        
        # Boost score if most ingredients match
        if match_percentage > 0.8:
            match_percentage *= 1.2
            
        # Cap at 1.0
        return min(match_percentage, 1.0)
    
    def _calculate_preference_score(self, recipe_row, user_preferences):
        """
        Calculate preference score based on user's historical preferences.
        
        Args:
            recipe_row: DataFrame row containing recipe data
            user_preferences: Dictionary of user preference data
            
        Returns:
            Float representing preference score
        """
        score = 0.0
        recipe_id = str(recipe_row.get('id', ''))
        
        # Check if this recipe is in user's favorites
        if 'favorites' in user_preferences and recipe_id in [str(f) for f in user_preferences['favorites']]:
            score += 1.0
            
        # Check cuisine preferences
        if ('cuisine_preferences' in user_preferences and 
            'cuisine' in recipe_row and 
            recipe_row['cuisine'] in user_preferences['cuisine_preferences']):
            score += 0.5
            
        # Check dietary restrictions (negative factor)
        if 'dietary_restrictions' in user_preferences and 'tags' in recipe_row:
            recipe_tags = [tag.lower() for tag in recipe_row['tags']] if recipe_row['tags'] else []
            for restriction in user_preferences['dietary_restrictions']:
                # If recipe contains a restricted item, reduce score
                if restriction.lower() in recipe_tags:
                    score -= 0.7
                    
        # Check past interactions if available
        if 'past_interactions' in user_preferences:
            for interaction in user_preferences['past_interactions']:
                if str(interaction.get('recipe_id', '')) == recipe_id:
                    # Boost score based on past rating
                    if 'rating' in interaction:
                        score += (interaction['rating'] / 5.0) * 0.8
                        
        return max(score, 0.0)  # Ensure we don't return negative scores
    
    def analyze_ingredients(self, ingredients):
        """
        Analyze provided ingredients to determine potential recipe categories.
        
        Args:
            ingredients: List of preprocessed ingredients
            
        Returns:
            Dictionary with analysis results
        """
        if not ingredients:
            return {"suitable_categories": [], "ingredient_groups": {}}
            
        # Define common ingredient categories
        categories = {
            "Italian": ["pasta", "tomato", "basil", "mozzarella", "parmesan", "olive oil", "garlic"],
            "Mexican": ["tortilla", "beans", "avocado", "cilantro", "lime", "jalapeño", "corn"],
            "Asian": ["soy sauce", "ginger", "rice", "sesame oil", "tofu", "fish sauce", "rice vinegar"],
            "Mediterranean": ["feta", "cucumber", "chickpeas", "lemon", "olive", "tahini", "mint"],
            "American": ["ground beef", "potato", "corn", "bread", "cheddar", "bacon", "ketchup"],
            "Dessert": ["sugar", "flour", "vanilla", "chocolate", "butter", "egg", "cream"]
        }
        
        # Count matches for each category
        category_scores = {}
        for category, category_ingredients in categories.items():
            matches = sum(any(item in str(ing).lower() for ing in ingredients) 
                          for item in category_ingredients)
            category_scores[category] = matches / len(category_ingredients)
            
        # Sort categories by score
        sorted_categories = sorted(
            category_scores.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        # Return top categories that have at least some ingredients matched
        suitable_categories = [
            {"name": cat, "match_score": round(score, 2)} 
            for cat, score in sorted_categories 
            if score > 0.15
        ]
        
        # Organize ingredients by food group
        food_groups = {
            "Proteins": ["chicken", "beef", "pork", "tofu", "fish", "shrimp", "egg", "beans", "lentils"],
            "Vegetables": ["onion", "tomato", "lettuce", "carrot", "broccoli", "pepper", "spinach", "zucchini"],
            "Fruits": ["apple", "banana", "orange", "berries", "mango", "lemon", "lime"],
            "Grains": ["rice", "pasta", "bread", "quinoa", "oats", "flour", "tortilla"],
            "Dairy": ["milk", "cheese", "yogurt", "cream", "butter"],
            "Seasonings": ["salt", "pepper", "garlic", "herb", "spice", "sauce"]
        }
        
        ingredient_groups = {group: [] for group in food_groups}
        for ing in ingredients:
            ing_lower = str(ing).lower()
            assigned = False
            for group, keywords in food_groups.items():
                if any(keyword in ing_lower for keyword in keywords):
                    ingredient_groups[group].append(ing)
                    assigned = True
                    break
            if not assigned:
                # Create an "Other" category if none exists
                if "Other" not in ingredient_groups:
                    ingredient_groups["Other"] = []
                ingredient_groups["Other"].append(ing)
                
        # Remove empty groups
        ingredient_groups = {k: v for k, v in ingredient_groups.items() if v}
        
        return {
            "suitable_categories": suitable_categories,
            "ingredient_groups": ingredient_groups
        }
    
    def suggest_additional_ingredients(self, ingredients):
        """
        Suggest additional ingredients that pair well with the provided ingredients.
        
        Args:
            ingredients: List of preprocessed ingredients
            
        Returns:
            List of ingredient suggestions
        """
        if not ingredients:
            return []
            
        # Define common ingredient pairings
        pairings = {
            "tomato": ["basil", "mozzarella", "olive oil", "garlic", "onion"],
            "chicken": ["garlic", "lemon", "rosemary", "thyme", "onion", "potato"],
            "beef": ["onion", "garlic", "mushroom", "carrot", "potato", "red wine"],
            "pasta": ["tomato sauce", "garlic", "parmesan", "olive oil", "basil"],
            "rice": ["soy sauce", "egg", "peas", "carrot", "onion", "garlic"],
            "potato": ["butter", "cheese", "bacon", "sour cream", "garlic", "rosemary"],
            "fish": ["lemon", "butter", "garlic", "dill", "olive oil", "capers"]
        }
        
        suggestions = {}
        for ing in ingredients:
            ing_lower = str(ing).lower()
            # Check if this ingredient is in our pairings dictionary
            for key, pairs in pairings.items():
                if key in ing_lower:
                    for pair in pairs:
                        if pair not in ing_lower and not any(pair in str(i).lower() for i in ingredients):
                            if pair not in suggestions:
                                suggestions[pair] = 0
                            suggestions[pair] += 1
        
        # Sort by frequency and take top 5
        sorted_suggestions = sorted(
            suggestions.items(), 
            key=lambda x: x[1], 
            reverse=True
        )[:5]
        
        return [sugg for sugg, count in sorted_suggestions]
    
    def get_processing_metadata(self):
        """Return metadata about the processing pipeline for debugging and monitoring."""
        return self.processing_metadata