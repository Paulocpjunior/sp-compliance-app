
import React, { useState } from 'react';
import { AuthService } from '../services/authService';
import { User } from '../types/auth';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Simulate network delay for UX
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      if (isLogin) {
        const result = AuthService.login(formData.email, formData.password);
        if (result.success && result.user) {
          onLoginSuccess(result.user);
        } else {
          setError(result.message || 'Erro ao realizar login');
        }
      } else {
        // Validation
        if (formData.password !== formData.confirmPassword) {
          setError("As senhas não coincidem.");
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError("A senha deve ter pelo menos 6 caracteres.");
          setLoading(false);
          return;
        }

        const result = AuthService.register(formData.name, formData.email, formData.password, formData.company);
        if (result.success && result.user) {
          onLoginSuccess(result.user);
        } else {
          setError(result.message || 'Erro ao criar conta');
        }
      }
    } catch (err) {
      setError("Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Left Side - Visual/Marketing */}
      <div className="hidden lg:flex w-1/2 bg-brand-700 relative overflow-hidden flex-col justify-between p-12 text-white">
        <div className="absolute inset-0 opacity-10 pattern-dots"></div>
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 rounded-full bg-brand-600 blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 rounded-full bg-indigo-700 blur-3xl opacity-50"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-lg flex items-center justify-center font-bold text-2xl border border-white/20 shadow-inner">
              SP
            </div>
            <div>
                 <span className="text-2xl font-bold tracking-tight block leading-none">ConsultaSP</span>
                 <span className="text-xs text-brand-200 font-semibold uppercase tracking-wider">SP Assessoria Contábil</span>
            </div>
          </div>
          
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Consulta Situação<br/>Fiscal
          </h1>
          <p className="text-lg text-brand-100 max-w-md">
            Plataforma exclusiva da SP Assessoria Contábil para análise automática de certificados digitais e monitoramento de pendências tributárias.
          </p>
        </div>

        <div className="relative z-10 text-brand-200 text-sm">
          © {new Date().getFullYear()} SP Assessoria Contábil. Todos os direitos reservados.
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
              {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              {isLogin ? 'Acesse o portal da SP Assessoria Contábil.' : 'Cadastre-se para iniciar suas consultas.'}
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo</label>
                    <input
                      name="name"
                      type="text"
                      required
                      className="mt-1 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all dark:text-white"
                      placeholder="Seu nome"
                      value={formData.name}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Empresa</label>
                    <input
                      name="company"
                      type="text"
                      required
                      className="mt-1 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all dark:text-white"
                      placeholder="Razão Social"
                      value={formData.company}
                      onChange={handleChange}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">E-mail Corporativo</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all dark:text-white"
                  placeholder="voce@empresa.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
                <input
                  name="password"
                  type="password"
                  required
                  className="mt-1 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all dark:text-white"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Confirmar Senha</label>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    className="mt-1 w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all dark:text-white"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                isLogin ? 'Entrar no Sistema' : 'Criar Conta'
              )}
            </button>

            <div className="text-center mt-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isLogin ? "Ainda não tem uma conta? " : "Já possui uma conta? "}
                <button
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(null); }}
                  className="font-medium text-brand-600 hover:text-brand-500 transition-colors"
                >
                  {isLogin ? "Cadastre-se gratuitamente" : "Faça login"}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
