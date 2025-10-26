import { UserRole } from '../../common/types/user-role';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}
