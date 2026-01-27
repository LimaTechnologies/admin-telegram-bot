import type { ObjectId, Timestamps } from './common';

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface IUser extends Timestamps {
  _id: ObjectId;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
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
