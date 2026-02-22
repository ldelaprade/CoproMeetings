
import React, { useState, useEffect, useCallback } from 'react';
import { detectEnvironment, detectServerMode } from './detectEnv.ts';
import { Participant, Resolution, RoleType, ResolutionStatus, VoteOption, Condominium, UserLogin, GeneralMeeting, PowerMandate, PowerMode } from './types.ts';
import Layout from './components/Layout.tsx';
import LeaderBoard from './components/LeaderBoard.tsx';
import VoterBoard from './components/VoterBoard.tsx';
import { 
  initDatabase, 
  reloadDatabase,
  queryLogin, 
  getUserCondominiums,
  createVoter, 
  updateVoter,
  toggleVoterStatus,
  hasVoterVotedInCondo,
  deleteVoterMembershipPermanently,
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
  registerVoteByProxy,
  registerInstructionVote,
  upsertPowerMandate,
  clearPowerMandate,
  getMeetingPowerMandates,
  openLocalDatabaseFile,
  createLocalDatabaseFile,
  loadDatabaseFromServer,
  enableServerMode
} from './services/dbService.ts';

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [dbMode, setDbMode] = useState<'local' | 'browser' | 'server' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [env] = useState<'aistudio' | 'local' | 'web'>(detectEnvironment);
  // Popup création de nouvelle base en mode serveur
  const [newDbNotice, setNewDbNotice] = useState<string | null>(null);
  
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUser, setCurrentUser] = useState<UserLogin | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [selectedCondo, setSelectedCondo] = useState<Condominium | null>(null);
  const [meetings, setMeetings] = useState<GeneralMeeting[]>([]);
  const [activeMeeting, setActiveMeeting] = useState<GeneralMeeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [powerMandates, setPowerMandates] = useState<PowerMandate[]>([]);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  const [voterCondos, setVoterCondos] = useState<Condominium[]>([]);

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
      email: v.email,
      isActive: v.isActive
    })));
    const condoMeetings = getMeetings(condoId);
    setMeetings(condoMeetings as any);
  }, []);

  const refreshMeetingData = useCallback((meetingId: number) => {
    const resFromDb = getAllResolutions(meetingId);
    setResolutions(resFromDb as any);
    const mandates = getMeetingPowerMandates(meetingId);
    setPowerMandates(mandates as any);
  }, []);

  // Fonction centralisée de rafraîchissement des données après un sync
  const syncRefresh = useCallback(async () => {
    await reloadDatabase();
    if (selectedCondo) {
      refreshCondoData(selectedCondo.id);
    }
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
    if (role === 'MANAGER') {
      loadInitialData();
    }
  }, [selectedCondo, activeMeeting, role, refreshCondoData, refreshMeetingData, loadInitialData]);

  // BroadcastChannel : sync multi-onglets dans le même navigateur
  useEffect(() => {
    const bc = new BroadcastChannel('covote_sync');
    bc.onmessage = () => syncRefresh();
    return () => bc.close();
  }, [syncRefresh]);

  // Polling 2s en mode serveur : sync multi-navigateurs / multi-machines
  useEffect(() => {
    if (dbMode !== 'server') return;
    const interval = setInterval(() => syncRefresh(), 2000);
    return () => clearInterval(interval);
  }, [dbMode, syncRefresh]);

  // Démarrage automatique en mode Express-server (appelé une seule fois au montage)
  useEffect(() => {
    detectServerMode().then(async (serverInfo) => {
      if (serverInfo) {
        // Mode Express : charger condominium.sqlite depuis le serveur
        enableServerMode();
        const result = await loadDatabaseFromServer();
        if (result) {
          setDbMode('server');
          setDbReady(true);
          if (!result.loaded) {
            // Nouvelle base créée
            setNewDbNotice(result.path);
          }
        }
      } else if (env === 'aistudio') {
        // AI Studio : stockage navigateur automatique
        await initDatabase();
        setDbMode('browser');
        setDbReady(true);
      }
      // Sinon : on laisse l'utilisateur choisir (écran de sélection)
    });
  }, []);

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

  const startWithNewFile = async () => {
    const result = await createLocalDatabaseFile();
    if (result) {
      setFileName(result.name);
      setDbMode('local');
      setDbReady(true);
    }
  };

  useEffect(() => {
    if (dbReady && role === 'MANAGER') {
      loadInitialData();
    }
  }, [dbReady, role, loadInitialData]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const user = queryLogin(loginForm.email, loginForm.password);
    if (user) {
      setRole(user.role as RoleType);
      setCurrentUser({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as RoleType,
        isActive: user.isActive
      });

      if (user.role === 'VOTER') {
        const condos = getUserCondominiums(user.id);
        if (condos.length === 0) {
          setLoginError("Vous n'êtes rattaché à aucune copropriété active.");
          return;
        }
        setVoterCondos(condos as any);
      }
    } else {
      setLoginError("Identifiants ou mot de passe incorrects.");
    }
  };

  const logout = () => {
    setRole(null);
    setCurrentUser(null);
    setSelectedCondo(null);
    setActiveMeeting(null);
    setMeetings([]);
    setVoterCondos([]);
    setResolutions([]);
    setPowerMandates([]);
    setLoginForm({ email: '', password: '' });
    setLoginError(null);
  };

  const handleSelectCondo = (condo: Condominium | null) => {
    // Crucial : On réinitialise l'AG et les résolutions dès qu'on change de copropriété
    setSelectedCondo(condo);
    setActiveMeeting(null);
    setResolutions([]);
    setPowerMandates([]);
    
    if (condo) {
      refreshCondoData(condo.id);
      if (role === 'VOTER') {
        const condoMeetings = getMeetings(condo.id);
        if (condoMeetings.length > 0) {
          const lastMeeting = condoMeetings[0];
          setActiveMeeting(lastMeeting as any);
          refreshMeetingData(lastMeeting.id);
        } else {
          // Si aucune AG, on s'assure que l'état est vide
          setActiveMeeting(null);
          setResolutions([]);
          setPowerMandates([]);
        }
      }
    }
  };

  const handleCreateCondo = (name: string, address: string) => {
    createCondominium(name, address);
    loadInitialData();
  };

  const handleSelectMeeting = (meeting: GeneralMeeting | null) => {
    setActiveMeeting(meeting);
    if (meeting) {
      refreshMeetingData(meeting.id);
    } else {
      setResolutions([]);
      setPowerMandates([]);
    }
  };

  const handleCreateNewMeeting = (title: string, date: string) => {
    if (selectedCondo) {
      createMeeting(selectedCondo.id, title, date);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleAddParticipant = (p: Participant) => {
    if (selectedCondo) {
      createVoter(p.name, p.email, p.password || '1234', selectedCondo.id);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleUpdateParticipant = (p: Participant) => {
    if (selectedCondo) {
      updateVoter(p.id, p.name, p.email);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleToggleParticipantStatus = (id: string, active: boolean) => {
    if (selectedCondo) {
      toggleVoterStatus(id, selectedCondo.id, active);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleDeleteParticipant = (id: string): { success: boolean, mode: 'deleted' | 'deactivated', name: string } => {
    if (!selectedCondo) return { success: false, mode: 'deleted', name: '' };
    
    const voterId = parseInt(id);
    const hasVotes = hasVoterVotedInCondo(voterId, selectedCondo.id);
    const voter = participants.find(p => p.id === id);
    const voterName = voter?.name || "Inconnu";

    if (hasVotes) {
      toggleVoterStatus(id, selectedCondo.id, false);
      refreshCondoData(selectedCondo.id);
      return { success: true, mode: 'deactivated', name: voterName };
    } else {
      deleteVoterMembershipPermanently(id, selectedCondo.id);
      refreshCondoData(selectedCondo.id);
      return { success: true, mode: 'deleted', name: voterName };
    }
  };

  const handleAddResolution = (res: Resolution) => {
    saveResolution(res);
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
  };

  const handleUpdateStatus = (id: string, status: ResolutionStatus) => {
    updateResStatus(id, status);
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
  };

  const handleDeleteResolution = (id: string) => {
    deleteResolution(id);
    if (activeMeeting) {
      refreshMeetingData(activeMeeting.id);
    }
  };

  const handleVote = (resId: string, option: VoteOption) => {
    if (currentUser) {
      try {
        registerVote(resId, currentUser.id, option);
        if (activeMeeting) {
          refreshMeetingData(activeMeeting.id);
        }
      } catch (error: any) {
        alert(error?.message || 'Vote impossible.');
      }
    }
  };

  const handleVoteByProxy = (resId: string, grantorId: number, option: VoteOption) => {
    if (currentUser) {
      try {
        registerVoteByProxy(resId, grantorId, currentUser.id, option);
        if (activeMeeting) {
          refreshMeetingData(activeMeeting.id);
        }
      } catch (error: any) {
        alert(error?.message || 'Vote en tant que mandataire impossible.');
      }
    }
  };

  const handleInstructionVote = (resId: string, option: VoteOption) => {
    if (currentUser) {
      try {
        registerInstructionVote(resId, currentUser.id, option);
        if (activeMeeting) {
          refreshMeetingData(activeMeeting.id);
        }
      } catch (error: any) {
        alert(error?.message || 'Consigne de vote impossible.');
      }
    }
  };

  const handleSetPowerMandate = (granteeId: number, mode: PowerMode): { success: boolean; message: string } => {
    if (!currentUser) {
      return { success: false, message: 'Utilisateur non connecté.' };
    }

    const meetingId = activeMeeting?.id || resolutions[0]?.meetingId;
    if (!meetingId) {
      return { success: false, message: 'Aucune assemblée active trouvée pour enregistrer le pouvoir.' };
    }

    if (granteeId === currentUser.id) {
      return { success: false, message: 'Vous ne pouvez pas vous désigner vous-même comme mandataire.' };
    }

    upsertPowerMandate(meetingId, currentUser.id, granteeId, mode);
    refreshMeetingData(meetingId);
    return { success: true, message: 'Pouvoir enregistré avec succès.' };
  };

  const handleClearPower = (): { success: boolean; message: string } => {
    if (!currentUser) {
      return { success: false, message: 'Utilisateur non connecté.' };
    }

    const meetingId = activeMeeting?.id || resolutions[0]?.meetingId;
    if (!meetingId) {
      return { success: false, message: 'Aucune assemblée active trouvée pour retirer le pouvoir.' };
    }

    clearPowerMandate(meetingId, currentUser.id);
    refreshMeetingData(meetingId);
    return { success: true, message: 'Pouvoir retiré.' };
  };

  if (!dbReady) {
    // Express-server et aistudio : démarrage automatique géré par useEffect → afficher un spinner
    // Mode local : afficher l'écran de sélection de source
    return (
      <Layout onLogout={() => {}}>
        <div className="max-w-2xl mx-auto mt-20 p-8 bg-white rounded-3xl shadow-xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8.1.79 8 4" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Source de Données</h1>
          <p className="text-slate-500 mb-10">Choisissez comment vous souhaitez accéder à vos données de copropriété.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button 
              onClick={startWithBrowserStorage}
              className="p-6 border-2 border-slate-100 rounded-2xl text-left hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
            >
              <h3 className="font-bold text-slate-800 mb-1 group-hover:text-indigo-700">Stockage Navigateur</h3>
              <p className="text-xs text-slate-500">Données persistantes dans le cache de ce navigateur uniquement.</p>
            </button>
            <button 
              onClick={startWithLocalFile}
              className="p-6 border-2 border-slate-100 rounded-2xl text-left hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
            >
              <h3 className="font-bold text-slate-800 mb-1 group-hover:text-indigo-700">Ouvrir un fichier .sqlite</h3>
              <p className="text-xs text-slate-500">Travailler directement sur un fichier stocké sur votre ordinateur.</p>
            </button>
            <button 
              onClick={startWithNewFile}
              className="md:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-all"
            >
              + Créer une nouvelle base locale
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!role) {
    return (
      <Layout onLogout={logout}>
        <div className="max-w-md mx-auto mt-20">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 relative">
            {/* Badge source de données connectée */}
            {dbMode === 'local' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full mr-2 animate-pulse"></span>
                Connecté : {fileName}
              </div>
            )}
            {dbMode === 'server' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg flex items-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full mr-2 animate-pulse"></span>
                Mode serveur • condominium.sqlite
              </div>
            )}

            {/* Popup nouvelle base créée */}
            {newDbNotice && (
              <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm rounded-xl">
                <div className="font-bold mb-1">ℹ️ Nouvelle base créée</div>
                <div className="font-mono text-xs break-all">{newDbNotice}</div>
                <button onClick={() => setNewDbNotice(null)} className="mt-2 text-xs text-indigo-500 hover:underline">Fermer</button>
              </div>
            )}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Accès Sécurisé</h1>
              <p className="text-slate-500 text-sm">Portail de vote de votre copropriété.</p>
            </div>
            
            {loginError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-center animate-shake">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Identifiant ou Email</label>
                <input 
                  type="text" 
                  value={loginForm.email}
                  onChange={e => {
                    setLoginForm({...loginForm, email: e.target.value});
                    if (loginError) setLoginError(null);
                  }}
                  className={`w-full px-5 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all ${loginError ? 'border-red-300 ring-red-100' : 'border-slate-200 focus:ring-indigo-500'}`}
                  placeholder="votre@mail.com ou 'Admin'"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Mot de passe</label>
                <input 
                  type="password" 
                  value={loginForm.password}
                  onChange={e => {
                    setLoginForm({...loginForm, password: e.target.value});
                    if (loginError) setLoginError(null);
                  }}
                  className={`w-full px-5 py-3 bg-slate-50 border rounded-xl focus:ring-2 outline-none transition-all ${loginError ? 'border-red-300 ring-red-100' : 'border-slate-200 focus:ring-indigo-500'}`}
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
            {dbMode !== 'server' && env !== 'aistudio' && (
              <button onClick={() => setDbReady(false)} className="w-full mt-6 text-xs text-slate-400 hover:text-indigo-600 transition-colors">
                Changer de base de données
              </button>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // Écran de sélection de copropriété pour les votants après connexion
  if (role === 'VOTER' && !selectedCondo) {
    return (
      <Layout user={currentUser?.name} role="VOTER" onLogout={logout}>
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Bienvenue, {currentUser?.name}</h2>
            <p className="text-slate-500">Sélectionnez la copropriété pour laquelle vous souhaitez voter aujourd'hui.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {voterCondos.map(condo => (
              <button 
                key={condo.id} 
                onClick={() => handleSelectCondo(condo)}
                className="bg-white p-8 rounded-3xl border border-slate-200 text-left hover:border-indigo-400 hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 group-hover:bg-indigo-100 transition-colors"></div>
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-slate-800 text-xl mb-2">{condo.name}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{condo.address}</p>
                  <div className="mt-8 flex items-center text-indigo-600 font-bold text-sm uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Accéder à l'espace de vote
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={currentUser?.name} role={role === 'MANAGER' ? 'LEADER' : 'VOTER'} onLogout={logout}>
      {role === 'MANAGER' ? (
        <LeaderBoard 
          condominiums={condominiums}
          selectedCondo={selectedCondo}
          meetings={meetings}
          activeMeeting={activeMeeting}
          participants={participants}
          resolutions={resolutions}
          powerMandates={powerMandates}
          onSelectCondo={handleSelectCondo}
          onCreateCondo={handleCreateCondo}
          onSelectMeeting={handleSelectMeeting}
          onCreateMeeting={handleCreateNewMeeting}
          onAddParticipant={handleAddParticipant}
          onUpdateParticipant={handleUpdateParticipant}
          onAddResolution={handleAddResolution}
          onUpdateResolutionStatus={handleUpdateStatus}
          onDeleteResolution={handleDeleteResolution}
          onToggleParticipantStatus={handleToggleParticipantStatus}
          onDeleteParticipant={handleDeleteParticipant}
        />
      ) : (
        currentUser && selectedCondo && (
          <div className="space-y-6">
             <div className="mb-6 flex justify-between items-end bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedCondo.name}</h2>
                <p className="text-slate-500 text-sm">{selectedCondo.address}</p>
              </div>
              <button 
                onClick={() => setSelectedCondo(null)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
                </svg>
                Changer de copropriété
              </button>
            </div>
            <VoterBoard 
              resolutions={resolutions}
              currentUser={currentUser}
              participants={participants}
              powerMandates={powerMandates}
              onVote={handleVote}
              onInstructionVote={handleInstructionVote}
              onVoteByProxy={handleVoteByProxy}
              onSetPowerMandate={handleSetPowerMandate}
              onClearPowerMandate={handleClearPower}
            />
          </div>
        )
      )}
    </Layout>
  );
};

export default App;
