from flask import Blueprint, request, jsonify
from app.models.recommendation import RecipeRecommender
from app.utils.preprocessor import preprocess_ingredients, enrich_recipe_data
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create API blueprint
api = Blueprint('api', __name__)

# Initialize the recommender model
recommender = RecipeRecommender()

@api.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify service is running."""
    return jsonify({"status": "healthy", "service": "recipe-genie-ai"}), 200

@api.route('/enhance-recipes', methods=['POST'])
def enhance_recipes():
    """
    Enhance recipe recommendations based on user preferences and ingredients.
    Expected JSON payload:
    {
        "recipes": [list of recipe objects from external API],
        "user_preferences": {
            "favorites": [list of recipe IDs],
            "dietary_restrictions": [list of restrictions],
            "cuisine_preferences": [list of cuisines],
            "past_interactions": [list of recipe interactions]
        },
        "ingredients": [list of ingredients provided by user]
    }
    
    Returns:
    Enhanced and ranked list of recipes with additional metadata.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        if 'recipes' not in data:
            return jsonify({"error": "Invalid request. Missing recipes data."}), 400

        # Extract data from request
        recipes = data.get('recipes', [])
        user_preferences = data.get('user_preferences', {})
        ingredients = data.get('ingredients', [])

        # No recipes to process
        if not recipes:
            return jsonify({
                "recipes": [], 
                "metadata": {
                    "total_count": 0,
                    "message": "No recipes to enhance"
                }
            }), 200

        # Preprocess the ingredients for better matching
        processed_ingredients = preprocess_ingredients(ingredients)

        # Enrich recipe data with additional metrics
        enriched_recipes = enrich_recipe_data(recipes, processed_ingredients)

        # Get personalized recommendations
        enhanced_recipes = recommender.recommend(
            enriched_recipes,
            user_preferences=user_preferences,
            ingredients=processed_ingredients
        )

        return jsonify({
            "recipes": enhanced_recipes,
            "metadata": {
                "total_count": len(enhanced_recipes),
                "processing_info": recommender.get_processing_metadata()
            }
        }), 200

    except Exception as e:
        logger.error(f"Error in enhance_recipes: {str(e)}")
        return jsonify({
            "error": str(e), 
            "message": "Failed to process recipe recommendations"
        }), 500

@api.route('/train', methods=['POST'])
def train_model():
    """
    Endpoint to retrain or update the recommendation model with new data.
    Expected JSON payload:
    {
        "training_data": [list of user interaction data],
        "force_retrain": boolean
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        if 'training_data' not in data:
            return jsonify({"error": "Invalid request. Missing training data."}), 400

        training_data = data['training_data']
        force_retrain = data.get('force_retrain', False)

        # Train the model
        training_result = recommender.train(training_data, force=force_retrain)

        return jsonify({
            "success": True,
            "model_info": training_result
        }), 200

    except Exception as e:
        logger.error(f"Error in train_model: {str(e)}")
        return jsonify({
            "error": str(e), 
            "message": "Failed to train model"
        }), 500

@api.route('/analyze-ingredients', methods=['POST'])
def analyze_ingredients():
    """
    Analyze provided ingredients and suggest possible recipes or ingredient combinations.
    Expected JSON payload:
    {
        "ingredients": [list of ingredients]
    }
    
    Returns:
    Analysis of ingredients including possible recipe categories and missing key ingredients.
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400
            
        if 'ingredients' not in data:
            return jsonify({"error": "Invalid request. Missing ingredients data."}), 400

        ingredients = data['ingredients']

        # Process ingredients
        processed_ingredients = preprocess_ingredients(ingredients)

        # Get ingredient analysis
        analysis = recommender.analyze_ingredients(processed_ingredients)

        return jsonify({
            "analysis": analysis,
            "suggested_additions": recommender.suggest_additional_ingredients(processed_ingredients)
        }), 200

    except Exception as e:
        logger.error(f"Error in analyze_ingredients: {str(e)}")
        return jsonify({
            "error": str(e), 
            "message": "Failed to analyze ingredients"
        }), 500
