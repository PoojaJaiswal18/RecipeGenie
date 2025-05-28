import { Types } from 'mongoose';

export interface AuthenticatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  photo?: string;
  role: string;
  password: string;
  passwordChangedAt?: Date;
  active: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
