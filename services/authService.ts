
import { User, AuthResponse } from '../types/auth';

const USERS_KEY = 'certguard_users_db';
const SESSION_KEY = 'certguard_current_session';

export class AuthService {
  
  static getUsers(): User[] {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
  }

  static saveUser(user: User): void {
    const users = this.getUsers();
    users.push(user);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  static login(email: string, password: string): AuthResponse {
    const users = this.getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      // Create session (exclude password)
      const { password, ...sessionUser } = user;
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      return { success: true, user: sessionUser as User };
    }

    return { success: false, message: 'E-mail ou senha inválidos.' };
  }

  static register(name: string, email: string, password: string, company: string): AuthResponse {
    const users = this.getUsers();
    
    if (users.find(u => u.email === email)) {
      return { success: false, message: 'Este e-mail já está cadastrado.' };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email,
      password, // In a real app, this must be hashed
      company,
      role: 'user'
    };

    this.saveUser(newUser);
    
    // Auto login after register
    const { password: _, ...sessionUser } = newUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));

    return { success: true, user: sessionUser as User };
  }

  static logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  static getCurrentUser(): User | null {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }
}
