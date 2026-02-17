
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
  registerVote
} from './services/dbService';

const App: React.FC = () => {
  const [dbReady, setDbReady] = useState(false);
  const [role, setRole] = useState<RoleType | null>(null);
  const [currentUser, setCurrentUser] = useState<UserLogin | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  // Condominium Navigation
  const [condominiums, setCondominiums] = useState<Condominium[]>([]);
  const [selectedCondo, setSelectedCondo] = useState<Condominium | null>(null);
  
  // Meeting Navigation
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

  useEffect(() => {
    initDatabase().then(() => {
      setDbReady(true);
    });
  }, []);

  useEffect(() => {
    if (role === 'MANAGER') {
      loadInitialData();
    }
  }, [role, loadInitialData]);

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
        condominiumId: user.condominium_id,
        role: user.role as RoleType
      });
      if (user.role === 'VOTER') {
        const condo = getCondominium(user.condominium_id);
        setSelectedCondo(condo as any);
        const condoMeetings = getMeetings(user.condominium_id);
        if (condoMeetings.length > 0) {
          const lastMeeting = condoMeetings[0];
          setActiveMeeting(lastMeeting as any);
          const resFromDb = getAllResolutions(lastMeeting.id);
          setResolutions(resFromDb as any);
        }
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
    setLoginForm({ email: '', password: '' });
    setLoginError(null);
  };

  const handleCreateCondo = (name: string, address: string) => {
    createCondominium(name, address);
    loadInitialData();
  };

  const handleSelectCondo = (condo: Condominium | null) => {
    setSelectedCondo(condo);
    setActiveMeeting(null);
    if (condo) {
      refreshCondoData(condo.id);
    }
  };

  const handleCreateNewMeeting = (title: string, date: string) => {
    if (selectedCondo) {
      createMeeting(selectedCondo.id, title, date);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleSelectMeeting = (meeting: GeneralMeeting | null) => {
    setActiveMeeting(meeting);
    if (meeting) {
      refreshMeetingData(meeting.id);
    }
  };

  const handleAddParticipant = (p: Participant) => {
    if (selectedCondo) {
      createVoter(p.name, p.email, p.password || 'pass123', selectedCondo.id);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleUpdateParticipant = (p: Participant) => {
    if (selectedCondo) {
      updateVoter(p.id, p.name, p.email);
      refreshCondoData(selectedCondo.id);
    }
  };

  const handleAddResolution = (r: Resolution) => {
    if (activeMeeting) {
      saveResolution({ ...r, meetingId: activeMeeting.id });
      refreshMeetingData(activeMeeting.id);
    }
  };

  const handleUpdateStatus = (id: string, status: ResolutionStatus) => {
    updateResStatus(id, status);
    if (activeMeeting) refreshMeetingData(activeMeeting.id);
  };

  const handleVote = (resId: string, option: VoteOption) => {
    if (!currentUser) return;
    registerVote(resId, currentUser.id, option);
    if (activeMeeting) refreshMeetingData(activeMeeting.id);
  };

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">Initialisation de la base sécurisée...</p>
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
          </div>
          
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-4px); }
              75% { transform: translateX(4px); }
            }
            .animate-shake {
              animation: shake 0.2s ease-in-out 0s 2;
            }
          `}</style>
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
          onSelectCondo={handleSelectCondo}
          onCreateCondo={handleCreateCondo}
          onSelectMeeting={handleSelectMeeting}
          onCreateMeeting={handleCreateNewMeeting}
          onAddParticipant={handleAddParticipant}
          onUpdateParticipant={handleUpdateParticipant}
          onAddResolution={handleAddResolution}
          onUpdateResolutionStatus={handleUpdateStatus}
        />
      ) : (
        currentUser && (
          <div className="space-y-6">
             <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-800">{selectedCondo?.name}</h2>
              <p className="text-slate-500 text-sm">{selectedCondo?.address}</p>
            </div>
            <VoterBoard 
              resolutions={resolutions}
              currentUser={currentUser}
              onVote={handleVote}
            />
          </div>
        )
      )}
    </Layout>
  );
};

export default App;
