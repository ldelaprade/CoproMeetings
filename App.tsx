
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

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [dbMode, setDbMode] = useState<'local' | 'browser' | 'server' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('');
  
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

  const loadInitialData = useCallback(() => {
    if (role === 'MANAGER') {
      const allCondos = getCondominiums();
      setCondominiums(allCondos as any);
    }
  }, [role]);

  const refreshCondoData = useCallback((condoId: number) => {
    const condo = getCondominium(condoId);
    setSelectedCondo(condo as any);
    const voters = getVoters(condoId);
    setParticipants(voters.map((v: any) => ({
      id: v.id.toString(),
      name: v.name,
      email: v.email
    })));
    const condoMeetings = getMeetings(condoId);
    setMeetings(condoMeetings as any);
  }, []);

  const refreshMeetingData = useCallback((meetingId: number) => {
    const resFromDb = getAllResolutions(meetingId);
    setResolutions(resFromDb as any);
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
  const handleCreateCondo = (name: string, address: string) => {
    createCondominium(name, address);
    loadInitialData();
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
  const handleCreateNewMeeting = (title: string, date: string) => {
    if (selectedCondo) {
      createMeeting(selectedCondo.id, title, date);
      refreshCondoData(selectedCondo.id);
    }
  };

  // Fix: Implemented missing handler for adding a participant
  const handleAddParticipant = (p: Participant) => {
    if (selectedCondo) {
      createVoter(p.name, p.email, p.password || '1234', selectedCondo.id);
      refreshCondoData(selectedCondo.id);
    }
  };

  // Fix: Implemented missing handler for updating a participant
  const handleUpdateParticipant = (p: Participant) => {
    if (selectedCondo) {
      updateVoter(p.id, p.name, p.email);
      refreshCondoData(selectedCondo.id);
    }
  };

  // Fix: Implemented missing handler for adding a resolution
  const handleAddResolution = (res: Resolution) => {
    saveResolution(res);
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
  };

  // Fix: Implemented missing handler for updating resolution status
  const handleUpdateStatus = (id: string, status: ResolutionStatus) => {
    updateResStatus(id, status);
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
  };

  // Fix: Implemented missing handler for deleting a resolution
  const handleDeleteResolution = (id: string) => {
    deleteResolution(id);
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
  };

  // Fix: Implemented missing handler for registering a vote
  const handleVote = (resId: string, option: VoteOption) => {
    if (currentUser) {
      registerVote(resId, currentUser.id, option);
      if (activeMeeting) {
        refreshMeetingData(activeMeeting.id);
      }
    }
  };

  useEffect(() => {
    const syncChannel = new BroadcastChannel('covote_sync');
    syncChannel.onmessage = async () => {
      await initDatabase(); 
      if (selectedCondo) refreshCondoData(selectedCondo.id);
      if (activeMeeting) refreshMeetingData(activeMeeting.id);
      if (role === 'MANAGER') loadInitialData();
    };
    return () => syncChannel.close();
  }, [selectedCondo, activeMeeting, role, refreshCondoData, refreshMeetingData, loadInitialData]);

  const startWithBrowserStorage = async () => {
    await initDatabase();
    setDbMode('browser');
    setDbReady(true);
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
    if (confirm("Voulez-vous vraiment restaurer les données de démo ? Cela effacera vos modifications locales.")) {
      await resetDatabase();
      setDbMode('browser');
      setDbReady(true);
    }
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={startWithBrowserStorage} className="p-8 border-2 border-slate-100 rounded-3xl text-left hover:border-indigo-500 hover:bg-indigo-50 transition-all group shadow-sm">
              <h3 className="font-bold text-slate-800 mb-2 group-hover:text-indigo-700">Mode Web Local</h3>
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
              onClick={handleReset}
              className="w-full py-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all uppercase tracking-widest flex items-center justify-center space-x-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span>Restaurer les données de démo (Reset)</span>
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
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
                 onClick={handleReset}
                 className="text-[10px] font-bold text-slate-300 hover:text-indigo-500 transition-colors uppercase tracking-widest flex items-center justify-center mx-auto space-x-1"
               >
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 <span>Réinitialiser la base de démo</span>
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
          onReset={handleReset}
        />
      ) : (
        currentUser && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-slate-800">{selectedCondo?.name}</h2>
            <VoterBoard resolutions={resolutions} currentUser={currentUser} onVote={handleVote} />
          </div>
        )
      )}
    </Layout>
  );
};

export default App;
