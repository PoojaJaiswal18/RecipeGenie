import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import validator from 'validator';

// User preferences interface
interface IPreferences {
  dietaryRestrictions: string[];
  favoriteCuisines: string[];
  allergies: string[];
  dislikedIngredients: string[];
}

// User interface
export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  isActive: boolean;
  role: 'user' | 'admin';
  preferences: IPreferences;
  favoriteRecipes: mongoose.Types.ObjectId[];
  searchHistory: string[];
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
  passwordChangedAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
}

// User model interface
interface IUserModel extends Model<IUser> {
  // Add any static methods here if needed
}

// User schema
const userSchema = new Schema<IUser, IUserModel>(
  {
    email: {
      type: String,
      required: [true, 'Please provide your email'],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email']
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 8,
      select: false  // Don't send password in query results
    },
    name: {
      type: String,
      required: [true, 'Please provide your name'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    },
    preferences: {
      dietaryRestrictions: [String],
      favoriteCuisines: [String],
      allergies: [String],
      dislikedIngredients: [String]
    },
    favoriteRecipes: [{
      type: Schema.Types.ObjectId,
      ref: 'Recipe'
    }],
    searchHistory: [String],
    lastActive: Date,
    passwordChangedAt: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre<IUser>('save', async function(next) {
  // Only run this function if password was modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash the password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    
    // Update passwordChangedAt field
    if (this.isModified('password') && !this.isNew) {
      this.passwordChangedAt = new Date();
    }
    
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if password was changed after token was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return JWTTimestamp < changedTimestamp;
  }
  
  // False means NOT changed
  return false;
};

// Create and export User model
const User = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;