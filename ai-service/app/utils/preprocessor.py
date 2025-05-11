import re
import unicodedata
import string
import logging
from typing import List, Dict, Any, Union

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Ingredient substitutions dictionary for normalization
INGREDIENT_SUBSTITUTIONS = {
    "tomatoes": "tomato",
    "onions": "onion",
    "potatoes": "potato",
    "carrots": "carrot",
    "fresh garlic": "garlic",
    "minced garlic": "garlic",
    "garlic cloves": "garlic",
    "olive oil": "oil",
    "vegetable oil": "oil",
    "canola oil": "oil",
    "bell peppers": "bell pepper",
    "red pepper": "bell pepper",
    "green pepper": "bell pepper",
}

# Common units to remove from ingredient strings
UNITS = [
    "cup", "cups", "tablespoon", "tablespoons", "tbsp", "teaspoon", "teaspoons", "tsp", 
    "ounce", "ounces", "oz", "pound", "pounds", "lb", "lbs", "gram", "grams", "g",
    "kilogram", "kilograms", "kg", "ml", "milliliter", "milliliters", "liter", "liters",
    "pinch", "pinches", "dash", "dashes", "piece", "pieces", "slice", "slices",
    "bunch", "bunches", "clove", "cloves", "sprig", "sprigs", "stalk", "stalks"
]

def clean_text(text: str) -> str:
    """
    Clean and normalize text by removing special characters and extra whitespace.
    
    Args:
        text: String to clean
        
    Returns:
        Cleaned string
    """
    if not text:
        return ""
        
    # Convert to lowercase
    text = text.lower()
    
    # Normalize unicode characters
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    
    # Remove punctuation except for hyphens
    text = re.sub(f'[{re.escape(string.punctuation.replace("-", ""))}]', ' ', text)
    
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def normalize_ingredient(ingredient: str) -> str:
    """
    Normalize ingredient text by removing quantities, units, and applying substitutions.
    
    Args:
        ingredient: Raw ingredient string
        
    Returns:
        Normalized ingredient string
    """
    if not ingredient:
        return ""
        
    # Clean the text first
    clean_ingredient = clean_text(ingredient)
    
    # Remove quantities (numbers and fractions)
    clean_ingredient = re.sub(r'\d+\/\d+|\d+\.\d+|\d+', '', clean_ingredient)
    
    # Remove units
    for unit in UNITS:
        clean_ingredient = re.sub(rf'\b{unit}\b', '', clean_ingredient)
    
    # Apply substitutions for common ingredients
    for original, replacement in INGREDIENT_SUBSTITUTIONS.items():
        if original in clean_ingredient:
            clean_ingredient = clean_ingredient.replace(original, replacement)
    
    # Remove words like "fresh", "chopped", "diced", etc.
    cooking_terms = ["fresh", "chopped", "diced", "minced", "sliced", "grated", "crushed", 
                     "peeled", "cubed", "julienned", "frozen", "canned", "dried"]
    for term in cooking_terms:
        clean_ingredient = re.sub(rf'\b{term}\b', '', clean_ingredient)
    
    # Remove "to taste" and similar phrases
    clean_ingredient = re.sub(r'to taste|as needed|for serving|for garnish', '', clean_ingredient)
    
    # Remove extra spaces and trim
    clean_ingredient = re.sub(r'\s+', ' ', clean_ingredient).strip()
    
    return clean_ingredient

def preprocess_ingredients(ingredients: List[str]) -> List[str]:
    """
    Preprocess a list of ingredients by normalizing and cleaning each one.
    
    Args:
        ingredients: List of raw ingredient strings
        
    Returns:
        List of preprocessed ingredient strings
    """
    if not ingredients:
        return []
    
    try:
        # Convert non-string ingredients to strings if needed
        str_ingredients = [str(ing) for ing in ingredients]
        
        # Process each ingredient
        processed = []
        for ing in str_ingredients:
            normalized = normalize_ingredient(ing)
            if normalized and len(normalized) > 1:  # Skip empty or single-character results
                processed.append(normalized)
                
        # Remove duplicates while preserving order
        unique_processed = []
        seen = set()
        for ing in processed:
            if ing not in seen:
                seen.add(ing)
                unique_processed.append(ing)
                
        return unique_processed
        
    except Exception as e:
        logger.error(f"Error preprocessing ingredients: {str(e)}")
        # Return original list if processing fails
        return ingredients

def enrich_recipe_data(recipes: List[Dict[str, Any]], ingredients: List[str] = None) -> List[Dict[str, Any]]:
    """
    Enrich recipe data with additional computed metrics and normalized fields.
    
    Args:
        recipes: List of recipe dictionaries
        ingredients: Optional list of user-provided ingredients for context
        
    Returns:
        List of enriched recipe dictionaries
    """
    if not recipes:
        return []
        
    try:
        enriched_recipes = []
        
        for recipe in recipes:
            enriched_recipe = recipe.copy()  # Don't modify the original
            
            # 1. Normalize recipe ingredients if present
            if 'ingredients' in recipe and recipe['ingredients']:
                try:
                    enriched_recipe['normalized_ingredients'] = preprocess_ingredients(recipe['ingredients'])
                except:
                    enriched_recipe['normalized_ingredients'] = recipe['ingredients']
            
            # 2. Calculate recipe complexity (based on number of ingredients and steps)
            complexity_score = 0.0
            if 'ingredients' in recipe and recipe['ingredients']:
                # More ingredients = higher complexity
                ingredient_count = len(recipe['ingredients'])
                # Scale from 0-1 with diminishing returns after 15 ingredients
                complexity_score += min(ingredient_count / 15, 1.0) * 0.5
                
            if 'instructions' in recipe and recipe['instructions']:
                # More steps = higher complexity
                if isinstance(recipe['instructions'], list):
                    step_count = len(recipe['instructions'])
                else:
                    # If instructions is a string, count sentences as steps
                    step_count = len(re.split(r'[.!?]+', str(recipe['instructions'])))
                
                # Scale from 0-1 with diminishing returns after 10 steps
                complexity_score += min(step_count / 10, 1.0) * 0.5
                
            # Normalize complexity to 0-1 range
            enriched_recipe['complexity'] = min(complexity_score, 1.0)
            
            # 3. Estimate cooking time if not provided
            if 'cooking_time_minutes' not in recipe or not recipe['cooking_time_minutes']:
                # Estimate based on complexity
                estimated_time = int(20 + (complexity_score * 40))  # 20-60 minutes based on complexity
                enriched_recipe['cooking_time_minutes'] = estimated_time
                enriched_recipe['estimated_time'] = True
            
            # 4. Generate tags if not present
            if 'tags' not in recipe or not recipe['tags']:
                enriched_recipe['tags'] = generate_tags(recipe)
                
            # 5. Add a unique hash for deduplication if needed
            if 'ingredients' in recipe and 'title' in recipe:
                ingredients_str = ' '.join(str(ing) for ing in recipe['ingredients'])
                hash_input = f"{recipe.get('title', '')}{ingredients_str}"
                enriched_recipe['recipe_hash'] = str(hash(hash_input))
            
            enriched_recipes.append(enriched_recipe)
            
        return enriched_recipes
        
    except Exception as e:
        logger.error(f"Error enriching recipe data: {str(e)}")
        # Return original recipes if processing fails
        return recipes

def generate_tags(recipe: Dict[str, Any]) -> List[str]:
    """
    Generate tags for a recipe based on its ingredients and other attributes.
    
    Args:
        recipe: Recipe dictionary
        
    Returns:
        List of generated tags
    """
    tags = set()
    
    # Extract cuisine from recipe if present
    if 'cuisine' in recipe and recipe['cuisine']:
        tags.add(str(recipe['cuisine']).strip())
    
    # Check for common diet types
    ingredients_str = ' '.join(str(ing) for ing in recipe.get('ingredients', []))
    title_and_ingredients = f"{recipe.get('title', '')} {ingredients_str}".lower()
    
    # Check for vegetarian
    meat_ingredients = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 
                         'salmon', 'tuna', 'shrimp', 'bacon', 'ham', 'sausage']
    if not any(meat in title_and_ingredients for meat in meat_ingredients):
        tags.add('vegetarian')
        
        # Check for vegan (no animal products)
        animal_products = ['milk', 'cheese', 'cream', 'yogurt', 'butter', 
                           'egg', 'honey', 'mayo', 'mayonnaise']
        if not any(product in title_and_ingredients for product in animal_products):
            tags.add('vegan')
    
    # Check for common meal types
    if any(word in title_and_ingredients for word in ['breakfast', 'pancake', 'oatmeal', 'cereal']):
        tags.add('breakfast')
    elif any(word in title_and_ingredients for word in ['sandwich', 'wrap', 'salad']):
        tags.add('lunch')
    elif any(word in title_and_ingredients for word in ['dinner', 'roast', 'steak']):
        tags.add('dinner')
    
    # Check for dessert
    if any(word in title_and_ingredients for word in ['dessert', 'cake', 'cookie', 'sweet', 'chocolate', 'ice cream']):
        tags.add('dessert')
    
    # Check cooking method
    if any(word in title_and_ingredients for word in ['grill', 'grilled', 'bbq', 'barbecue']):
        tags.add('grilled')
    elif any(word in title_and_ingredients for word in ['bake', 'baked', 'roast', 'roasted']):
        tags.add('baked')
    elif any(word in title_and_ingredients for word in ['fry', 'fried', 'deep fried']):
        tags.add('fried')
    
    # Check common cuisines
    cuisine_keywords = {
        'italian': ['pasta', 'pizza', 'risotto', 'italian'],
        'mexican': ['taco', 'burrito', 'quesadilla', 'mexican', 'salsa'],
        'asian': ['stir fry', 'tofu', 'soy sauce', 'asian'],
        'indian': ['curry', 'masala', 'indian'],
        'mediterranean': ['mediterranean', 'greek', 'feta', 'olive']
    }
    
    for cuisine, keywords in cuisine_keywords.items():
        if any(keyword in title_and_ingredients for keyword in keywords):
            tags.add(cuisine)
    
    return list(tags)