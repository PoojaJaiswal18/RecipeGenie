import mongoose, { Document, Schema, Model } from 'mongoose';

// Ingredient interface
interface IIngredient {
  id: number;
  name: string;
  amount: number;
  unit: string;
  image?: string;
}

// Instruction interface
interface IInstruction {
  step: number;
  description: string;
  equipment?: string[];
}

// Nutrition interface
interface INutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  [key: string]: number;
}

// Recipe interface
export interface IRecipe extends Document {
  externalId: number;             // ID from external API (e.g., Spoonacular)
  title: string;                  // Recipe title
  summary: string;                // Recipe summary
  image: string;                  // URL to recipe image
  readyInMinutes: number;         // Time to prepare
  servings: number;               // Number of servings
  sourceUrl?: string;             // Original source URL
  sourceName?: string;            // Original source name
  dishTypes: string[];            // Types of dish (e.g., main course, dessert)
  cuisines: string[];             // Cuisines (e.g., Italian, Mexican)
  diets: string[];                // Diet types (e.g., vegetarian, gluten-free)
  occasions: string[];            // Occasions suitable for (e.g., Christmas, birthday)
  ingredients: IIngredient[];     // Ingredients list
  instructions: IInstruction[];   // Preparation instructions
  nutrition?: INutrition;         // Nutritional information
  popularity: number;             // Popularity score (can be calculated or from API)
  userRating?: number;            // Average user rating
  userRatingsCount?: number;      // Number of user ratings
  userFavoriteCount?: number;     // How many users favorited this recipe
  createdAt: Date;                // When recipe was added to our database
  updatedAt: Date;                // When recipe was last updated
}

// Recipe model interface
interface IRecipeModel extends Model<IRecipe> {
  // Add any static methods here if needed
  findByExternalId(id: number): Promise<IRecipe | null>;
}

// Recipe schema
const recipeSchema = new Schema<IRecipe, IRecipeModel>(
  {
    externalId: {
      type: Number,
      required: true,
      unique: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    summary: {
      type: String,
      required: true
    },
    image: {
      type: String,
      required: true
    },
    readyInMinutes: {
      type: Number,
      required: true,
      min: 0
    },
    servings: {
      type: Number,
      required: true,
      min: 1
    },
    sourceUrl: String,
    sourceName: String,
    dishTypes: [String],
    cuisines: [String],
    diets: [String],
    occasions: [String],
    ingredients: [
      {
        id: Number,
        name: {
          type: String,
          required: true
        },
        amount: {
          type: Number,
          required: true,
          min: 0
        },
        unit: {
          type: String,
          required: true
        },
        image: String
      }
    ],
    instructions: [
      {
        step: {
          type: Number,
          required: true
        },
        description: {
          type: String,
          required: true
        },
        equipment: [String]
      }
    ],
    nutrition: {
      calories: Number,
      protein: Number,
      fat: Number,
      carbs: Number
    },
    popularity: {
      type: Number,
      default: 0
    },
    userRating: {
      type: Number,
      min: 0,
      max: 5
    },
    userRatingsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    userFavoriteCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
recipeSchema.index({ externalId: 1 });
recipeSchema.index({ title: 'text', summary: 'text' });
recipeSchema.index({ cuisines: 1 });
recipeSchema.index({ diets: 1 });
recipeSchema.index({ 'ingredients.name': 1 });
recipeSchema.index({ popularity: -1 });
recipeSchema.index({ userRating: -1 });

// Static method to find recipe by external ID
recipeSchema.statics.findByExternalId = async function(id: number): Promise<IRecipe | null> {
  return this.findOne({ externalId: id });
};

// Create compound text index for advanced search
recipeSchema.index({
  title: 'text',
  summary: 'text',
  'ingredients.name': 'text',
  cuisines: 'text',
  diets: 'text',
  dishTypes: 'text'
});

// Virtual property for average cooking difficulty
recipeSchema.virtual('difficulty').get(function(this: IRecipe) {
  if (this.readyInMinutes <= 15) return 'Easy';
  if (this.readyInMinutes <= 45) return 'Medium';
  return 'Hard';
});

// Create and export Recipe model
const Recipe = mongoose.model<IRecipe, IRecipeModel>('Recipe', recipeSchema);

export default Recipe;