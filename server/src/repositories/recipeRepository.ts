import { PrismaClient, Recipe, Ingredient, Cuisine, DietaryRestriction } from '@prisma/client';
import { injectable } from 'inversify';
import { IRecipeRepository } from '../interfaces/IRecipeRepository';
import { RecipeSearchParams } from '../dto/recipeDto';
import { Logger } from '../utils/logger';

@injectable()
export class RecipeRepository implements IRecipeRepository {
  private prisma: PrismaClient;
  private logger: Logger;

  constructor(logger: Logger) {
    this.prisma = new PrismaClient();
    this.logger = logger;
  }

  /**
   * Find a recipe by its unique ID
   */
  async findById(id: string): Promise<Recipe | null> {
    try {
      return await this.prisma.recipe.findUnique({
        where: { id },
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error fetching recipe with id ${id}`, error);
      throw error;
    }
  }

  /**
   * Search recipes with complex filtering options
   */
  async searchRecipes(params: RecipeSearchParams): Promise<Recipe[]> {
    const {
      query,
      ingredientIds,
      cuisineIds,
      dietaryRestrictionIds,
      prepTimeMax,
      caloriesMin,
      caloriesMax,
      skipIngredientIds,
      page = 1,
      limit = 20,
    } = params;

    try {
      const skip = (page - 1) * limit;

      // Build filter conditions
      const whereClause: any = {
        AND: [],
      };

      if (query) {
        whereClause.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ];
      }

      if (ingredientIds?.length) {
        whereClause.AND.push({
          ingredients: {
            some: {
              id: { in: ingredientIds },
            },
          },
        });
      }

      if (skipIngredientIds?.length) {
        whereClause.AND.push({
          ingredients: {
            none: {
              id: { in: skipIngredientIds },
            },
          },
        });
      }

      if (cuisineIds?.length) {
        whereClause.AND.push({
          cuisines: {
            some: {
              id: { in: cuisineIds },
            },
          },
        });
      }

      if (dietaryRestrictionIds?.length) {
        whereClause.AND.push({
          dietaryRestrictions: {
            some: {
              id: { in: dietaryRestrictionIds },
            },
          },
        });
      }

      if (prepTimeMax) {
        whereClause.AND.push({
          prepTimeMinutes: { lte: prepTimeMax },
        });
      }

      if (caloriesMin || caloriesMax) {
        const caloriesFilter: any = {};
        if (caloriesMin) caloriesFilter.gte = caloriesMin;
        if (caloriesMax) caloriesFilter.lte = caloriesMax;
        whereClause.AND.push({ caloriesPerServing: caloriesFilter });
      }

      // If AND array is empty, remove it
      if (whereClause.AND.length === 0) {
        delete whereClause.AND;
      }

      return await this.prisma.recipe.findMany({
        where: whereClause,
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
        skip,
        take: limit,
        orderBy: {
          rating: 'desc',
        },
      });
    } catch (error) {
      this.logger.error('Error searching recipes', error);
      throw error;
    }
  }

  /**
   * Get recipes by ingredient IDs (for recommendations)
   */
  async getRecipesByIngredients(ingredientIds: string[], limit = 10): Promise<Recipe[]> {
    try {
      return await this.prisma.recipe.findMany({
        where: {
          ingredients: {
            some: {
              id: { in: ingredientIds },
            },
          },
        },
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
        take: limit,
        orderBy: {
          rating: 'desc',
        },
      });
    } catch (error) {
      this.logger.error('Error fetching recipes by ingredients', error);
      throw error;
    }
  }

  /**
   * Get recipes suitable for a specific diet type
   */
  async getRecipesByDietaryRestriction(dietaryRestrictionId: string, limit = 20): Promise<Recipe[]> {
    try {
      return await this.prisma.recipe.findMany({
        where: {
          dietaryRestrictions: {
            some: {
              id: dietaryRestrictionId,
            },
          },
        },
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
        take: limit,
        orderBy: {
          rating: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Error fetching recipes by dietary restriction: ${dietaryRestrictionId}`, error);
      throw error;
    }
  }

  /**
   * Create a new recipe
   */
  async createRecipe(
    recipeData: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'> & {
      ingredientIds: string[];
      cuisineIds: string[];
      dietaryRestrictionIds: string[];
    }
  ): Promise<Recipe> {
    const { ingredientIds, cuisineIds, dietaryRestrictionIds, ...recipeDetails } = recipeData;

    try {
      return await this.prisma.recipe.create({
        data: {
          ...recipeDetails,
          ingredients: {
            connect: ingredientIds.map(id => ({ id })),
          },
          cuisines: {
            connect: cuisineIds.map(id => ({ id })),
          },
          dietaryRestrictions: {
            connect: dietaryRestrictionIds.map(id => ({ id })),
          },
        },
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
      });
    } catch (error) {
      this.logger.error('Error creating recipe', error);
      throw error;
    }
  }

  /**
   * Update an existing recipe
   */
  async updateRecipe(
    id: string,
    recipeData: Partial<Recipe> & {
      ingredientIds?: string[];
      cuisineIds?: string[];
      dietaryRestrictionIds?: string[];
    }
  ): Promise<Recipe> {
    const { ingredientIds, cuisineIds, dietaryRestrictionIds, ...recipeDetails } = recipeData;

    try {
      // Build update data
      const updateData: any = { ...recipeDetails };

      // Only include relation updates if IDs were provided
      if (ingredientIds) {
        updateData.ingredients = {
          set: [],
          connect: ingredientIds.map(id => ({ id })),
        };
      }

      if (cuisineIds) {
        updateData.cuisines = {
          set: [],
          connect: cuisineIds.map(id => ({ id })),
        };
      }

      if (dietaryRestrictionIds) {
        updateData.dietaryRestrictions = {
          set: [],
          connect: dietaryRestrictionIds.map(id => ({ id })),
        };
      }

      return await this.prisma.recipe.update({
        where: { id },
        data: updateData,
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating recipe with id ${id}`, error);
      throw error;
    }
  }

  /**
   * Get recipes by cuisine
   */
  async getRecipesByCuisine(cuisineId: string, limit = 20): Promise<Recipe[]> {
    try {
      return await this.prisma.recipe.findMany({
        where: {
          cuisines: {
            some: {
              id: cuisineId,
            },
          },
        },
        include: {
          ingredients: true,
          cuisines: true,
          dietaryRestrictions: true,
        },
        take: limit,
        orderBy: {
          rating: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Error fetching recipes by cuisine: ${cuisineId}`, error);
      throw error;
    }
  }

  /**
   * Delete a recipe
   */
  async deleteRecipe(id: string): Promise<void> {
    try {
      await this.prisma.recipe.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting recipe with id ${id}`, error);
      throw error;
    }
  }
}