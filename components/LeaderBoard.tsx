
import React, { useState } from 'react';
import { Participant, Resolution, ResolutionStatus, VoteOption, Condominium, GeneralMeeting } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { refineResolution } from '../services/geminiService';
import SchemaVisualizer from './SchemaVisualizer';

interface LeaderBoardProps {
  condominiums: Condominium[];
  selectedCondo: Condominium | null;
  meetings: GeneralMeeting[];
  activeMeeting: GeneralMeeting | null;
  participants: Participant[];
  resolutions: Resolution[];
  onSelectCondo: (condo: Condominium | null) => void;
  onCreateCondo: (name: string, address: string) => void;
  onSelectMeeting: (meeting: GeneralMeeting | null) => void;
  onCreateMeeting: (title: string, date: string) => void;
  onAddParticipant: (p: Participant) => void;
  onAddResolution: (r: Resolution) => void;
  onUpdateResolutionStatus: (id: string, status: ResolutionStatus) => void;
}

const LeaderBoard: React.FC<LeaderBoardProps> = ({ 
  condominiums,
  selectedCondo,
  meetings,
  activeMeeting,
  participants, 
  resolutions, 
  onSelectCondo,
  onCreateCondo,
  onSelectMeeting,
  onCreateMeeting,
  onAddParticipant, 
  onAddResolution,
  onUpdateResolutionStatus 
}) => {
  const [activeTab, setActiveTab] = useState<'coproprietaires' | 'meetings' | 'schema'>('coproprietaires');
  const [meetingTab, setMeetingTab] = useState<'resolutions' | 'results'>('resolutions');
  
  // Forms
  const [showNewCondoForm, setShowNewCondoForm] = useState(false);
  const [newCondo, setNewCondo] = useState({ name: '', address: '' });
  
  const [showNewMeetingForm, setShowNewMeetingForm] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: '', date: new Date().toISOString().split('T')[0] });

  const [newVoter, setNewVoter] = useState({ name: '', email: '', password: '' });
  
  // Resolution Draft
  const [newTitle, setNewTitle] = useState('');
  const [newRes, setNewRes] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedResultRes, setSelectedResultRes] = useState<string | null>(null);

  // --- Handlers ---
  const handleCreateCondoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateCondo(newCondo.name, newCondo.address);
    setNewCondo({ name: '', address: '' });
    setShowNewCondoForm(false);
  };

  const handleCreateMeetingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateMeeting(newMeeting.title, newMeeting.date);
    setNewMeeting({ title: '', date: new Date().toISOString().split('T')[0] });
    setShowNewMeetingForm(false);
  };

  const handleAddVoter = (e: React.FormEvent) => {
    e.preventDefault();
    onAddParticipant({
      id: Math.random().toString(36).substr(2, 9),
      name: newVoter.name,
      email: newVoter.email,
      password: newVoter.password
    });
    setNewVoter({ name: '', email: '', password: '' });
  };

  const handleDraftResolution = async () => {
    if (!newRes) return;
    setLoadingAI(true);
    try {
      const refined = await refineResolution(newRes);
      setNewTitle(refined.title);
      setNewRes(refined.description);
    } catch (error) {
      console.error("AI Error", error);
      alert("L'IA n'a pas pu formuler la résolution.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAddFinalResolution = () => {
    onAddResolution({
      id: Math.random().toString(36).substr(2, 9),
      meetingId: activeMeeting?.id || 0,
      title: newTitle,
      description: newRes,
      status: ResolutionStatus.PENDING,
      votes: []
    });
    setNewTitle('');
    setNewRes('');
  };

  const getVoteData = (resolution: Resolution) => {
    const counts = { [VoteOption.YES]: 0, [VoteOption.NO]: 0, [VoteOption.ABSTAIN]: 0 };
    resolution.votes.forEach(v => counts[v.option]++);
    return [
      { name: 'POUR', value: counts[VoteOption.YES], color: '#10b981' },
      { name: 'CONTRE', value: counts[VoteOption.NO], color: '#ef4444' },
      { name: 'ABSTENTION', value: counts[VoteOption.ABSTAIN], color: '#94a3b8' },
    ];
  };

  // --- Sub-Views ---

  // 1. SELECT CONDO VIEW
  if (!selectedCondo) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Mes Copropriétés</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => setActiveTab('schema')}
              className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-300 transition-all"
            >
              Structure DB
            </button>
            <button 
              onClick={() => setShowNewCondoForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all"
            >
              + Nouvelle Copropriété
            </button>
          </div>
        </div>

        {activeTab === 'schema' && (
          <div className="animate-fade-in">
            <div className="flex items-center mb-4">
              <button onClick={() => setActiveTab('coproprietaires')} className="text-indigo-600 font-bold text-sm flex items-center hover:underline">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                Retour à la liste
              </button>
            </div>
            <SchemaVisualizer />
          </div>
        )}

        {activeTab !== 'schema' && (
          <>
            {showNewCondoForm && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-slide-down">
                <h3 className="font-bold mb-4">Enregistrer un nouvel immeuble</h3>
                <form onSubmit={handleCreateCondoSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    placeholder="Nom de la résidence" 
                    className="px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                    value={newCondo.name}
                    onChange={e => setNewCondo({...newCondo, name: e.target.value})}
                    required
                  />
                  <input 
                    placeholder="Adresse complète" 
                    className="px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                    value={newCondo.address}
                    onChange={e => setNewCondo({...newCondo, address: e.target.value})}
                    required
                  />
                  <div className="md:col-span-2 flex justify-end space-x-2">
                    <button type="button" onClick={() => setShowNewCondoForm(false)} className="px-4 py-2 text-slate-500 hover:text-slate-700">Annuler</button>
                    <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Enregistrer</button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {condominiums.map(condo => (
                <button 
                  key={condo.id}
                  onClick={() => onSelectCondo(condo)}
                  className="bg-white p-6 rounded-2xl border border-slate-200 text-left hover:border-indigo-400 hover:shadow-md transition-all group"
                >
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{condo.name}</h3>
                  <p className="text-sm text-slate-500">{condo.address}</p>
                </button>
              ))}
              {condominiums.length === 0 && (
                <div className="md:col-span-3 text-center py-20 text-slate-400 italic">
                  Aucune copropriété enregistrée.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Active resolution object for results display
  const selectedResObj = resolutions.find(r => r.id === selectedResultRes);

  // 2. CONDO ACTIVE VIEW
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 mb-4">
        <button onClick={() => onSelectCondo(null)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{selectedCondo.name}</h2>
          <p className="text-sm text-slate-500">{selectedCondo.address}</p>
        </div>
      </div>

      <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveTab('coproprietaires')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'coproprietaires' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Copropriétaires
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'meetings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Assemblées Générales
        </button>
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'schema' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Structure DB
        </button>
      </div>

      {activeTab === 'schema' && (
        <div className="animate-fade-in">
           <SchemaVisualizer />
        </div>
      )}

      {activeTab === 'coproprietaires' && (
        <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold mb-4 text-slate-800">Nouveau Votant</h3>
            <form onSubmit={handleAddVoter} className="space-y-4">
              <input 
                placeholder="Nom complet" 
                className="w-full px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                value={newVoter.name}
                onChange={e => setNewVoter({...newVoter, name: e.target.value})}
                required
              />
              <input 
                type="email" 
                placeholder="Email" 
                className="w-full px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                value={newVoter.email}
                onChange={e => setNewVoter({...newVoter, email: e.target.value})}
                required
              />
              <input 
                type="password" 
                placeholder="Mot de passe" 
                className="w-full px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                value={newVoter.password}
                onChange={e => setNewVoter({...newVoter, password: e.target.value})}
                required
              />
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors">
                Enregistrer
              </button>
            </form>
          </div>
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Participant</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {participants.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                    <td className="px-6 py-4 text-slate-600">{p.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'meetings' && (
        <div className="space-y-6 animate-fade-in">
          {!activeMeeting ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-700">Sessions d'Assemblées Générales</h3>
                <button 
                  onClick={() => setShowNewMeetingForm(true)}
                  className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-200 transition-all"
                >
                  + Créer une AG
                </button>
              </div>

              {showNewMeetingForm && (
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-sm animate-slide-down">
                  <h4 className="font-bold text-indigo-900 mb-4">Nouvelle session</h4>
                  <form onSubmit={handleCreateMeetingSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input 
                      placeholder="Titre de l'AG" 
                      className="md:col-span-2 px-4 py-2 bg-white border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                      value={newMeeting.title}
                      onChange={e => setNewMeeting({...newMeeting, title: e.target.value})}
                      required
                    />
                    <input 
                      type="date" 
                      className="px-4 py-2 bg-white border rounded-lg outline-none focus:ring-2 ring-indigo-500"
                      value={newMeeting.date}
                      onChange={e => setNewMeeting({...newMeeting, date: e.target.value})}
                      required
                    />
                    <div className="md:col-span-3 flex justify-end space-x-2">
                      <button type="button" onClick={() => setShowNewMeetingForm(false)} className="px-4 py-2 text-indigo-400 hover:text-indigo-600">Annuler</button>
                      <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Valider la création</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid gap-4">
                {meetings.map(m => (
                  <div key={m.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm hover:border-indigo-300 transition-all">
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{m.title}</h4>
                      <p className="text-sm text-slate-500 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                        {new Date(m.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <button 
                      onClick={() => onSelectMeeting(m)}
                      className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                    >
                      Démarrer session
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* MEETING ACTIVE NAVIGATION */}
              <div className="bg-slate-800 text-white p-6 rounded-2xl flex justify-between items-center">
                <div className="flex items-center space-x-4">
                   <button onClick={() => onSelectMeeting(null)} className="p-2 hover:bg-slate-700 rounded-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                   </button>
                   <div>
                    <h3 className="text-xl font-bold">{activeMeeting.title}</h3>
                    <p className="text-slate-400 text-sm">Session active • {new Date(activeMeeting.date).toLocaleDateString()}</p>
                   </div>
                </div>
                <div className="flex space-x-1 bg-slate-700 p-1 rounded-lg">
                  <button onClick={() => setMeetingTab('resolutions')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase ${meetingTab === 'resolutions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Résolutions</button>
                  <button onClick={() => setMeetingTab('results')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase ${meetingTab === 'results' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Résultats Live</button>
                </div>
              </div>

              {meetingTab === 'resolutions' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold mb-4">Préparation des résolutions</h3>
                    <div className="space-y-4">
                      <input 
                        placeholder="Titre court" 
                        className="w-full px-4 py-2 bg-slate-50 border rounded-lg"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                      />
                      <textarea 
                        placeholder="Idée brute pour formulation IA..." 
                        className="w-full px-4 py-3 bg-slate-50 border rounded-xl min-h-[100px]"
                        value={newRes}
                        onChange={e => setNewRes(e.target.value)}
                      />
                      <div className="flex gap-4">
                        <button onClick={handleDraftResolution} disabled={loadingAI || !newRes} className="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 py-3 rounded-xl font-bold">
                          {loadingAI ? 'Formulation...' : 'Formuler par IA'}
                        </button>
                        <button onClick={handleAddFinalResolution} disabled={!newTitle || !newRes} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">
                          Ajouter au vote
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {resolutions.map(res => (
                      <div key={res.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
                        <div className="max-w-2xl">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-bold text-slate-800">{res.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              res.status === ResolutionStatus.ACTIVE ? 'bg-green-100 text-green-700' : 
                              res.status === ResolutionStatus.CLOSED ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {res.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 line-clamp-1">{res.description}</p>
                        </div>
                        <div className="flex space-x-2">
                          {res.status === ResolutionStatus.PENDING && (
                            <button onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.ACTIVE)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Ouvrir vote</button>
                          )}
                          {res.status === ResolutionStatus.ACTIVE && (
                            <button onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.CLOSED)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Clôturer</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {meetingTab === 'results' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="md:col-span-1 space-y-2">
                    {resolutions.map(res => (
                      <button 
                        key={res.id} 
                        onClick={() => setSelectedResultRes(res.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${selectedResultRes === res.id ? 'bg-indigo-50 border-indigo-500' : 'bg-white border-slate-200'}`}
                      >
                        <div className="font-bold text-sm truncate">{res.title}</div>
                        <div className="text-[10px] text-slate-400">{res.votes.length} votes</div>
                      </button>
                    ))}
                   </div>
                   <div className="md:col-span-3">
                      {selectedResObj ? (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                           <h4 className="text-xl font-bold">{selectedResObj.title}</h4>
                           <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={getVoteData(selectedResObj)}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="name" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Bar dataKey="value">
                                    {getVoteData(selectedResObj).map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                           </div>
                           <div className="space-y-2">
                              {selectedResObj.votes.map((v, idx) => {
                                const participant = participants.find(p => p.id === v.voterId.toString());
                                return (
                                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm">
                                    <span className="font-medium">{participant?.name || 'Inconnu'}</span>
                                    <span className="font-bold uppercase text-[10px]">{v.option}</span>
                                  </div>
                                );
                              })}
                           </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 h-full rounded-2xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                          Sélectionnez une résolution pour voir les résultats.
                        </div>
                      )}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeaderBoard;
