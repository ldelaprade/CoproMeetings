
import React, { useState } from 'react';
import { Participant, Resolution, ResolutionStatus, VoteOption, Condominium, GeneralMeeting } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
  onUpdateParticipant: (p: Participant) => void;
  onAddResolution: (r: Resolution) => void;
  onUpdateResolutionStatus: (id: string, status: ResolutionStatus) => void;
  onDeleteResolution: (id: string) => void;
  onReset: () => void;
}

const LeaderBoard: React.FC<LeaderBoardProps> = ({ 
  condominiums, selectedCondo, meetings, activeMeeting, participants, resolutions, 
  onSelectCondo, onCreateCondo, onSelectMeeting, onCreateMeeting, 
  onAddParticipant, onUpdateParticipant, onAddResolution, onUpdateResolutionStatus, onDeleteResolution,
  onReset
}) => {
  const [activeTab, setActiveTab] = useState<'coproprietaires' | 'meetings' | 'schema'>('coproprietaires');
  const [meetingTab, setMeetingTab] = useState<'resolutions' | 'results'>('resolutions');
  const [showNewMeetingForm, setShowNewMeetingForm] = useState(false);
  const [showNewCondoForm, setShowNewCondoForm] = useState(false);
  const [newCondo, setNewCondo] = useState({ name: '', address: '' });
  const [newMeeting, setNewMeeting] = useState({ title: '', date: new Date().toISOString().split('T')[0] });
  const [newVoter, setNewVoter] = useState({ name: '', email: '', password: '1234' });
  const [editingVoter, setEditingVoter] = useState<Participant | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newRes, setNewRes] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedResolutionResult, setSelectedResolutionResult] = useState<Resolution | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void} | null>(null);

  const handleVoterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVoter) {
      onUpdateParticipant({ ...editingVoter, name: newVoter.name, email: newVoter.email });
      setEditingVoter(null);
    } else {
      onAddParticipant({ id: Math.random().toString(), name: newVoter.name, email: newVoter.email, password: newVoter.password });
    }
    setNewVoter({ name: '', email: '', password: '1234' });
  };

  const handleCreateMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateMeeting(newMeeting.title, newMeeting.date);
    setNewMeeting({ title: '', date: new Date().toISOString().split('T')[0] });
    setShowNewMeetingForm(false);
  };

  const handleCreateCondo = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateCondo(newCondo.name, newCondo.address);
    setNewCondo({ name: '', address: '' });
    setShowNewCondoForm(false);
  };

  const handleDraftResolution = async () => {
    setLoadingAI(true);
    try {
      const res = await refineResolution(newRes);
      setNewTitle(res.title);
      setNewRes(res.description);
    } catch (e) { console.error(e); }
    finally { setLoadingAI(false); }
  };

  const handleAddResolution = () => {
    onAddResolution({ id: Math.random().toString(36).substr(2, 9), meetingId: activeMeeting!.id, title: newTitle, description: newRes, status: ResolutionStatus.PENDING, votes: [] });
    setNewTitle(''); setNewRes('');
  };

  const getVoteData = (res: Resolution) => {
    const y = res.votes.filter(v => v.option === VoteOption.YES).length;
    const n = res.votes.filter(v => v.option === VoteOption.NO).length;
    const a = res.votes.filter(v => v.option === VoteOption.ABSTAIN).length;
    return [
      { name: 'POUR', value: y, color: '#10b981' },
      { name: 'CONTRE', value: n, color: '#ef4444' },
      { name: 'ABSTENTION', value: a, color: '#94a3b8' }
    ];
  };

  if (!selectedCondo) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestion des Copropriétés</h2>
            <p className="text-slate-500">Sélectionnez une copropriété pour gérer ses assemblées et ses membres.</p>
          </div>
          <button 
            onClick={() => setShowNewCondoForm(!showNewCondoForm)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            {showNewCondoForm ? 'Annuler' : '+ Nouvelle Copropriété'}
          </button>
        </div>

        {showNewCondoForm && (
          <div className="bg-white p-8 rounded-3xl border border-indigo-100 shadow-xl animate-slide-down">
            <h3 className="font-bold text-lg mb-4 text-slate-800">Enregistrer une nouvelle copropriété</h3>
            <form onSubmit={handleCreateCondo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input 
                placeholder="Nom de la copropriété" 
                className="px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 ring-indigo-500"
                value={newCondo.name}
                onChange={e => setNewCondo({...newCondo, name: e.target.value})}
                required
              />
              <input 
                placeholder="Adresse complète" 
                className="px-5 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 ring-indigo-500"
                value={newCondo.address}
                onChange={e => setNewCondo({...newCondo, address: e.target.value})}
                required
              />
              <button className="md:col-span-2 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">Créer la copropriété</button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {condominiums.map(condo => (
            <div key={condo.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                </div>
                <button 
                  onClick={() => onSelectCondo(condo)}
                  className="bg-slate-900 text-white px-6 py-2 rounded-xl text-sm font-bold opacity-0 group-hover:opacity-100 transition-all"
                >
                  Gérer
                </button>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-1">{condo.name}</h3>
              <p className="text-sm text-slate-500">{condo.address}</p>
            </div>
          ))}
          {condominiums.length === 0 && !showNewCondoForm && (
            <div className="md:col-span-2 py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">Aucune copropriété enregistrée.</p>
              <button onClick={() => setShowNewCondoForm(true)} className="text-indigo-600 font-bold mt-2">Ajouter la première</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => onSelectCondo(null)}
            className="p-2 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm"
            title="Changer de copropriété"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 8.959 8.959 0 01-9 9m9-9H3" /></svg>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedCondo.name}</h2>
            <p className="text-xs text-slate-500 font-medium">{selectedCondo.address}</p>
          </div>
        </div>
      </div>

      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full animate-scale-up">
            <h3 className="text-xl font-bold mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-8">{confirmDialog.message}</p>
            <div className="flex space-x-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Annuler</button>
              <button onClick={confirmDialog.onConfirm} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg">Confirmer</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex space-x-1 bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
        <button onClick={() => setActiveTab('coproprietaires')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'coproprietaires' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Copropriétaires</button>
        <button onClick={() => setActiveTab('meetings')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'meetings' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Assemblées Générales</button>
        <button onClick={() => setActiveTab('schema')} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'schema' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Architecture DB</button>
      </div>

      {activeTab === 'coproprietaires' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-bold text-slate-800 mb-6">{editingVoter ? 'Modifier' : 'Ajouter'} un Copropriétaire</h3>
            <form onSubmit={handleVoterSubmit} className="space-y-4">
              <input placeholder="Nom" className="w-full px-4 py-2 border rounded-xl" value={newVoter.name} onChange={e => setNewVoter({...newVoter, name: e.target.value})} required />
              <input type="email" placeholder="Email" className="w-full px-4 py-2 border rounded-xl" value={newVoter.email} onChange={e => setNewVoter({...newVoter, email: e.target.value})} required />
              {!editingVoter && <input type="password" placeholder="Pass (Défaut: 1234)" className="w-full px-4 py-2 border rounded-xl" value={newVoter.password} onChange={e => setNewVoter({...newVoter, password: e.target.value})} />}
              <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold">{editingVoter ? 'Enregistrer' : 'Ajouter au registre'}</button>
            </form>
          </div>
          <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400">
                <tr><th className="px-6 py-4">Nom</th><th className="px-6 py-4">Email</th><th className="px-6 py-4 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y">
                {participants.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 group transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700">{p.name}</td>
                    <td className="px-6 py-4 text-slate-500">{p.email}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setEditingVoter(p); setNewVoter({name:p.name, email:p.email, password:''}); }} className="text-indigo-600 font-bold text-xs uppercase opacity-0 group-hover:opacity-100 transition-all">Editer</button>
                    </td>
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
                <h3 className="font-bold text-slate-700">Sessions AG</h3>
                <button onClick={() => setShowNewMeetingForm(true)} className="bg-indigo-100 text-indigo-700 px-6 py-2 rounded-xl text-xs font-bold hover:bg-indigo-200">+ Créer une AG</button>
              </div>
              {showNewMeetingForm && (
                <form onSubmit={handleCreateMeeting} className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100 animate-slide-down space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input placeholder="Titre (ex: AG Ordinaire 2024)" className="px-5 py-3 rounded-xl border bg-white" value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} required />
                    <input type="date" className="px-5 py-3 rounded-xl border bg-white" value={newMeeting.date} onChange={e => setNewMeeting({...newMeeting, date: e.target.value})} required />
                  </div>
                  <button className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100">Lancer la création</button>
                </form>
              )}
              <div className="grid gap-4">
                {meetings.map(m => (
                  <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center hover:shadow-md transition-all">
                    <div><h4 className="font-bold text-lg text-slate-800">{m.title}</h4><p className="text-sm text-slate-500">{new Date(m.date).toLocaleDateString()}</p></div>
                    <button onClick={() => onSelectMeeting(m)} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">Ouvrir</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-800 text-white p-6 rounded-3xl flex justify-between items-center shadow-xl">
                <div className="flex items-center space-x-4">
                  <button onClick={() => onSelectMeeting(null)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                  <div><h3 className="text-xl font-bold">{activeMeeting.title}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Session active</p></div>
                </div>
                <div className="flex bg-slate-700 p-1 rounded-xl">
                  <button onClick={() => setMeetingTab('resolutions')} className={`px-4 py-2 rounded-lg text-xs font-bold ${meetingTab === 'resolutions' ? 'bg-indigo-600' : 'text-slate-400'}`}>Résolutions</button>
                  <button onClick={() => setMeetingTab('results')} className={`px-4 py-2 rounded-lg text-xs font-bold ${meetingTab === 'results' ? 'bg-indigo-600' : 'text-slate-400'}`}>Détails</button>
                </div>
              </div>

              {meetingTab === 'resolutions' && (
                <div className="space-y-6 animate-fade-in">
                  <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                    <h4 className="font-bold text-slate-800">Ajouter une résolution</h4>
                    <input placeholder="Titre" className="w-full px-5 py-2 border rounded-xl" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                    <textarea placeholder="Idée brute pour formulation IA..." className="w-full px-5 py-3 border rounded-xl min-h-[100px]" value={newRes} onChange={e => setNewRes(e.target.value)} />
                    <div className="flex space-x-4">
                      <button onClick={handleDraftResolution} disabled={loadingAI} className="flex-1 py-3 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl font-bold">{loadingAI ? 'Rédaction...' : 'Rédiger via IA'}</button>
                      <button onClick={handleAddResolution} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100">Valider</button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {resolutions.map(res => {
                      const pct = participants.length ? Math.round((res.votes.length / participants.length) * 100) : 0;
                      return (
                        <div key={res.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center group relative overflow-hidden">
                          <div className="w-1/4 pr-4 border-r">
                             <h5 className="font-bold text-sm truncate">{res.title}</h5>
                             <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded ${res.status === ResolutionStatus.ACTIVE ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{res.status}</span>
                          </div>
                          <div className="flex-grow px-10">
                             <div className="flex justify-between items-center mb-2"><span className="text-[10px] text-slate-400 uppercase font-bold">Participation</span><span className="text-[10px] font-extrabold text-indigo-600">{pct}%</span></div>
                             <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                <div className={`h-full transition-all duration-1000 ${res.status === ResolutionStatus.ACTIVE ? 'bg-indigo-600 animate-pulse' : 'bg-slate-300'}`} style={{width: `${pct}%`}} />
                             </div>
                          </div>
                          <div className="flex space-x-2 pl-4">
                             {res.status === ResolutionStatus.PENDING && <button onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.ACTIVE)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Ouvrir</button>}
                             {res.status === ResolutionStatus.ACTIVE && <button onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.CLOSED)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold">Clôturer</button>}
                             <button onClick={() => setConfirmDialog({isOpen:true, title:'Retirer?', message:'Voulez-vous supprimer cette résolution?', onConfirm:() => {onDeleteResolution(res.id); setConfirmDialog(null);}})} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {meetingTab === 'results' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in">
                  <div className="space-y-2">
                    {resolutions.map(r => (
                      <button 
                        key={r.id} 
                        onClick={() => setSelectedResolutionResult(r)} 
                        className={`w-full text-left p-4 border rounded-2xl transition-colors ${selectedResolutionResult?.id === r.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                      >
                        <div className="font-bold text-xs truncate">{r.title}</div>
                        <div className="text-[9px] text-slate-400">{r.votes.length} exprimés</div>
                      </button>
                    ))}
                    {resolutions.length === 0 && <p className="text-xs text-slate-400 p-4">Aucune résolution pour le moment.</p>}
                  </div>
                  <div className="md:col-span-3 bg-white p-8 rounded-3xl border border-slate-200">
                    {selectedResolutionResult ? (
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-xl font-bold text-slate-800 mb-2">{selectedResolutionResult.title}</h4>
                          <p className="text-sm text-slate-500">{selectedResolutionResult.description}</p>
                        </div>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getVoteData(selectedResolutionResult)}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
                              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                              <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                              <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={60}>
                                {getVoteData(selectedResolutionResult).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center space-x-8">
                          {getVoteData(selectedResolutionResult).map((d) => (
                            <div key={d.name} className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}} />
                              <span className="text-xs font-bold text-slate-600">{d.name}: {d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                        <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        <p className="font-medium">Sélectionnez une résolution pour voir l'analyse détaillée des votes.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="animate-fade-in space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={onReset}
              className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span>Réinitialiser toutes les données</span>
            </button>
          </div>
          <SchemaVisualizer />
        </div>
      )}
    </div>
  );
};

export default LeaderBoard;
