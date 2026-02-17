
import React, { useState, useEffect, useCallback } from 'react';
import { Participant, Resolution, RoleType, ResolutionStatus, VoteOption, Condominium, UserLogin } from './types';
import Layout from './components/Layout';
import LeaderBoard from './components/LeaderBoard';
import VoterBoard from './components/VoterBoard';
import { 
  initDatabase, 
  queryLogin, 
  createVoter, 
  getVoters, 
  getCondominium,
  saveResolution,
  getAllResolutions,
  updateResStatus,
  registerVote
} from './services/dbService';

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUser, setCurrentUser] = useState<UserLogin | null>(null);
  const [currentCondo, setCurrentCondo] = useState<Condominium | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const refreshData = useCallback(() => {
    if (currentUser) {
      // Refresh resolutions from DB
      const resFromDb = getAllResolutions(1); // Assuming meeting ID 1 for demo
      setResolutions(resFromDb as any);
      
      // Refresh participants
      const voters = getVoters(currentUser.condominiumId);
      setParticipants(voters.map((v: any) => ({
        id: v.id.toString(),
        name: v.name,
        email: v.email
      })));
    }
  }, [currentUser]);

  useEffect(() => {
    initDatabase().then(() => {
      setDbReady(true);
    });
  }, []);

  useEffect(() => {
    if (currentUser) {
      const condo = getCondominium(currentUser.condominiumId);
      setCurrentCondo(condo);
      refreshData();
    }
  }, [currentUser, refreshData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = queryLogin(loginForm.email, loginForm.password);
    if (user) {
      setRole(user.role as RoleType);
      setCurrentUser({
        id: user.id,
        name: user.name,
        email: user.email,
        condominiumId: user.condominium_id,
        role: user.role as RoleType
      });
    } else {
      alert("Identifiants incorrects.");
    }
  };

  const logout = () => {
    setRole(null);
    setCurrentUser(null);
    setCurrentCondo(null);
    setLoginForm({ email: '', password: '' });
  };

  const handleAddParticipant = (p: Participant) => {
    if (currentUser) {
      createVoter(p.name, p.email, p.password || 'pass123', currentUser.condominiumId);
      refreshData();
    }
  };

  const handleAddResolution = (r: Resolution) => {
    saveResolution(r);
    refreshData();
  };

  const handleUpdateStatus = (id: string, status: ResolutionStatus) => {
    updateResStatus(id, status);
    refreshData();
  };

  const handleVote = (resId: string, option: VoteOption) => {
    if (!currentUser) return;
    registerVote(resId, currentUser.id, option);
    refreshData();
  };

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">Initialisation de la base de données sécurisée...</p>
      </div>
    );
  }

  if (!role) {
    return (
      <Layout onLogout={logout}>
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Accès Sécurisé</h1>
              <p className="text-slate-500 text-sm">Portail de vote de votre copropriété.</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email</label>
                <input 
                  type="email" 
                  value={loginForm.email}
                  onChange={e => setLoginForm({...loginForm, email: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="votre@mail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Mot de passe</label>
                <input 
                  type="password" 
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                Se connecter
              </button>
            </form>
            <div className="mt-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-700 leading-relaxed">
                <span className="font-bold">Démo Login :</span><br/>
                • Manager: <code className="bg-white px-1 rounded">admin@copro.com</code> / <code className="bg-white px-1 rounded">admin123</code><br/>
                • Votant: Créez un compte via le manager pour tester l'accès votant.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={currentUser?.name} role={role === 'MANAGER' ? 'LEADER' : 'VOTER'} onLogout={logout}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">{currentCondo?.name}</h2>
        <p className="text-slate-500 text-sm flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          {currentCondo?.address}
        </p>
      </div>
      {role === 'MANAGER' ? (
        <LeaderBoard 
          participants={participants}
          resolutions={resolutions}
          onAddParticipant={handleAddParticipant}
          onAddResolution={handleAddResolution}
          onUpdateResolutionStatus={handleUpdateStatus}
        />
      ) : (
        currentUser && (
          <VoterBoard 
            resolutions={resolutions}
            currentUser={currentUser}
            onVote={handleVote}
          />
        )
      )}
    </Layout>
  );
};

export default App;
