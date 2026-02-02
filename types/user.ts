import type { ObjectId, Timestamps } from './common';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface IUser extends Timestamps {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
}

// Public user type (excludes password hash)
export type IUserPublic = Omit<IUser, 'passwordHash'>;

// Response type for user creation (includes temporary password)
export interface CreateUserResponse {
  user: IUserPublic;
  temporaryPassword: string;
}

// Response type for password reset
export interface ResetPasswordResponse {
  success: boolean;
  temporaryPassword: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}
