import mongoose, { Document, Schema, Model, FilterQuery, UpdateQuery, Types } from 'mongoose';
import winston from 'winston';

// Enhanced logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/recipe-repository.log',
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

// Enhanced interfaces and types with proper Mongoose typing
interface NutritionalInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

// Base interfaces without Document extension for clean typing
interface IIngredientBase {
  name: string;
  category: string;
  nutritionalInfo?: NutritionalInfo;
  allergens: string[];
}

interface ICuisineBase {
  name: string;
  description?: string;
  region: string;
}

interface IDietaryRestrictionBase {
  name: string;
  description?: string;
  type: 'ALLERGY' | 'PREFERENCE' | 'MEDICAL';
}

interface IRecipeBase {
  name: string;
  description: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  caloriesPerServing: number;
  rating: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  imageUrl?: string;
  instructions: string[];
  ingredients: Types.ObjectId[];
  cuisines: Types.ObjectId[];
  dietaryRestrictions: Types.ObjectId[];
  nutritionalInfo?: NutritionalInfo;
  popularity: number;
  viewCount: number;
  favoriteCount: number;
}

// Document interfaces extending base interfaces
interface IIngredient extends IIngredientBase, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface ICuisine extends ICuisineBase, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface IDietaryRestriction extends IDietaryRestrictionBase, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface IRecipe extends IRecipeBase, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Populated recipe interface with proper typing
interface IPopulatedRecipe extends Omit<IRecipeBase, 'ingredients' | 'cuisines' | 'dietaryRestrictions'> {
  _id: Types.ObjectId;
  ingredients: IIngredientBase[];
  cuisines: ICuisineBase[];
  dietaryRestrictions: IDietaryRestrictionBase[];
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced search parameters interface
interface RecipeSearchParams {
  query?: string;
  ingredientIds?: string[];
  cuisineIds?: string[];
  dietaryRestrictionIds?: string[];
  prepTimeMax?: number;
  cookTimeMax?: number;
  caloriesMin?: number;
  caloriesMax?: number;
  skipIngredientIds?: string[];
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  rating?: number;
  page?: number;
  limit?: number;
  sortBy?: 'rating' | 'prepTime' | 'calories' | 'createdAt' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

// Enhanced DTOs
interface CreateRecipeData {
  name: string;
  description: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  caloriesPerServing: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  imageUrl?: string;
  instructions: string[];
  ingredientIds: string[];
  cuisineIds: string[];
  dietaryRestrictionIds: string[];
  nutritionalInfo?: NutritionalInfo;
}

interface UpdateRecipeData {
  name?: string;
  description?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  servings?: number;
  caloriesPerServing?: number;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  imageUrl?: string;
  instructions?: string[];
  ingredientIds?: string[];
  cuisineIds?: string[];
  dietaryRestrictionIds?: string[];
  nutritionalInfo?: NutritionalInfo;
}

interface NutritionSearchParams {
  maxCalories?: number;
  minProtein?: number;
  maxCarbs?: number;
  maxFat?: number;
  minFiber?: number;
  maxSodium?: number;
}

// Enhanced repository interface
interface IRecipeRepository {
  findById(id: string): Promise<IPopulatedRecipe | null>;
  searchRecipes(params: RecipeSearchParams): Promise<IPopulatedRecipe[]>;
  getRecipesByIngredients(ingredientIds: string[], limit?: number): Promise<IPopulatedRecipe[]>;
  getRecipesByDietaryRestriction(dietaryRestrictionId: string, limit?: number): Promise<IPopulatedRecipe[]>;
  getRecipesByCuisine(cuisineId: string, limit?: number): Promise<IPopulatedRecipe[]>;
  createRecipe(recipeData: CreateRecipeData): Promise<IPopulatedRecipe>;
  updateRecipe(id: string, recipeData: UpdateRecipeData): Promise<IPopulatedRecipe>;
  deleteRecipe(id: string): Promise<void>;
  getPopularRecipes(limit?: number): Promise<IPopulatedRecipe[]>;
  getRecentRecipes(limit?: number): Promise<IPopulatedRecipe[]>;
  searchRecipesByNutrition(nutritionParams: NutritionSearchParams): Promise<IPopulatedRecipe[]>;
  getRecipeCount(): Promise<number>;
  getRecipesByComplexity(difficulty: string, limit?: number): Promise<IPopulatedRecipe[]>;
  incrementViewCount(id: string): Promise<void>;
  incrementFavoriteCount(id: string): Promise<void>;
  decrementFavoriteCount(id: string): Promise<void>;
}

// Enhanced Mongoose Schemas
const nutritionalInfoSchema = new Schema<NutritionalInfo>({
  calories: { type: Number, required: true, min: 0 },
  protein: { type: Number, required: true, min: 0 },
  carbs: { type: Number, required: true, min: 0 },
  fat: { type: Number, required: true, min: 0 },
  fiber: { type: Number, required: true, min: 0 },
  sugar: { type: Number, required: true, min: 0 },
  sodium: { type: Number, required: true, min: 0 }
}, { _id: false });

const ingredientSchema = new Schema<IIngredient>({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, trim: true, maxlength: 50 },
  nutritionalInfo: nutritionalInfoSchema,
  allergens: [{ type: String, trim: true, maxlength: 50 }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const cuisineSchema = new Schema<ICuisine>({
  name: { type: String, required: true, trim: true, maxlength: 100, unique: true },
  description: { type: String, trim: true, maxlength: 500 },
  region: { type: String, required: true, trim: true, maxlength: 100 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const dietaryRestrictionSchema = new Schema<IDietaryRestriction>({
  name: { type: String, required: true, trim: true, maxlength: 100, unique: true },
  description: { type: String, trim: true, maxlength: 500 },
  type: { 
    type: String, 
    required: true, 
    enum: ['ALLERGY', 'PREFERENCE', 'MEDICAL'] 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const recipeSchema = new Schema<IRecipe>({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 1000 },
  prepTimeMinutes: { type: Number, required: true, min: 0, max: 1440 },
  cookTimeMinutes: { type: Number, required: true, min: 0, max: 1440 },
  servings: { type: Number, required: true, min: 1, max: 50 },
  caloriesPerServing: { type: Number, required: true, min: 0, max: 5000 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  difficulty: { 
    type: String, 
    required: true, 
    enum: ['EASY', 'MEDIUM', 'HARD'] 
  },
  imageUrl: { type: String, trim: true, maxlength: 500 },
  instructions: [{ 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 1000 
  }],
  ingredients: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Ingredient',
    required: true 
  }],
  cuisines: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Cuisine',
    required: true 
  }],
  dietaryRestrictions: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'DietaryRestriction' 
  }],
  nutritionalInfo: nutritionalInfoSchema,
  popularity: { type: Number, default: 0, min: 0 },
  viewCount: { type: Number, default: 0, min: 0 },
  favoriteCount: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enhanced indexes for performance
recipeSchema.index({ name: 'text', description: 'text' });
recipeSchema.index({ rating: -1 });
recipeSchema.index({ popularity: -1 });
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ difficulty: 1 });
recipeSchema.index({ prepTimeMinutes: 1 });
recipeSchema.index({ cookTimeMinutes: 1 });
recipeSchema.index({ caloriesPerServing: 1 });
recipeSchema.index({ ingredients: 1 });
recipeSchema.index({ cuisines: 1 });
recipeSchema.index({ dietaryRestrictions: 1 });

ingredientSchema.index({ name: 'text' });
ingredientSchema.index({ category: 1 });

cuisineSchema.index({ name: 1 });
cuisineSchema.index({ region: 1 });

dietaryRestrictionSchema.index({ name: 1 });
dietaryRestrictionSchema.index({ type: 1 });

// Create models
const RecipeModel = mongoose.model<IRecipe>('Recipe', recipeSchema);
const IngredientModel = mongoose.model<IIngredient>('Ingredient', ingredientSchema);
const CuisineModel = mongoose.model<ICuisine>('Cuisine', cuisineSchema);
const DietaryRestrictionModel = mongoose.model<IDietaryRestriction>('DietaryRestriction', dietaryRestrictionSchema);

// Helper function to transform populated documents with proper typing
const transformToPopulatedRecipe = (doc: any): IPopulatedRecipe => {
  return {
    _id: doc._id,
    name: doc.name,
    description: doc.description,
    prepTimeMinutes: doc.prepTimeMinutes,
    cookTimeMinutes: doc.cookTimeMinutes,
    servings: doc.servings,
    caloriesPerServing: doc.caloriesPerServing,
    rating: doc.rating,
    difficulty: doc.difficulty,
    imageUrl: doc.imageUrl,
    instructions: doc.instructions,
    ingredients: doc.ingredients || [],
    cuisines: doc.cuisines || [],
    dietaryRestrictions: doc.dietaryRestrictions || [],
    nutritionalInfo: doc.nutritionalInfo,
    popularity: doc.popularity,
    viewCount: doc.viewCount,
    favoriteCount: doc.favoriteCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
};

export class RecipeRepository implements IRecipeRepository {
  private readonly logger = logger;

  constructor() {
    this.initializeConnection();
  }

  /**
   * Initialize database connection with enhanced error handling
   */
  private async initializeConnection(): Promise<void> {
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recipegenie', {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        this.logger.info('Database connection established successfully');
      }
    } catch (error: any) {
      this.logger.error('Failed to establish database connection:', error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Find a recipe by its unique ID with enhanced error handling
   */
  async findById(id: string): Promise<IPopulatedRecipe | null> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid recipe ID provided');
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        this.logger.info(`Invalid ObjectId format: ${id}`);
        return null;
      }

      const recipe = await RecipeModel.findById(id)
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .lean()
        .exec();

      if (!recipe) {
        this.logger.info(`Recipe not found with id: ${id}`);
        return null;
      }

      this.logger.debug(`Successfully retrieved recipe: ${recipe.name}`);
      return transformToPopulatedRecipe(recipe);
    } catch (error: any) {
      this.logger.error(`Error fetching recipe with id ${id}:`, error);
      throw new Error(`Failed to fetch recipe: ${error.message}`);
    }
  }

  /**
   * Search recipes with enhanced filtering and pagination
   */
  async searchRecipes(params: RecipeSearchParams): Promise<IPopulatedRecipe[]> {
    const {
      query,
      ingredientIds,
      cuisineIds,
      dietaryRestrictionIds,
      prepTimeMax,
      cookTimeMax,
      caloriesMin,
      caloriesMax,
      skipIngredientIds,
      difficulty,
      rating,
      page = 1,
      limit = 20,
      sortBy = 'rating',
      sortOrder = 'desc'
    } = params;

    try {
      // Enhanced validation
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(Math.max(1, limit), 100);
      const skip = (validatedPage - 1) * validatedLimit;

      // Build enhanced filter conditions
      const filterQuery: FilterQuery<IRecipe> = {};

      // Text search with enhanced matching
      if (query && query.trim()) {
        filterQuery.$or = [
          { name: { $regex: query.trim(), $options: 'i' } },
          { description: { $regex: query.trim(), $options: 'i' } },
          { $text: { $search: query.trim() } }
        ];
      }

      // Ingredient filtering with enhanced logic
      if (ingredientIds?.length) {
        const validIngredientIds = ingredientIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIngredientIds.length > 0) {
          filterQuery.ingredients = { $in: validIngredientIds };
        }
      }

      // Skip unwanted ingredients
      if (skipIngredientIds?.length) {
        const validSkipIds = skipIngredientIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validSkipIds.length > 0) {
          filterQuery.ingredients = { 
            ...filterQuery.ingredients,
            $nin: validSkipIds 
          };
        }
      }

      // Cuisine filtering
      if (cuisineIds?.length) {
        const validCuisineIds = cuisineIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validCuisineIds.length > 0) {
          filterQuery.cuisines = { $in: validCuisineIds };
        }
      }

      // Dietary restriction filtering
      if (dietaryRestrictionIds?.length) {
        const validRestrictionIds = dietaryRestrictionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validRestrictionIds.length > 0) {
          filterQuery.dietaryRestrictions = { $in: validRestrictionIds };
        }
      }

      // Time-based filtering
      if (prepTimeMax) {
        filterQuery.prepTimeMinutes = { $lte: prepTimeMax };
      }

      if (cookTimeMax) {
        filterQuery.cookTimeMinutes = { $lte: cookTimeMax };
      }

      // Calorie filtering
      if (caloriesMin || caloriesMax) {
        filterQuery.caloriesPerServing = {};
        if (caloriesMin) filterQuery.caloriesPerServing.$gte = caloriesMin;
        if (caloriesMax) filterQuery.caloriesPerServing.$lte = caloriesMax;
      }

      // Difficulty filtering
      if (difficulty) {
        filterQuery.difficulty = difficulty;
      }

      // Rating filtering
      if (rating) {
        filterQuery.rating = { $gte: rating };
      }

      // Enhanced sorting options
      const sortOptions: Record<string, 1 | -1> = {};
      switch (sortBy) {
        case 'rating':
          sortOptions.rating = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'prepTime':
          sortOptions.prepTimeMinutes = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'calories':
          sortOptions.caloriesPerServing = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'createdAt':
          sortOptions.createdAt = sortOrder === 'asc' ? 1 : -1;
          break;
        case 'popularity':
          sortOptions.popularity = sortOrder === 'asc' ? 1 : -1;
          break;
        default:
          sortOptions.rating = -1;
      }

      const recipes = await RecipeModel.find(filterQuery)
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort(sortOptions)
        .skip(skip)
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Found ${recipes.length} recipes matching search criteria`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error('Error searching recipes:', error);
      throw new Error(`Recipe search failed: ${error.message}`);
    }
  }

  /**
   * Get recipes by ingredient IDs with enhanced recommendations
   */
  async getRecipesByIngredients(ingredientIds: string[], limit: number = 10): Promise<IPopulatedRecipe[]> {
    try {
      if (!ingredientIds?.length) {
        throw new Error('At least one ingredient ID is required');
      }

      const validIngredientIds = ingredientIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIngredientIds.length === 0) {
        throw new Error('No valid ingredient IDs provided');
      }

      const validatedLimit = Math.min(Math.max(1, limit), 50);

      const recipes = await RecipeModel.find({
        ingredients: { $in: validIngredientIds }
      })
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ rating: -1, createdAt: -1 })
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Found ${recipes.length} recipes with specified ingredients`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error('Error fetching recipes by ingredients:', error);
      throw new Error(`Failed to fetch recipes by ingredients: ${error.message}`);
    }
  }

  /**
   * Get recipes suitable for a specific dietary restriction
   */
  async getRecipesByDietaryRestriction(dietaryRestrictionId: string, limit: number = 20): Promise<IPopulatedRecipe[]> {
    try {
      if (!dietaryRestrictionId || typeof dietaryRestrictionId !== 'string') {
        throw new Error('Valid dietary restriction ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(dietaryRestrictionId)) {
        throw new Error('Invalid dietary restriction ID format');
      }

      const validatedLimit = Math.min(Math.max(1, limit), 50);

      const recipes = await RecipeModel.find({
        dietaryRestrictions: dietaryRestrictionId
      })
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ rating: -1, createdAt: -1 })
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Found ${recipes.length} recipes for dietary restriction: ${dietaryRestrictionId}`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error(`Error fetching recipes by dietary restriction: ${dietaryRestrictionId}`, error);
      throw new Error(`Failed to fetch recipes by dietary restriction: ${error.message}`);
    }
  }

  /**
   * Get recipes by cuisine with enhanced filtering
   */
  async getRecipesByCuisine(cuisineId: string, limit: number = 20): Promise<IPopulatedRecipe[]> {
    try {
      if (!cuisineId || typeof cuisineId !== 'string') {
        throw new Error('Valid cuisine ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(cuisineId)) {
        throw new Error('Invalid cuisine ID format');
      }

      const validatedLimit = Math.min(Math.max(1, limit), 50);

      const recipes = await RecipeModel.find({
        cuisines: cuisineId
      })
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ rating: -1, prepTimeMinutes: 1 })
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Found ${recipes.length} recipes for cuisine: ${cuisineId}`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error(`Error fetching recipes by cuisine: ${cuisineId}`, error);
      throw new Error(`Failed to fetch recipes by cuisine: ${error.message}`);
    }
  }

  /**
   * Create a new recipe with enhanced validation
   */
  async createRecipe(recipeData: CreateRecipeData): Promise<IPopulatedRecipe> {
    try {
      // Enhanced validation
      this.validateRecipeData(recipeData);

      // Validate ingredient IDs
      const validIngredientIds = recipeData.ingredientIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIngredientIds.length !== recipeData.ingredientIds.length) {
        throw new Error('Some ingredient IDs are invalid');
      }

      // Validate cuisine IDs
      const validCuisineIds = recipeData.cuisineIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validCuisineIds.length !== recipeData.cuisineIds.length) {
        throw new Error('Some cuisine IDs are invalid');
      }

      // Validate dietary restriction IDs
      const validRestrictionIds = recipeData.dietaryRestrictionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validRestrictionIds.length !== recipeData.dietaryRestrictionIds.length) {
        throw new Error('Some dietary restriction IDs are invalid');
      }

      const recipe = new RecipeModel({
        ...recipeData,
        ingredients: validIngredientIds,
        cuisines: validCuisineIds,
        dietaryRestrictions: validRestrictionIds
      });

      const savedRecipe = await recipe.save();
      
      const populatedRecipe = await RecipeModel.findById(savedRecipe._id)
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .lean()
        .exec();

      if (!populatedRecipe) {
        throw new Error('Failed to retrieve created recipe');
      }

      this.logger.info(`Successfully created recipe: ${savedRecipe.name}`);
      return transformToPopulatedRecipe(populatedRecipe);
    } catch (error: any) {
      this.logger.error('Error creating recipe:', error);
      throw new Error(`Failed to create recipe: ${error.message}`);
    }
  }

  /**
   * Update an existing recipe with enhanced validation
   */
  async updateRecipe(id: string, recipeData: UpdateRecipeData): Promise<IPopulatedRecipe> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Valid recipe ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid recipe ID format');
      }

      // Check if recipe exists
      const existingRecipe = await RecipeModel.findById(id);
      if (!existingRecipe) {
        throw new Error(`Recipe with ID ${id} not found`);
      }

      // Build update data with enhanced validation
      const updateData: UpdateQuery<IRecipe> = { ...recipeData };

      // Validate and update ingredient IDs if provided
      if (recipeData.ingredientIds) {
        const validIngredientIds = recipeData.ingredientIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIngredientIds.length !== recipeData.ingredientIds.length) {
          throw new Error('Some ingredient IDs are invalid');
        }
        updateData.ingredients = validIngredientIds;
        delete updateData.ingredientIds;
      }

      // Validate and update cuisine IDs if provided
      if (recipeData.cuisineIds) {
        const validCuisineIds = recipeData.cuisineIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validCuisineIds.length !== recipeData.cuisineIds.length) {
          throw new Error('Some cuisine IDs are invalid');
        }
        updateData.cuisines = validCuisineIds;
        delete updateData.cuisineIds;
      }

      // Validate and update dietary restriction IDs if provided
      if (recipeData.dietaryRestrictionIds) {
        const validRestrictionIds = recipeData.dietaryRestrictionIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validRestrictionIds.length !== recipeData.dietaryRestrictionIds.length) {
          throw new Error('Some dietary restriction IDs are invalid');
        }
        updateData.dietaryRestrictions = validRestrictionIds;
        delete updateData.dietaryRestrictionIds;
      }

      const updatedRecipe = await RecipeModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .lean()
        .exec();

      if (!updatedRecipe) {
        throw new Error('Failed to update recipe');
      }

      this.logger.info(`Successfully updated recipe: ${updatedRecipe.name}`);
      return transformToPopulatedRecipe(updatedRecipe);
    } catch (error: any) {
      this.logger.error(`Error updating recipe with id ${id}:`, error);
      throw new Error(`Failed to update recipe: ${error.message}`);
    }
  }

  /**
   * Delete a recipe with enhanced validation
   */
  async deleteRecipe(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string') {
        throw new Error('Valid recipe ID is required');
      }

      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Invalid recipe ID format');
      }

      const deletedRecipe = await RecipeModel.findByIdAndDelete(id);
      if (!deletedRecipe) {
        throw new Error(`Recipe with ID ${id} not found`);
      }

      this.logger.info(`Successfully deleted recipe with id: ${id}`);
    } catch (error: any) {
      this.logger.error(`Error deleting recipe with id ${id}:`, error);
      throw new Error(`Failed to delete recipe: ${error.message}`);
    }
  }

  /**
   * Get popular recipes based on rating and engagement
   */
  async getPopularRecipes(limit: number = 10): Promise<IPopulatedRecipe[]> {
    try {
      const validatedLimit = Math.min(Math.max(1, limit), 50);

      const recipes = await RecipeModel.find({
        rating: { $gte: 4.0 }
      })
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ rating: -1, popularity: -1, createdAt: -1 })
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Retrieved ${recipes.length} popular recipes`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error('Error fetching popular recipes:', error);
      throw new Error(`Failed to fetch popular recipes: ${error.message}`);
    }
  }

  /**
   * Get recently created recipes
   */
  async getRecentRecipes(limit: number = 10): Promise<IPopulatedRecipe[]> {
    try {
      const validatedLimit = Math.min(Math.max(1, limit), 50);

      const recipes = await RecipeModel.find()
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ createdAt: -1 })
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Retrieved ${recipes.length} recent recipes`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error('Error fetching recent recipes:', error);
      throw new Error(`Failed to fetch recent recipes: ${error.message}`);
    }
  }

  /**
   * Search recipes by nutritional criteria
   */
  async searchRecipesByNutrition(nutritionParams: NutritionSearchParams): Promise<IPopulatedRecipe[]> {
    try {
      const {
        maxCalories,
        minProtein,
        maxCarbs,
        maxFat,
        minFiber,
        maxSodium
      } = nutritionParams;

      const filterQuery: FilterQuery<IRecipe> = {};

      if (maxCalories) {
        filterQuery.caloriesPerServing = { $lte: maxCalories };
      }

      if (minProtein || maxCarbs || maxFat || minFiber || maxSodium) {
        const nutritionFilter: any = {};
        
        if (minProtein) nutritionFilter['nutritionalInfo.protein'] = { $gte: minProtein };
        if (maxCarbs) nutritionFilter['nutritionalInfo.carbs'] = { $lte: maxCarbs };
        if (maxFat) nutritionFilter['nutritionalInfo.fat'] = { $lte: maxFat };
        if (minFiber) nutritionFilter['nutritionalInfo.fiber'] = { $gte: minFiber };
        if (maxSodium) nutritionFilter['nutritionalInfo.sodium'] = { $lte: maxSodium };

        Object.assign(filterQuery, nutritionFilter);
      }

      const recipes = await RecipeModel.find(filterQuery)
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ rating: -1 })
        .lean()
        .exec();

      this.logger.info(`Found ${recipes.length} recipes matching nutrition criteria`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error('Error searching recipes by nutrition:', error);
      throw new Error(`Failed to search recipes by nutrition: ${error.message}`);
    }
  }

  /**
   * Get total recipe count
   */
  async getRecipeCount(): Promise<number> {
    try {
      const count = await RecipeModel.countDocuments();
      this.logger.debug(`Total recipe count: ${count}`);
      return count;
    } catch (error: any) {
      this.logger.error('Error getting recipe count:', error);
      throw new Error(`Failed to get recipe count: ${error.message}`);
    }
  }

  /**
   * Get recipes by complexity/difficulty level
   */
  async getRecipesByComplexity(difficulty: string, limit: number = 20): Promise<IPopulatedRecipe[]> {
    try {
      if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
        throw new Error('Invalid difficulty level. Must be EASY, MEDIUM, or HARD');
      }

      const validatedLimit = Math.min(Math.max(1, limit), 50);

      const recipes = await RecipeModel.find({
        difficulty: difficulty as 'EASY' | 'MEDIUM' | 'HARD'
      })
        .populate<{ ingredients: IIngredientBase[] }>('ingredients')
        .populate<{ cuisines: ICuisineBase[] }>('cuisines')
        .populate<{ dietaryRestrictions: IDietaryRestrictionBase[] }>('dietaryRestrictions')
        .sort({ rating: -1, prepTimeMinutes: 1 })
        .limit(validatedLimit)
        .lean()
        .exec();

      this.logger.info(`Found ${recipes.length} recipes with ${difficulty} difficulty`);
      return recipes.map(transformToPopulatedRecipe);
    } catch (error: any) {
      this.logger.error(`Error fetching recipes by complexity: ${difficulty}`, error);
      throw new Error(`Failed to fetch recipes by complexity: ${error.message}`);
    }
  }

  /**
   * Increment view count for a recipe
   */
  async incrementViewCount(id: string): Promise<void> {
    try {
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Valid recipe ID is required');
      }

      await RecipeModel.findByIdAndUpdate(
        id,
        { $inc: { viewCount: 1 } },
        { new: true }
      );

      this.logger.debug(`Incremented view count for recipe: ${id}`);
    } catch (error: any) {
      this.logger.error(`Error incrementing view count for recipe ${id}:`, error);
      throw new Error(`Failed to increment view count: ${error.message}`);
    }
  }

  /**
   * Increment favorite count for a recipe
   */
  async incrementFavoriteCount(id: string): Promise<void> {
    try {
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Valid recipe ID is required');
      }

      await RecipeModel.findByIdAndUpdate(
        id,
        { $inc: { favoriteCount: 1 } },
        { new: true }
      );

      this.logger.debug(`Incremented favorite count for recipe: ${id}`);
    } catch (error: any) {
      this.logger.error(`Error incrementing favorite count for recipe ${id}:`, error);
      throw new Error(`Failed to increment favorite count: ${error.message}`);
    }
  }

  /**
   * Decrement favorite count for a recipe
   */
  async decrementFavoriteCount(id: string): Promise<void> {
    try {
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new Error('Valid recipe ID is required');
      }

      await RecipeModel.findByIdAndUpdate(
        id,
        { $inc: { favoriteCount: -1 } },
        { new: true }
      );

      this.logger.debug(`Decremented favorite count for recipe: ${id}`);
    } catch (error: any) {
      this.logger.error(`Error decrementing favorite count for recipe ${id}:`, error);
      throw new Error(`Failed to decrement favorite count: ${error.message}`);
    }
  }

  /**
   * Enhanced validation for recipe data
   */
  private validateRecipeData(recipeData: CreateRecipeData): void {
    const {
      name,
      description,
      prepTimeMinutes,
      cookTimeMinutes,
      servings,
      caloriesPerServing,
      difficulty,
      instructions,
      ingredientIds,
      cuisineIds,
      dietaryRestrictionIds
    } = recipeData;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Recipe name is required and must be a non-empty string');
    }

    if (name.length > 200) {
      throw new Error('Recipe name must not exceed 200 characters');
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      throw new Error('Recipe description is required and must be a non-empty string');
    }

    if (description.length > 1000) {
      throw new Error('Recipe description must not exceed 1000 characters');
    }

    if (!Number.isInteger(prepTimeMinutes) || prepTimeMinutes < 0 || prepTimeMinutes > 1440) {
      throw new Error('Prep time must be a non-negative integer not exceeding 1440 minutes');
    }

    if (!Number.isInteger(cookTimeMinutes) || cookTimeMinutes < 0 || cookTimeMinutes > 1440) {
      throw new Error('Cook time must be a non-negative integer not exceeding 1440 minutes');
    }

    if (!Number.isInteger(servings) || servings <= 0 || servings > 50) {
      throw new Error('Servings must be a positive integer not exceeding 50');
    }

    if (!Number.isInteger(caloriesPerServing) || caloriesPerServing < 0 || caloriesPerServing > 5000) {
      throw new Error('Calories per serving must be a non-negative integer not exceeding 5000');
    }

    if (!['EASY', 'MEDIUM', 'HARD'].includes(difficulty)) {
      throw new Error('Difficulty must be EASY, MEDIUM, or HARD');
    }

    if (!Array.isArray(instructions) || instructions.length === 0) {
      throw new Error('Instructions must be a non-empty array');
    }

    if (instructions.some(inst => typeof inst !== 'string' || inst.trim().length === 0)) {
      throw new Error('All instructions must be non-empty strings');
    }

    if (instructions.some(inst => inst.length > 1000)) {
      throw new Error('Each instruction must not exceed 1000 characters');
    }

    if (!Array.isArray(ingredientIds) || ingredientIds.length === 0) {
      throw new Error('At least one ingredient is required');
    }

    if (!Array.isArray(cuisineIds) || cuisineIds.length === 0) {
      throw new Error('At least one cuisine is required');
    }

    if (!Array.isArray(dietaryRestrictionIds)) {
      throw new Error('Dietary restrictions must be an array');
    }
  }

  /**
   * Cleanup database connections
   */
  async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      this.logger.info('Database connection closed successfully');
    } catch (error: any) {
      this.logger.error('Error closing database connection:', error);
      throw new Error(`Failed to close database connection: ${error.message}`);
    }
  }
}

// Export types and interfaces
export {
  IRecipe,
  IIngredient,
  ICuisine,
  IDietaryRestriction,
  IPopulatedRecipe,
  RecipeSearchParams,
  IRecipeRepository,
  CreateRecipeData,
  UpdateRecipeData,
  NutritionSearchParams,
  NutritionalInfo,
  RecipeModel,
  IngredientModel,
  CuisineModel,
  DietaryRestrictionModel
};

// Export default repository
export default RecipeRepository;
