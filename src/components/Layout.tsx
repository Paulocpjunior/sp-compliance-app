import React, { ReactNode, useState, useEffect } from 'react';
import { AuthService } from '../services/authService';
import { User } from '../types/auth';

interface LayoutProps {
  children: ReactNode;
  user?: User | null;
  onLogout?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand-700 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md border-2 border-brand-600">
              SP
            </div>
            <div className="flex flex-col">
                <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight leading-none">ConsultaSP</h1>
                <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wide">SP Assessoria Contábil</p>
            </div>
          </div>
          <nav className="flex items-center space-x-4">
             <span className="hidden sm:inline-block text-xs font-medium px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M2.166 10.324a.75.75 0 01.664-1.308 16.836 16.836 0 001.077 8.36.75.75 0 01-1.378.59A18.336 18.336 0 012.166 10.324z" clipRule="evenodd" />
                 <path fillRule="evenodd" d="M10 1a9 9 0 00-7.872 13.255.75.75 0 01-.19 1.05 9.002 9.002 0 0015.124 0 .75.75 0 01-.19-1.05A9 9 0 0010 1zm0 2a7 7 0 100 14 7 7 0 000-14z" clipRule="evenodd" />
               </svg>
               Ambiente Seguro (Criptografia Ponta a Ponta)
             </span>
             
             {/* User Profile / Logout */}
             {user && onLogout && (
               <div className="flex items-center border-l border-slate-200 dark:border-slate-700 pl-4 ml-2 space-x-3">
                 <div className="hidden md:block text-right">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{user.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[100px]">{user.company || 'Cliente'}</p>
                 </div>
                 <button 
                    onClick={onLogout}
                    className="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors"
                    title="Sair"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                   </svg>
                 </button>
               </div>
             )}

             <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 24.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
             </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-auto py-8 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 text-center text-slate-400 dark:text-slate-500 text-sm">
          <p>© {new Date().getFullYear()} Desenvolvido By SP-Assessoria Contábil.</p>
          <p className="text-xs mt-2 opacity-70">Plataforma homologada para uso profissional.</p>
        </div>
      </footer>
    </div>
  );
};