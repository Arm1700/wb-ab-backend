import { UserRole } from '../../common/types/user-role';

export class User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  
  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
  
  // Remove sensitive data before sending to client
  toJSON() {
    const { password, ...user } = this;
    return user;
  }
}
