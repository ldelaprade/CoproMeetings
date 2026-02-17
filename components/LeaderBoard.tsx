
import React, { useState } from 'react';
import { Participant, Resolution, ResolutionStatus, VoteOption } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { refineResolution } from '../services/geminiService';

interface LeaderBoardProps {
  participants: Participant[];
  resolutions: Resolution[];
  onAddParticipant: (p: Participant) => void;
  onAddResolution: (r: Resolution) => void;
  onUpdateResolutionStatus: (id: string, status: ResolutionStatus) => void;
}

const LeaderBoard: React.FC<LeaderBoardProps> = ({ 
  participants, 
  resolutions, 
  onAddParticipant, 
  onAddResolution,
  onUpdateResolutionStatus 
}) => {
  const [activeTab, setActiveTab] = useState<'resolutions' | 'voters' | 'results'>('resolutions');
  const [newVoter, setNewVoter] = useState({ name: '', email: '', password: '' });
  
  // States for resolution creation
  const [newTitle, setNewTitle] = useState('');
  const [newRes, setNewRes] = useState('');
  
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedResultRes, setSelectedResultRes] = useState<string | null>(null);

  const handleAddVoter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoter.name || !newVoter.email || !newVoter.password) {
      alert("Veuillez remplir tous les champs, y compris le mot de passe.");
      return;
    }
    onAddParticipant({
      id: Math.random().toString(36).substr(2, 9),
      name: newVoter.name,
      email: newVoter.email,
      password: newVoter.password
    });
    setNewVoter({ name: '', email: '', password: '' });
  };

  const handleExportCSV = () => {
    if (participants.length === 0) return;
    const headers = ['ID', 'Nom', 'Email'];
    const rows = participants.map(p => [
      p.id, 
      `"${p.name.replace(/"/g, '""')}"`, 
      `"${p.email.replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `participants_ag_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDraftResolution = async () => {
    if (!newRes) return;
    setLoadingAI(true);
    try {
      const refined = await refineResolution(newRes);
      setNewTitle(refined.title);
      setNewRes(refined.description);
    } catch (error) {
      console.error("Erreur lors de la formulation IA", error);
      alert("L'IA n'a pas pu formuler la résolution. Vous pouvez continuer manuellement.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAddFinalResolution = () => {
    if (!newTitle || !newRes) {
      alert("Veuillez fournir un titre et une description pour la résolution.");
      return;
    }
    onAddResolution({
      id: Math.random().toString(36).substr(2, 9),
      meetingId: 1,
      title: newTitle,
      description: newRes,
      status: ResolutionStatus.PENDING,
      votes: []
    });
    setNewTitle('');
    setNewRes('');
  };

  const getVoteCounts = (resolution: Resolution) => {
    const counts = { [VoteOption.YES]: 0, [VoteOption.NO]: 0, [VoteOption.ABSTAIN]: 0 };
    resolution.votes.forEach(v => counts[v.option]++);
    return counts;
  };

  const getVoteData = (resolution: Resolution) => {
    const counts = getVoteCounts(resolution);
    return [
      { name: 'POUR', value: counts[VoteOption.YES], color: '#10b981' },
      { name: 'CONTRE', value: counts[VoteOption.NO], color: '#ef4444' },
      { name: 'ABSTENTION', value: counts[VoteOption.ABSTAIN], color: '#94a3b8' },
    ];
  };

  const activeRes = resolutions.find(r => r.id === selectedResultRes);

  return (
    <div className="space-y-6">
      <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
        {(['resolutions', 'voters', 'results'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab === 'resolutions' ? 'Résolutions' : tab === 'voters' ? 'Émargement' : 'Résultats Live'}
          </button>
        ))}
      </div>

      {activeTab === 'voters' && (
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-semibold mb-4 text-slate-800">Inscrire un copropriétaire</h3>
            <form onSubmit={handleAddVoter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nom complet</label>
                <input 
                  type="text" 
                  value={newVoter.name}
                  onChange={e => setNewVoter({...newVoter, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Jean Dupont"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Email</label>
                <input 
                  type="email" 
                  value={newVoter.email}
                  onChange={e => setNewVoter({...newVoter, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="jean@mail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mot de passe provisoire</label>
                <input 
                  type="password" 
                  value={newVoter.password}
                  onChange={e => setNewVoter({...newVoter, password: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
                Générer accès
              </button>
            </form>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase">Liste d'émargement numérique</h3>
              <button 
                onClick={handleExportCSV}
                disabled={participants.length === 0}
                className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Exporter CSV</span>
              </button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Identité</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Email</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Accès</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participants.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors text-sm">
                      <td className="px-6 py-4 font-medium text-slate-800">{p.name}</td>
                      <td className="px-6 py-4 text-slate-600">{p.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 uppercase">
                          Activé
                        </span>
                      </td>
                    </tr>
                  ))}
                  {participants.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-400 italic">Aucun copropriétaire inscrit pour cette AG.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'resolutions' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold mb-2">Rédaction de Résolution Assistée</h3>
            <p className="text-sm text-slate-500 mb-4 italic">Décrivez l'objet, cliquez sur Formuler, ajustez si besoin, puis ajoutez à l'ordre du jour.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Titre de la résolution</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Ex: Travaux de ravalement"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Contenu / Idée brute</label>
                <textarea 
                  value={newRes}
                  onChange={e => setNewRes(e.target.value)}
                  placeholder="Ex: Vote des travaux de ravalement de la façade rue de Rivoli."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                />
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleDraftResolution}
                  disabled={loadingAI || !newRes}
                  className="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-100 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                >
                  {loadingAI ? (
                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" /></svg>
                      <span>Formuler par IA</span>
                    </>
                  )}
                </button>
                <button 
                  onClick={handleAddFinalResolution}
                  disabled={!newTitle || !newRes}
                  className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-indigo-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  <span>Ajouter à l'ordre du jour</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Ordre du jour ({resolutions.length})</h3>
            {resolutions.map(res => (
              <div key={res.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-grow max-w-2xl">
                  <div className="flex items-center space-x-3 mb-1">
                    <h4 className="font-bold text-slate-800">{res.title}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      res.status === ResolutionStatus.ACTIVE ? 'bg-green-100 text-green-700' :
                      res.status === ResolutionStatus.CLOSED ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {res.status === ResolutionStatus.ACTIVE ? 'Ouvert' : res.status === ResolutionStatus.CLOSED ? 'Clos' : 'En attente'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{res.description}</p>
                </div>
                <div className="flex space-x-2 shrink-0">
                  {res.status === ResolutionStatus.PENDING && (
                    <button 
                      onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.ACTIVE)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      Démarrer vote
                    </button>
                  )}
                  {res.status === ResolutionStatus.ACTIVE && (
                    <button 
                      onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.CLOSED)}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      Clôturer
                    </button>
                  )}
                  {res.status === ResolutionStatus.CLOSED && (
                    <button 
                      onClick={() => { setSelectedResultRes(res.id); setActiveTab('results'); }}
                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
                    >
                      Détails Live
                    </button>
                  )}
                </div>
              </div>
            ))}
            {resolutions.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 italic text-sm">
                Aucune résolution n'a été ajoutée pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="md:col-span-1 space-y-2">
              <h3 className="text-sm font-bold text-slate-500 uppercase px-2 mb-4">Résolutions</h3>
              <div className="space-y-1">
                {resolutions.map(res => (
                  <button
                    key={res.id}
                    onClick={() => setSelectedResultRes(res.id)}
                    className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                      selectedResultRes === res.id 
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' 
                      : 'bg-white border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="truncate">{res.title}</div>
                    <div className="text-[10px] opacity-60 mt-1">{res.votes.length} vote(s) exprimé(s)</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              {activeRes ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    {getVoteData(activeRes).map((data) => (
                      <div key={data.name} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{data.name}</span>
                        <span className="text-2xl font-bold" style={{ color: data.color }}>{data.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Main Content Card */}
                  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800">{activeRes.title}</h3>
                        <p className="text-sm text-slate-500">Participation : {Math.round((activeRes.votes.length / Math.max(participants.length, 1)) * 100)}%</p>
                      </div>
                    </div>
                    
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getVoteData(activeRes)} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="value" name="Nombre de votes" radius={[6, 6, 0, 0]} barSize={50}>
                              {getVoteData(activeRes).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-700 flex items-center">
                          <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                          Détails nominatifs
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                          {activeRes.votes.length > 0 ? activeRes.votes.map(v => {
                            const participant = participants.find(p => p.id === v.voterId.toString());
                            return (
                              <div key={v.voterId} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm">
                                <span className="font-medium text-slate-700">{participant?.name || `ID: ${v.voterId}`}</span>
                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                  v.option === VoteOption.YES ? 'bg-green-100 text-green-700' : 
                                  v.option === VoteOption.NO ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'
                                }`}>{v.option}</span>
                              </div>
                            );
                          }) : (
                            <div className="text-center py-10 text-slate-400 italic text-sm bg-slate-50 rounded-lg border border-dashed border-slate-200">
                              Aucun bulletin déposé pour l'instant.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white h-96 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-sm space-y-3">
                  <svg className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  <span>Sélectionnez une résolution pour observer les votes en temps réel.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderBoard;
