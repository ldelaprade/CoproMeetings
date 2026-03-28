
import React, { useState, useEffect, useCallback } from 'react';
import { Participant, Resolution, RoleType, ResolutionStatus, VoteOption, Condominium, UserLogin, GeneralMeeting } from './types';
import Layout from './components/Layout';
import LeaderBoard from './components/LeaderBoard';
import VoterBoard from './components/VoterBoard';
import { 
  initDatabase, 
  queryLogin, 
  createVoter, 
  updateVoter,
  getVoters, 
  getCondominium,
  getCondominiums,
  createCondominium,
  getMeetings,
  createMeeting,
  saveResolution,
  getAllResolutions,
  updateResStatus,
  deleteResolution,
  registerVote,
  openLocalDatabaseFile,
  createLocalDatabaseFile,
  resetDatabase
} from './services/dbService';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Une erreur est survenue</h1>
          <p className="text-slate-600 mb-6">{this.state.error?.message || "Erreur inconnue"}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl"
          >
            Recharger l'application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [dbMode, setDbMode] = useState<'local' | 'browser' | 'server' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('/api/db');
  
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUser, setCurrentUser] = useState<UserLogin | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [selectedCondo, setSelectedCondo] = useState<Condominium | null>(null);
  const [meetings, setMeetings] = useState<GeneralMeeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<GeneralMeeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const loadInitialData = useCallback(() => {
    if (role === 'MANAGER') {
      const allCondos = getCondominiums();
      setCondominiums(allCondos as any);
    }
  }, [role]);

  const refreshCondoData = useCallback((condoId: number) => {
    try {
      console.log('Refreshing condo data for condoId:', condoId);
      const condo = getCondominium(condoId);
      if (condo) {
        console.log('Found condo:', condo.name);
        setSelectedCondo(condo as any);
      } else {
        console.warn('getCondominium returned null for id:', condoId);
      }
      
      const voters = getVoters(condoId);
      console.log('Voters fetched from DB:', voters.length, JSON.stringify(voters));
      
      const mappedParticipants = voters.map((v: any) => {
        const name = v && v.name && typeof v.name === 'string' ? v.name.trim() : '';
        const email = v && v.email && typeof v.email === 'string' ? v.email.trim() : '';
        
        return {
          id: v && v.id ? v.id.toString() : Math.random().toString(),
          name: name !== '' ? name : 'Nom non renseigné',
          email: email !== '' ? email : 'Email non renseigné'
        };
      });
      
      console.log('Mapped participants:', mappedParticipants.length);
      setParticipants(mappedParticipants);
      
      const condoMeetings = getMeetings(condoId);
      console.log('Meetings fetched from DB:', condoMeetings.length, JSON.stringify(condoMeetings));
      setMeetings(condoMeetings as any);
    } catch (error) {
      console.error("Error in refreshCondoData:", error);
    }
  }, []);

  const refreshMeetingData = useCallback((meetingId: number) => {
    try {
      const resFromDb = getAllResolutions(meetingId);
      setResolutions(resFromDb as any);
    } catch (error) {
      console.error("Error in refreshMeetingData:", error);
    }
  }, []);

  // Fix: Implemented missing handler for selecting a condominium
  const handleSelectCondo = (condo: Condominium | null) => {
    setSelectedCondo(condo);
    if (condo) {
      refreshCondoData(condo.id);
    } else {
      setParticipants([]);
      setMeetings([]);
      setActiveMeeting(null);
      setResolutions([]);
    }
  };

  // Fix: Implemented missing handler for creating a condominium
  const handleCreateCondo = async (name: string, address: string) => {
    try {
      await createCondominium(name, address);
      loadInitialData();
    } catch (error) {
      console.error("Error creating condo:", error);
      alert("Erreur lors de la création de la copropriété.");
    }
  };

  // Fix: Implemented missing handler for selecting a meeting
  const handleSelectMeeting = (meeting: GeneralMeeting | null) => {
    setActiveMeeting(meeting);
    if (meeting) {
      refreshMeetingData(meeting.id);
    } else {
      setResolutions([]);
    }
  };

  // Fix: Implemented missing handler for creating a new meeting
  const handleCreateNewMeeting = async (title: string, date: string) => {
    if (selectedCondo) {
      try {
        await createMeeting(selectedCondo.id, title, date);
        refreshCondoData(selectedCondo.id);
      } catch (error) {
        console.error("Error creating meeting:", error);
        alert("Erreur lors de la création de l'AG.");
      }
    }
  };

  // Fix: Implemented missing handler for adding a participant
  const handleAddParticipant = async (p: Participant) => {
    if (selectedCondo) {
      try {
        await createVoter(p.name, p.email, p.password || '1234', selectedCondo.id);
        refreshCondoData(selectedCondo.id);
      } catch (e: any) {
        alert("Erreur lors de la création du copropriétaire: " + (e.message || "Email déjà utilisé ?"));
      }
    }
  };

  // Fix: Implemented missing handler for updating a participant
  const handleUpdateParticipant = async (p: Participant) => {
    if (selectedCondo) {
      try {
        await updateVoter(p.id, p.name, p.email);
        refreshCondoData(selectedCondo.id);
      } catch (error) {
        console.error("Error updating participant:", error);
      }
    }
  };

  // Fix: Implemented missing handler for adding a resolution
  const handleAddResolution = async (res: Resolution) => {
    try {
      await saveResolution(res);
      if (activeMeeting) {
        refreshMeetingData(activeMeeting.id);
      }
    } catch (error) {
      console.error("Error adding resolution:", error);
    }
  };

  // Fix: Implemented missing handler for updating resolution status
  const handleUpdateStatus = async (id: string, status: ResolutionStatus) => {
    try {
      await updateResStatus(id, status);
      if (activeMeeting) {
        refreshMeetingData(activeMeeting.id);
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  // Fix: Implemented missing handler for deleting a resolution
  const handleDeleteResolution = async (id: string) => {
    try {
      await deleteResolution(id);
      if (activeMeeting) {
        refreshMeetingData(activeMeeting.id);
      }
    } catch (error) {
      console.error("Error deleting resolution:", error);
    }
  };

  // Fix: Implemented missing handler for registering a vote
  const handleVote = async (resId: string, option: VoteOption) => {
    if (currentUser) {
      try {
        await registerVote(resId, currentUser.id, option);
        if (activeMeeting) {
          refreshMeetingData(activeMeeting.id);
        }
      } catch (error) {
        console.error("Error voting:", error);
      }
    }
  };

  useEffect(() => {
    const handleDataChange = async () => {
      if (selectedCondo) refreshCondoData(selectedCondo.id);
      if (activeMeeting) refreshMeetingData(activeMeeting.id);
      if (role === 'MANAGER') loadInitialData();
    };

    window.addEventListener('covote_data_changed', handleDataChange);
    
    return () => {
      window.removeEventListener('covote_data_changed', handleDataChange);
    };
  }, [selectedCondo, activeMeeting, role, refreshCondoData, refreshMeetingData, loadInitialData]);

  const startWithBrowserStorage = async () => {
    setIsInitializing(true);
    setInitError(null);
    try {
      await initDatabase();
      setDbMode('browser');
      setDbReady(true);
    } catch (e: any) {
      setInitError(e.message || "Erreur lors de l'initialisation de la base de données.");
      console.error(e);
    } finally {
      setIsInitializing(false);
    }
  };

  const startWithLocalFile = async () => {
    const result = await openLocalDatabaseFile();
    if (result) {
      setFileName(result.name);
      setDbMode('local');
      setDbReady(true);
    }
  };

  const startWithServer = async () => {
    if (!serverUrl) return;
    try {
      await initDatabase(undefined, serverUrl);
      setDbMode('server');
      setDbReady(true);
    } catch (e) {
      alert("Erreur de connexion au serveur.");
    }
  };

  const handleReset = async () => {
    setShowResetConfirm(false);
    setIsInitializing(true);
    setInitError(null);
    try {
      // Small delay to ensure the user sees the "Resetting" state
      await new Promise(resolve => setTimeout(resolve, 800));
      await resetDatabase();
      setDbMode('browser');
      setDbReady(true);
      // Reset application state to avoid stale data from previous DB
      setRole(null);
      setCurrentUser(null);
      setSelectedCondo(null);
      setActiveMeeting(null);
      setParticipants([]);
      setResolutions([]);
      setMeetings([]);
      loadInitialData(); // Refresh condominiums list
      console.log('Database reset and initial data loaded');
    } catch (e: any) {
      setInitError(e.message || "Erreur lors de la réinitialisation de la base de données.");
      console.error(e);
    } finally {
      setIsInitializing(false);
    }
  };

  const triggerReset = () => {
    setShowResetConfirm(true);
  };

  useEffect(() => {
    if (dbReady && role === 'MANAGER') loadInitialData();
  }, [dbReady, role, loadInitialData]);

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
      if (user.role === 'VOTER') {
        const condo = getCondominium(user.condominium_id);
        setSelectedCondo(condo as any);
        const condoMeetings = getMeetings(user.condominium_id);
        if (condoMeetings.length > 0) {
          const m = condoMeetings[0];
          setActiveMeeting(m as any);
          refreshMeetingData(m.id);
        }
      }
    } else {
      setLoginError("Identifiants incorrects.");
    }
  };

  const logout = () => {
    setRole(null);
    setCurrentUser(null);
    setSelectedCondo(null);
    setActiveMeeting(null);
  };

  if (!dbReady) {
    return (
      <Layout onLogout={() => {}}>
        <div className="max-w-2xl mx-auto mt-20 p-10 bg-white rounded-3xl shadow-2xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Accès au Serveur Co-Vote</h1>
          <p className="text-slate-500 mb-12">Configurez la source de données pour cette session d'assemblée.</p>
          
          {initError && (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-left">
              <p className="font-bold mb-1">Erreur d'initialisation :</p>
              <p>{initError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={startWithBrowserStorage} 
              disabled={isInitializing}
              className={`p-8 border-2 border-slate-100 rounded-3xl text-left transition-all group shadow-sm ${isInitializing ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-500 hover:bg-indigo-50'}`}
            >
              <h3 className={`font-bold mb-2 ${isInitializing ? 'text-slate-500' : 'text-slate-800 group-hover:text-indigo-700'}`}>
                {isInitializing ? 'Chargement...' : 'Mode Web Local'}
              </h3>
              <p className="text-xs text-slate-400">Stockage dans votre navigateur. Idéal pour les démonstrations.</p>
            </button>
            <button onClick={startWithLocalFile} className="p-8 border-2 border-slate-100 rounded-3xl text-left hover:border-indigo-500 hover:bg-indigo-50 transition-all group shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2 group-hover:text-indigo-700">Mode Fichier</h3>
              <p className="text-xs text-slate-400">Ouvrez un fichier .sqlite partagé ou stocké localement.</p>
            </button>
          </div>

          <div className="mt-8 p-8 bg-slate-50 rounded-3xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-4">Mode Serveur Web (Cloud)</h3>
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="URL du fichier SQLite (ex: https://monserveur.com/base.db)" 
                className="flex-grow px-5 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 ring-indigo-500"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
              />
              <button onClick={startWithServer} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200">Connecter</button>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold tracking-widest">Connectez l'application à un backend web distant</p>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100">
              <button 
                onClick={triggerReset}
                disabled={isInitializing}
                className="w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all uppercase tracking-widest flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
              >
                {isInitializing ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                )}
                <span>{isInitializing ? 'Réinitialisation...' : 'Restaurer les données de démo (Reset)'}</span>
              </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <ErrorBoundary>
      <Layout user={currentUser?.name} role={role === 'MANAGER' ? 'LEADER' : 'VOTER'} onLogout={logout}>
      <div className="absolute top-20 right-8 flex items-center space-x-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 shadow-sm z-10">
        <span className={`w-2 h-2 rounded-full ${dbMode === 'server' ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`}></span>
        <span className="text-[10px] font-bold text-slate-600 uppercase">Mode: {dbMode}</span>
      </div>
      
      {!role ? (
        <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Connexion</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 ring-indigo-500 outline-none" 
                value={loginForm.email} 
                onChange={e => setLoginForm({...loginForm, email: e.target.value})} 
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
              <input 
                type="password" 
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 ring-indigo-500 outline-none" 
                value={loginForm.password} 
                onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                required 
              />
            </div>
            {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 mt-4">Se connecter</button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
             <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">Comptes de démo</p>
             <div className="flex justify-center space-x-2">
               <button onClick={() => setLoginForm({email:'Admin', password:'admin123'})} className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-600 font-bold hover:bg-slate-200 transition-colors">Admin / admin123</button>
             </div>
             <div className="mt-8 pt-4 border-t border-slate-50">
               <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-2">Maintenance</p>
               <button 
                 onClick={triggerReset}
                 disabled={isInitializing}
                 className="text-[10px] font-bold text-slate-300 hover:text-indigo-500 transition-colors uppercase tracking-widest flex items-center justify-center mx-auto space-x-1 disabled:opacity-50"
               >
                 {isInitializing ? (
                   <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 ) : (
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 )}
                 <span>{isInitializing ? 'Réinitialisation...' : 'Réinitialiser la base de démo'}</span>
               </button>
             </div>
          </div>
        </div>
      ) : role === 'MANAGER' ? (
        <LeaderBoard 
          condominiums={condominiums}
          selectedCondo={selectedCondo}
          meetings={meetings}
          activeMeeting={activeMeeting}
          participants={participants}
          resolutions={resolutions}
          onSelectCondo={handleSelectCondo}
          onCreateCondo={handleCreateCondo}
          onSelectMeeting={handleSelectMeeting}
          onCreateMeeting={handleCreateNewMeeting}
          onAddParticipant={handleAddParticipant}
          onUpdateParticipant={handleUpdateParticipant}
          onAddResolution={handleAddResolution}
          onUpdateResolutionStatus={handleUpdateStatus}
          onDeleteResolution={handleDeleteResolution}
          onReset={triggerReset}
          isInitializing={isInitializing}
        />
      ) : (
        currentUser && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-800">{selectedCondo?.name}</h2>
            <VoterBoard resolutions={resolutions} currentUser={currentUser} onVote={handleVote} />
          </div>
        )
      )}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full animate-scale-up">
            <h3 className="text-xl font-bold mb-2 text-slate-900">Restaurer la démo ?</h3>
            <p className="text-slate-600 mb-8">Cela effacera toutes vos modifications locales et rétablira les données initiales.</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Annuler</button>
              <button onClick={handleReset} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-all">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
    </ErrorBoundary>
  );
};

export default App;
