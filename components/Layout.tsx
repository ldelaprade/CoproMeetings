
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  user?: string;
  role?: string;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, role, onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-white p-2 rounded-lg">
                <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <span className="font-bold text-xl tracking-tight uppercase">Co-Vote Pro</span>
            </div>
            {user && (
              <div className="flex items-center space-x-6">
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium">{user}</div>
                  <div className="text-xs text-indigo-200">{role === 'LEADER' ? 'Administrateur' : 'Copropropriétaire'}</div>
                </div>
                <button 
                  onClick={onLogout}
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} Co-Vote Pro - Gestion d'Assemblées Générales Numériques
      </footer>
    </div>
  );
};

export default Layout;
