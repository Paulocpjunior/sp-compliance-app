
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Only used during registration/login check, not stored in session
  company?: string;
  role: 'admin' | 'user';
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
}
