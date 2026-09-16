export type Role = 'OWNER' | 'MANAGER';
export interface AuthUser {
  id: string;
  companyId: string;
  companyName: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
