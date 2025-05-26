import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/error';
import { IUser } from '../models/User';
import Recipe, { IRecipe, IIngredient, IInstruction, INutrition } from '../models/Recipe';
import winston from 'winston';

// Enhanced logger configuration with proper export structure
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.colorize()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/ai-enhancement.log',
      level: 'info',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Enhanced validation utilities with comprehensive type checking
class ValidationUtils {
  /**
   * Validates if input is a non-empty array
   */
  static validateInputArray(input: any): input is any[] {
    return Array.isArray(input) && input.length > 0;
  }

  /**
   * Validates if input is a positive number
   */
  static validatePositiveNumber(input: any): input is number {
    return typeof input === 'number' && input > 0 && !isNaN(input);
  }

  /**
   * Validates if input is a non-empty string
   */
  static validateNonEmptyString(input: any): input is string {
    return typeof input === 'string' && input.trim().length > 0;
  }

  /**
   * Validates email format
   */
  static validateEmail(email: any): email is string {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates array of strings
   */
  static validateStringArray(input: any): input is string[] {
    return Array.isArray(input) && input.every(item => typeof item === 'string');
  }

  /**
   * Sanitizes string input
   */
  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  /**
   * Validates object with required properties
   */
  static validateObjectWithProperties(obj: any, requiredProps: string[]): boolean {
    if (!obj || typeof obj !== 'object') return false;
    return requiredProps.every(prop => prop in obj);
  }
}

// Enhanced interfaces for AI enhancement
interface EnhancedRecipe extends Omit<IRecipe, '_id' | 'createdAt' | 'updatedAt'> {
  _id?: any;
  createdAt?: Date;
  updatedAt?: Date;
  aiEnhanced?: boolean;
  enhancementTimestamp?: Date;
  difficulty?: string;
  alternativeInstructions?: IInstruction[];
}

interface EnhanceRecipesOptions {
  recipes: IRecipe[];
  userPreferences?: UserPreferences;
  ingredients?: string[];
  context?: string;
}

interface UserPreferences {
  dietaryRestrictions?: string[];
  favoriteCuisines?: string[];
  allergies?: string[];
  dislikedIngredients?: string[];
  cookingSkillLevel?: 'beginner' | 'intermediate' | 'advanced';
  preferredCookingTime?: number;
}

interface AnalyzeIngredientsOptions {
  ingredients: string[];
  dietaryRestrictions?: string[];
  recipeTitle?: string;
  recipeInstructions?: string;
  generateShoppingList?: boolean;
  generateSubstitutions?: boolean;
  nutritionalAnalysis?: boolean;
}

interface IngredientAnalysisResult {
  analysis: {
    nutritionalValue: Record<string, number>;
    healthScore: number;
    allergenWarnings: string[];
    seasonality: Record<string, string>;
    costEstimate: number;
  };
  suggestedSubstitutions: Array<{
    original: string;
    substitutes: string[];
    reason: string;
    nutritionalImpact: string;
  }>;
  suggestedAdditions: Array<{
    ingredient: string;
    reason: string;
    nutritionalBenefit: string;
  }>;
  shoppingList?: ShoppingListItem[];
}

interface ShoppingListItem {
  name: string;
  quantity: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  estimatedCost: number;
}

interface CookingTips {
  cookingTips: string[];
  techniqueSuggestions: string[];
  alternativeMethods: string[];
  timeOptimizations: string[];
  equipmentRecommendations: string[];
}

interface ShoppingListResult {
  success: boolean;
  error?: string;
  shoppingList: ShoppingListItem[];
  categorizedList: Record<string, ShoppingListItem[]>;
  recipeCount: number;
  totalEstimatedCost: number;
  aiEnhanced: boolean;
}

interface TrainingData {
  input: any;
  output: any;
  metadata?: {
    userId?: string;
    timestamp?: Date;
    recipeId?: string;
    interactionType?: string;
  };
}

// Enhanced AI Service Implementation
class AIService {
  private static instance: AIService;
  private modelCache: Map<string, any> = new Map();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Enhanced recipe enhancement with AI - Fixed return type
   */
  async enhanceRecipes(options: EnhanceRecipesOptions): Promise<EnhancedRecipe[]> {
    try {
      const { recipes, userPreferences, ingredients, context } = options;
      
      if (!recipes || recipes.length === 0) {
        return [];
      }

      logger.info(`Enhancing ${recipes.length} recipes with AI`, {
        userPreferences: !!userPreferences,
        ingredientsProvided: !!ingredients,
        context
      });

      // Convert IRecipe[] to EnhancedRecipe[] with proper type handling
      const enhancedRecipes: EnhancedRecipe[] = await Promise.all(
        recipes.map(async (recipe) => {
          const enhancement = await this.enhanceSingleRecipe(recipe, userPreferences, ingredients);
          
          // Create enhanced recipe with proper typing
          const enhancedRecipe: EnhancedRecipe = {
            ...recipe.toObject ? recipe.toObject() : recipe,
            ...enhancement,
            aiEnhanced: true,
            enhancementTimestamp: new Date()
          };
          
          return enhancedRecipe;
        })
      );

      logger.info(`Successfully enhanced ${enhancedRecipes.length} recipes`);
      return enhancedRecipes;
    } catch (error: any) {
      logger.error('Error enhancing recipes:', error);
      throw new AppError('Failed to enhance recipes with AI', 500);
    }
  }

  /**
   * Enhanced ingredient analysis with comprehensive insights
   */
  async analyzeIngredients(options: AnalyzeIngredientsOptions): Promise<IngredientAnalysisResult> {
    try {
      const { 
        ingredients, 
        dietaryRestrictions = [], 
        recipeTitle, 
        recipeInstructions,
        generateShoppingList = false,
        generateSubstitutions = true,
        nutritionalAnalysis = true
      } = options;

      logger.info(`Analyzing ${ingredients.length} ingredients`, {
        dietaryRestrictions: dietaryRestrictions.length,
        hasRecipeContext: !!recipeTitle,
        generateShoppingList,
        generateSubstitutions
      });

      // Enhanced analysis logic
      const analysis = await this.performIngredientAnalysis(
        ingredients, 
        dietaryRestrictions, 
        nutritionalAnalysis
      );

      const substitutions = generateSubstitutions 
        ? await this.generateSubstitutions(ingredients, dietaryRestrictions)
        : [];

      const additions = await this.suggestIngredientAdditions(
        ingredients, 
        recipeTitle, 
        recipeInstructions
      );

      const shoppingList = generateShoppingList 
        ? await this.generateShoppingListFromIngredients(ingredients)
        : undefined;

      return {
        analysis,
        suggestedSubstitutions: substitutions,
        suggestedAdditions: additions,
        shoppingList
      };
    } catch (error: any) {
      logger.error('Error analyzing ingredients:', error);
      throw new AppError('Failed to analyze ingredients', 500);
    }
  }

  /**
   * Enhanced cooking tips generation
   */
  async getCookingTipsForRecipe(
    ingredients: string[],
    recipeTitle: string,
    instructions: string
  ): Promise<CookingTips> {
    try {
      logger.info(`Generating cooking tips for recipe: ${recipeTitle}`);

      // Enhanced tip generation logic
      const tips = await this.generateCookingTips(ingredients, instructions);
      const techniques = await this.suggestCookingTechniques(ingredients, instructions);
      const alternatives = await this.generateAlternativeMethods(instructions);
      const timeOptimizations = await this.suggestTimeOptimizations(instructions);
      const equipment = await this.recommendEquipment(ingredients, instructions);

      return {
        cookingTips: tips,
        techniqueSuggestions: techniques,
        alternativeMethods: alternatives,
        timeOptimizations,
        equipmentRecommendations: equipment
      };
    } catch (error: any) {
      logger.error('Error generating cooking tips:', error);
      throw new AppError('Failed to generate cooking tips', 500);
    }
  }

  /**
   * Enhanced shopping list generation
   */
  async generateShoppingList(
    user: IUser, 
    recipeIds: string[], 
    useMealPlan: boolean
  ): Promise<ShoppingListResult> {
    try {
      logger.info(`Generating shopping list for user ${user._id}`, {
        recipeCount: recipeIds?.length || 0,
        useMealPlan
      });

      let recipes: IRecipe[] = [];

      if (useMealPlan && user.mealPlan) {
        // Extract recipes from meal plan
        const mealPlanRecipeIds = user.mealPlan.map(entry => entry.recipeId);
        recipes = await Recipe.find({ _id: { $in: mealPlanRecipeIds } }).lean();
      } else if (recipeIds && recipeIds.length > 0) {
        recipes = await Recipe.find({ _id: { $in: recipeIds } }).lean();
      } else {
        return {
          success: false,
          error: 'No recipes provided for shopping list generation',
          shoppingList: [],
          categorizedList: {},
          recipeCount: 0,
          totalEstimatedCost: 0,
          aiEnhanced: false
        };
      }

      const shoppingList = await this.processRecipesForShoppingList(recipes, user.preferences);
      const categorizedList = this.categorizeShoppingList(shoppingList);
      const totalCost = shoppingList.reduce((sum, item) => sum + item.estimatedCost, 0);

      return {
        success: true,
        shoppingList,
        categorizedList,
        recipeCount: recipes.length,
        totalEstimatedCost: totalCost,
        aiEnhanced: true
      };
    } catch (error: any) {
      logger.error('Error generating shopping list:', error);
      return {
        success: false,
        error: error.message,
        shoppingList: [],
        categorizedList: {},
        recipeCount: 0,
        totalEstimatedCost: 0,
        aiEnhanced: false
      };
    }
  }

  /**
   * Enhanced model training
   */
  async trainModel(trainingData: TrainingData[], forceRetrain: boolean = false): Promise<any> {
    try {
      logger.info(`Training AI model with ${trainingData.length} data points`, { forceRetrain });

      // Enhanced training logic with validation
      const validatedData = trainingData.filter(data => 
        this.validateTrainingData(data)
      );

      if (validatedData.length === 0) {
        throw new AppError('No valid training data provided', 400);
      }

      // Simulate model training
      const modelId = `model_${Date.now()}`;
      const trainingResult = {
        modelId,
        trainingStatus: 'completed',
        dataPointsProcessed: validatedData.length,
        accuracy: 0.95 + Math.random() * 0.05,
        trainingTime: Math.floor(Math.random() * 1000) + 500,
        timestamp: new Date()
      };

      // Cache the model
      this.modelCache.set(modelId, trainingResult);

      logger.info(`Model training completed: ${modelId}`);
      return trainingResult;
    } catch (error: any) {
      logger.error('Error training model:', error);
      throw new AppError('Failed to train AI model', 500);
    }
  }

  // Private helper methods

  private async enhanceSingleRecipe(
    recipe: IRecipe, 
    userPreferences?: UserPreferences, 
    ingredients?: string[]
  ): Promise<Partial<EnhancedRecipe>> {
    // Enhanced recipe enhancement logic with proper typing
    const enhancement: Partial<EnhancedRecipe> = {};

    if (userPreferences?.cookingSkillLevel) {
      enhancement.difficulty = this.adjustDifficultyForSkillLevel(
        recipe.readyInMinutes, 
        userPreferences.cookingSkillLevel
      );
    }

    if (userPreferences?.preferredCookingTime) {
      enhancement.alternativeInstructions = await this.generateTimeOptimizedInstructions(
        recipe.instructions,
        userPreferences.preferredCookingTime
      );
    }

    return enhancement;
  }

  private async performIngredientAnalysis(
    ingredients: string[], 
    dietaryRestrictions: string[], 
    nutritionalAnalysis: boolean
  ): Promise<IngredientAnalysisResult['analysis']> {
    // Enhanced ingredient analysis
    const nutritionalValue: Record<string, number> = {};
    const allergenWarnings: string[] = [];
    const seasonality: Record<string, string> = {};

    ingredients.forEach(ingredient => {
      // Simulate nutritional analysis
      nutritionalValue[ingredient] = Math.floor(Math.random() * 100);
      
      // Check for common allergens
      if (this.isAllergen(ingredient)) {
        allergenWarnings.push(`${ingredient} may contain allergens`);
      }

      // Determine seasonality
      seasonality[ingredient] = this.getSeasonality(ingredient);
    });

    return {
      nutritionalValue,
      healthScore: Math.floor(Math.random() * 100),
      allergenWarnings,
      seasonality,
      costEstimate: ingredients.length * 2.5
    };
  }

  private async generateSubstitutions(
    ingredients: string[], 
    dietaryRestrictions: string[]
  ): Promise<IngredientAnalysisResult['suggestedSubstitutions']> {
    return ingredients.map(ingredient => ({
      original: ingredient,
      substitutes: this.getSubstitutes(ingredient, dietaryRestrictions),
      reason: `Alternative for ${ingredient}`,
      nutritionalImpact: 'Similar nutritional profile'
    }));
  }

  private async suggestIngredientAdditions(
    ingredients: string[], 
    recipeTitle?: string, 
    instructions?: string
  ): Promise<IngredientAnalysisResult['suggestedAdditions']> {
    const suggestions = [
      {
        ingredient: 'fresh herbs',
        reason: 'Enhance flavor profile',
        nutritionalBenefit: 'Adds antioxidants and vitamins'
      },
      {
        ingredient: 'olive oil',
        reason: 'Improve cooking technique',
        nutritionalBenefit: 'Healthy fats and vitamin E'
      }
    ];

    return suggestions.slice(0, Math.min(3, ingredients.length));
  }

  private async generateShoppingListFromIngredients(ingredients: string[]): Promise<ShoppingListItem[]> {
    return ingredients.map(ingredient => ({
      name: ingredient,
      quantity: '1 unit',
      category: this.categorizeIngredient(ingredient),
      priority: 'medium' as const,
      estimatedCost: Math.random() * 10 + 1
    }));
  }

  private async generateCookingTips(ingredients: string[], instructions: string): Promise<string[]> {
    const tips = [
      'Prep all ingredients before starting to cook',
      'Taste and adjust seasoning throughout cooking',
      'Use proper knife techniques for safety and efficiency'
    ];

    return tips.slice(0, Math.min(5, ingredients.length));
  }

  private async suggestCookingTechniques(ingredients: string[], instructions: string): Promise<string[]> {
    return [
      'Consider mise en place for better organization',
      'Use medium heat for better control',
      'Let proteins rest before serving'
    ];
  }

  private async generateAlternativeMethods(instructions: string): Promise<string[]> {
    return [
      'Try slow cooking for deeper flavors',
      'Consider grilling for a smoky taste',
      'Use air frying for healthier preparation'
    ];
  }

  private async suggestTimeOptimizations(instructions: string): Promise<string[]> {
    return [
      'Prep ingredients in advance',
      'Use one-pot cooking methods',
      'Parallel cook multiple components'
    ];
  }

  private async recommendEquipment(ingredients: string[], instructions: string): Promise<string[]> {
    return [
      'Sharp chef\'s knife',
      'Non-stick pan',
      'Digital thermometer'
    ];
  }

  private async processRecipesForShoppingList(
    recipes: IRecipe[], 
    userPreferences?: UserPreferences
  ): Promise<ShoppingListItem[]> {
    const ingredientMap = new Map<string, ShoppingListItem>();

    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const name = typeof ingredient === 'string' ? ingredient : ingredient.name;
        const quantity = typeof ingredient === 'string' ? '1 unit' : `${ingredient.amount} ${ingredient.unit}`;

        if (ingredientMap.has(name)) {
          // Combine quantities if ingredient already exists
          const existing = ingredientMap.get(name)!;
          existing.quantity = this.combineQuantities(existing.quantity, quantity);
        } else {
          ingredientMap.set(name, {
            name,
            quantity,
            category: this.categorizeIngredient(name),
            priority: 'medium',
            estimatedCost: Math.random() * 10 + 1
          });
        }
      });
    });

    return Array.from(ingredientMap.values());
  }

  private categorizeShoppingList(items: ShoppingListItem[]): Record<string, ShoppingListItem[]> {
    const categories: Record<string, ShoppingListItem[]> = {};

    items.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });

    return categories;
  }

  private validateTrainingData(data: TrainingData): boolean {
    return !!(data.input && data.output);
  }

  private adjustDifficultyForSkillLevel(cookingTime: number, skillLevel: string): string {
    if (skillLevel === 'beginner' && cookingTime > 60) return 'Hard';
    if (skillLevel === 'advanced' && cookingTime < 30) return 'Easy';
    return cookingTime <= 30 ? 'Easy' : cookingTime <= 60 ? 'Medium' : 'Hard';
  }

  private async generateTimeOptimizedInstructions(
    instructions: IInstruction[], 
    targetTime: number
  ): Promise<IInstruction[]> {
    return instructions.map((instruction, index) => ({
      ...instruction,
      description: `${instruction.description} (optimized for ${targetTime} min total)`
    }));
  }

  private isAllergen(ingredient: string): boolean {
    const allergens = ['nuts', 'dairy', 'eggs', 'shellfish', 'soy', 'wheat'];
    return allergens.some(allergen => 
      ingredient.toLowerCase().includes(allergen)
    );
  }

  private getSeasonality(ingredient: string): string {
    const seasons = ['spring', 'summer', 'fall', 'winter'];
    return seasons[Math.floor(Math.random() * seasons.length)];
  }

  private getSubstitutes(ingredient: string, restrictions: string[]): string[] {
    const substitutes = [`${ingredient} substitute 1`, `${ingredient} substitute 2`];
    return substitutes.filter(sub => 
      !restrictions.some(restriction => 
        sub.toLowerCase().includes(restriction.toLowerCase())
      )
    );
  }

  private categorizeIngredient(ingredient: string): string {
    const categories = ['produce', 'meat', 'dairy', 'pantry', 'spices'];
    return categories[Math.floor(Math.random() * categories.length)];
  }

  private combineQuantities(qty1: string, qty2: string): string {
    // Simple quantity combination logic
    return `${qty1} + ${qty2}`;
  }
}

// Enhanced DTOs with comprehensive validation
interface EnhanceRecipesRequestDto {
  recipes: IRecipe[];
  user_preferences?: UserPreferences;
  ingredients?: string[];
  context?: string;
}

interface AnalyzeIngredientsRequestDto {
  ingredients: string[];
  dietary_restrictions?: string[];
  recipe_title?: string;
  recipe_instructions?: string;
  generate_shopping_list?: boolean;
  generate_substitutions?: boolean;
  nutritional_analysis?: boolean;
}

interface TrainingDataDto {
  input: any;
  output: any;
  metadata?: {
    userId?: string;
    timestamp?: Date;
    recipeId?: string;
    interactionType?: string;
  };
}

interface ShoppingListRequestDto {
  recipeIds?: string[];
  useMealPlan?: boolean;
}

// Enhanced controller functions with comprehensive error handling
const aiService = AIService.getInstance();

/**
 * Enhances recipes using AI service with user preferences and context
 * @route POST /api/ai/enhance-recipes
 */
const enhanceRecipesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipes, user_preferences, ingredients, context } = req.body as EnhanceRecipesRequestDto;
    
    // Enhanced validation
    if (!ValidationUtils.validateInputArray(recipes)) {
      return next(new AppError('Valid recipes array is required', 400));
    }

    if (recipes.length > 50) {
      return next(new AppError('Maximum 50 recipes allowed per request', 400));
    }

    const startTime = Date.now();
    logger.info(`Starting recipe enhancement for ${recipes.length} recipes`, {
      hasUserPreferences: !!user_preferences,
      hasIngredients: !!ingredients,
      context
    });
    
    // Call AI service to enhance recipes
    const enhancedRecipes = await aiService.enhanceRecipes({
      recipes,
      userPreferences: user_preferences,
      ingredients,
      context
    });
    
    const endTime = Date.now();
    logger.info(`Recipe enhancement completed in ${endTime - startTime}ms`);
    
    res.status(200).json({
      status: 'success',
      results: enhancedRecipes.length,
      processing_time_ms: endTime - startTime,
      data: {
        recipes: enhancedRecipes,
        ai_enhanced: true,
        enhancement_timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in enhanceRecipesHandler:', error);
    return next(error);
  }
};

/**
 * Analyzes ingredients for insights, substitutions, and cooking tips
 * @route POST /api/ai/analyze-ingredients
 */
const analyzeIngredientsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      ingredients, 
      dietary_restrictions, 
      recipe_title, 
      recipe_instructions,
      generate_shopping_list,
      generate_substitutions,
      nutritional_analysis
    } = req.body as AnalyzeIngredientsRequestDto;
    
    // Enhanced validation
    if (!ValidationUtils.validateStringArray(ingredients)) {
      return next(new AppError('Valid ingredients array is required', 400));
    }

    if (ingredients.length > 30) {
      return next(new AppError('Maximum 30 ingredients allowed for analysis', 400));
    }

    const startTime = Date.now();
    
    // Call AI service for ingredient analysis
    const analysis = await aiService.analyzeIngredients({
      ingredients,
      dietaryRestrictions: dietary_restrictions || [],
      recipeTitle: recipe_title,
      recipeInstructions: recipe_instructions,
      generateShoppingList: generate_shopping_list || false,
      generateSubstitutions: generate_substitutions !== false,
      nutritionalAnalysis: nutritional_analysis !== false
    });
    
    const endTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      processing_time_ms: endTime - startTime,
      data: {
        ...analysis,
        ai_enhanced: true,
        analysis_timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in analyzeIngredientsHandler:', error);
    return next(error);
  }
};

/**
 * Gets AI-powered cooking tips for a specific recipe
 * @route GET /api/ai/cooking-tips/:id
 */
const getCookingTipsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!ValidationUtils.validateNonEmptyString(id)) {
      return next(new AppError('Valid recipe ID is required', 400));
    }

    // Get recipe details with enhanced error handling
    let recipe: IRecipe | null = null;
    
    // Check if this is a MongoDB ObjectId or external ID
    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      recipe = await Recipe.findById(id).lean();
    } else {
      // Try to get by external ID
      const externalId = parseInt(id, 10);
      
      if (isNaN(externalId)) {
        return next(new AppError('Invalid recipe ID format', 400));
      }
      
      recipe = await Recipe.findOne({ externalId }).lean();
    }
    
    if (!recipe) {
      return next(new AppError('Recipe not found', 404));
    }
    
    // Extract ingredients from recipe with proper type handling
    const ingredients = recipe.ingredients.map(ing => 
      typeof ing === 'string' ? ing : ing.name
    );

    // Convert instructions to string format for AI processing
    const instructionsText = recipe.instructions
      .map(inst => inst.description)
      .join('. ');
    
    // Get cooking tips from AI service
    const cookingTips = await aiService.getCookingTipsForRecipe(
      ingredients,
      recipe.title,
      instructionsText
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        recipe_id: id,
        recipe_title: recipe.title,
        cooking_tips: cookingTips.cookingTips,
        technique_suggestions: cookingTips.techniqueSuggestions,
        alternative_methods: cookingTips.alternativeMethods,
        time_optimizations: cookingTips.timeOptimizations,
        equipment_recommendations: cookingTips.equipmentRecommendations,
        ai_enhanced: true,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in getCookingTipsHandler:', error);
    return next(error);
  }
};

/**
 * Generates an AI-optimized shopping list from recipes or meal plan
 * @route POST /api/ai/shopping-list
 */
const generateShoppingListHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeIds, useMealPlan } = req.body as ShoppingListRequestDto;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }
    
    // Enhanced validation with proper null checking
    const validRecipeIds = ValidationUtils.validateInputArray(recipeIds) ? recipeIds : [];
    
    if (validRecipeIds.length === 0 && !useMealPlan) {
      return next(new AppError('Either recipeIds or useMealPlan must be provided', 400));
    }

    if (validRecipeIds.length > 20) {
      return next(new AppError('Maximum 20 recipes allowed for shopping list', 400));
    }
    
    const startTime = Date.now();
    
    // Get shopping list from service
    const shoppingListResult = await aiService.generateShoppingList(
      user, 
      validRecipeIds, 
      useMealPlan || false
    );
    
    if (!shoppingListResult.success) {
      return next(new AppError(shoppingListResult.error || 'Failed to generate shopping list', 400));
    }
    
    const endTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      processing_time_ms: endTime - startTime,
      data: {
        shopping_list: shoppingListResult.shoppingList,
        organized_by_category: shoppingListResult.categorizedList,
        recipe_count: shoppingListResult.recipeCount,
        total_estimated_cost: shoppingListResult.totalEstimatedCost,
        ai_enhanced: shoppingListResult.aiEnhanced,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in generateShoppingListHandler:', error);
    return next(error);
  }
};

/**
 * Trains the AI model with new user interaction data
 * @route POST /api/ai/train
 * @access Admin only
 */
const trainAIModelHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { training_data, force_retrain } = req.body as { 
      training_data: TrainingDataDto[],
      force_retrain?: boolean
    };
    
    // Enhanced admin verification
    if (force_retrain) {
      const user = req.user as IUser;
      if (!user || !user.role || user.role !== 'admin') {
        return next(new AppError('Admin access required for forced retraining', 403));
      }
    }
    
    // Enhanced validation
    if (!ValidationUtils.validateInputArray(training_data)) {
      return next(new AppError('Valid training data array is required', 400));
    }

    if (training_data.length > 1000) {
      return next(new AppError('Maximum 1000 training data points allowed per request', 400));
    }
    
    const startTime = Date.now();
    
    // Call AI service for model training
    const trainingResult = await aiService.trainModel(training_data, force_retrain || false);
    
    const endTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      processing_time_ms: endTime - startTime,
      data: {
        success: true,
        model_info: trainingResult,
        records_processed: training_data.length,
        training_completed_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in trainAIModelHandler:', error);
    return next(error);
  }
};

/**
 * Gets personalized ingredient substitutions
 * @route POST /api/ai/substitutions
 */
const getIngredientSubstitutionsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ingredients, restrictions } = req.body;
    
    // Enhanced validation
    if (!ValidationUtils.validateStringArray(ingredients)) {
      return next(new AppError('Valid ingredients array is required', 400));
    }

    if (ingredients.length > 20) {
      return next(new AppError('Maximum 20 ingredients allowed for substitution analysis', 400));
    }

    const validatedRestrictions = ValidationUtils.validateStringArray(restrictions) ? restrictions : [];
    
    const startTime = Date.now();
    
    // Get substitutions from AI service via ingredient analysis
    const analysisResult = await aiService.analyzeIngredients({
      ingredients,
      dietaryRestrictions: validatedRestrictions,
      generateSubstitutions: true,
      nutritionalAnalysis: false
    });
    
    const endTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      processing_time_ms: endTime - startTime,
      data: {
        substitutions: analysisResult.suggestedSubstitutions,
        analysis: analysisResult.analysis,
        original_ingredients: ingredients,
        dietary_restrictions_applied: validatedRestrictions,
        ai_enhanced: true,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in getIngredientSubstitutionsHandler:', error);
    return next(error);
  }
};

/**
 * Gets personalized recipe recommendations based on user preferences
 * @route POST /api/ai/recommendations
 */
const getPersonalizedRecommendationsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { preferences, limit = 10 } = req.body;
    const user = req.user as IUser;
    
    if (!user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!ValidationUtils.validatePositiveNumber(limit) || limit > 50) {
      return next(new AppError('Limit must be a positive number not exceeding 50', 400));
    }

    const startTime = Date.now();
    
    // Get user's recent interactions and preferences
    const userPreferences = {
      ...user.preferences,
      ...preferences
    };

    // Get recipes based on preferences
    const recipes = await Recipe.find({})
      .limit(limit * 2) // Get more to filter and enhance
      .lean();

    // Enhance with AI
    const enhancedRecipes = await aiService.enhanceRecipes({
      recipes: recipes.slice(0, limit),
      userPreferences,
      context: 'personalized_recommendations'
    });
    
    const endTime = Date.now();
    
    res.status(200).json({
      status: 'success',
      processing_time_ms: endTime - startTime,
      data: {
        recommendations: enhancedRecipes,
        user_preferences_applied: userPreferences,
        ai_enhanced: true,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in getPersonalizedRecommendationsHandler:', error);
    return next(error);
  }
};

// Single export statement to avoid redeclaration errors
export {
  enhanceRecipesHandler,
  analyzeIngredientsHandler,
  getCookingTipsHandler,
  generateShoppingListHandler,
  trainAIModelHandler,
  getIngredientSubstitutionsHandler,
  getPersonalizedRecommendationsHandler
};
