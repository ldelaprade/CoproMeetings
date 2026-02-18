
import React, { useState } from 'react';
import { Resolution, ResolutionStatus, VoteOption, UserLogin } from '../types';
import { updateUserPassword } from '../services/dbService';

interface VoterBoardProps {
  resolutions: Resolution[];
  currentUser: UserLogin;
  onVote: (resId: string, option: VoteOption) => void;
}

const VoterBoard: React.FC<VoterBoardProps> = ({ resolutions, currentUser, onVote }) => {
  const [activeTab, setActiveTab] = useState<'votes' | 'security'>('votes');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [updateStatus, setUpdateStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  const activeResolutions = resolutions.filter(r => r.status === ResolutionStatus.ACTIVE);
  const closedResolutions = resolutions.filter(r => r.status === ResolutionStatus.CLOSED);

  const hasVoted = (res: Resolution) => res.votes.some(v => v.voterId === currentUser.id);
  const getMyVote = (res: Resolution) => res.votes.find(v => v.voterId === currentUser.id)?.option;

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setUpdateStatus({ type: 'error', msg: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (passwords.new.length < 6) {
      setUpdateStatus({ type: 'error', msg: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    
    updateUserPassword(currentUser.id, passwords.new);
    setUpdateStatus({ type: 'success', msg: 'Mot de passe mis à jour avec succès !' });
    setPasswords({ current: '', new: '', confirm: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
        <button
          onClick={() => setActiveTab('votes')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'votes' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Votes en direct
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'security' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Sécurité & Profil
        </button>
      </div>

      {activeTab === 'votes' && (
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <h3 className="text-xl font-bold text-slate-800">Scrutins en cours</h3>
              </div>
              <div className="flex items-center text-[10px] text-indigo-600 font-bold uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md">
                <span className="w-2 h-2 bg-indigo-600 rounded-full mr-2 animate-ping"></span>
                Live Sync Connecté
              </div>
            </div>
            
            {activeResolutions.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                <div className="text-slate-200 mb-2">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-400 font-medium">L'ordre du jour n'a pas encore de vote actif.</p>
                <p className="text-xs text-slate-300 mt-1 italic">Veuillez patienter pendant que le gestionnaire ouvre la prochaine résolution.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {activeResolutions.map(res => {
                  const voted = hasVoted(res);
                  const myChoice = getMyVote(res);

                  return (
                    <div key={res.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden border-l-4 border-l-indigo-600 animate-slide-in">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-3">
                           <h4 className="text-xl font-bold text-slate-800">{res.title}</h4>
                           {voted && (
                             <span className="flex items-center text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase border border-green-100">
                               <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                               Bulletin déposé
                             </span>
                           )}
                        </div>
                        <p className="text-slate-600 mb-6 leading-relaxed whitespace-pre-line text-sm">{res.description}</p>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <button 
                            onClick={() => onVote(res.id, VoteOption.YES)}
                            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all group relative ${
                              myChoice === VoteOption.YES 
                              ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-100' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
                            }`}
                          >
                            <span className="text-lg font-bold">POUR</span>
                            <span className="text-[10px] opacity-60">Validation</span>
                            {myChoice === VoteOption.YES && (
                              <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1 shadow-md">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </button>
                          
                          <button 
                            onClick={() => onVote(res.id, VoteOption.NO)}
                            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all group relative ${
                              myChoice === VoteOption.NO 
                              ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-100' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                            }`}
                          >
                            <span className="text-lg font-bold">CONTRE</span>
                            <span className="text-[10px] opacity-60">Refus</span>
                            {myChoice === VoteOption.NO && (
                              <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </button>
                          
                          <button 
                            onClick={() => onVote(res.id, VoteOption.ABSTAIN)}
                            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all group relative ${
                              myChoice === VoteOption.ABSTAIN 
                              ? 'bg-slate-200 border-slate-500 text-slate-800 ring-2 ring-slate-100' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-200 hover:border-slate-400'
                            }`}
                          >
                            <span className="text-lg font-bold uppercase">Abstention</span>
                            <span className="text-[10px] opacity-60">Neutre</span>
                            {myChoice === VoteOption.ABSTAIN && (
                              <div className="absolute -top-2 -right-2 bg-slate-600 text-white rounded-full p-1 shadow-md">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                              </div>
                            )}
                          </button>
                        </div>
                        <p className="mt-4 text-[10px] text-slate-400 text-center italic">
                          Vous pouvez modifier votre choix jusqu'à la clôture du scrutin par le gestionnaire.
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Historique des résolutions</h3>
            <div className="grid gap-3 opacity-60 grayscale hover:grayscale-0 transition-all">
              {closedResolutions.map(res => (
                <div key={res.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center text-sm">
                  <div>
                    <h5 className="font-semibold text-slate-700">{res.title}</h5>
                    <p className="text-[10px] text-slate-400">Scrutin clos • {res.votes.length} exprimés</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Mon vote</span>
                    <span className="font-bold text-slate-600">{getMyVote(res) || 'Non participant'}</span>
                  </div>
                </div>
              ))}
              {closedResolutions.length === 0 && (
                <p className="text-xs text-slate-400 italic">Aucune archive disponible.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="max-w-xl mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Modifier mon mot de passe</h3>
            <p className="text-sm text-slate-500 mb-6 italic">Il est recommandé d'utiliser un mot de passe unique pour sécuriser vos droits de vote.</p>
            
            {updateStatus && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${
                updateStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {updateStatus.msg}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nouveau mot de passe</label>
                <input 
                  type="password" 
                  value={passwords.new}
                  onChange={e => setPasswords({...passwords, new: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Confirmer le nouveau mot de passe</label>
                <input 
                  type="password" 
                  value={passwords.confirm}
                  onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                Mettre à jour mes accès
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-slate-100">
              <h4 className="text-sm font-bold text-slate-700 uppercase mb-4">Informations de profil</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Nom complet</span>
                  <span className="font-medium text-slate-800">{currentUser.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Email enregistré</span>
                  <span className="font-medium text-slate-800">{currentUser.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Statut</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 uppercase">Copropriétaire</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-in { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default VoterBoard;
