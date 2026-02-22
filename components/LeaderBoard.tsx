
import React, { useState } from 'react';
import { Participant, Resolution, ResolutionStatus, VoteOption, Condominium, GeneralMeeting, PowerMandate } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { refineResolution } from '../services/geminiService';
import { findUserByEmail } from '../services/dbService';
import SchemaVisualizer from './SchemaVisualizer';

interface LeaderBoardProps {
  condominiums: Condominium[];
  selectedCondo: Condominium | null;
  meetings: GeneralMeeting[];
  activeMeeting: GeneralMeeting | null;
  participants: Participant[];
  resolutions: Resolution[];
  powerMandates: PowerMandate[];
  onSelectCondo: (condo: Condominium | null) => void;
  onCreateCondo: (name: string, address: string) => void;
  onSelectMeeting: (meeting: GeneralMeeting | null) => void;
  onCreateMeeting: (title: string, date: string) => void;
  onAddParticipant: (p: Participant) => void;
  onUpdateParticipant: (p: Participant) => void;
  onAddResolution: (r: Resolution) => void;
  onUpdateResolutionStatus: (id: string, status: ResolutionStatus) => void;
  onDeleteResolution: (id: string) => void;
  onToggleParticipantStatus?: (id: string, active: boolean) => void;
  onDeleteParticipant?: (id: string) => { success: boolean, mode: 'deleted' | 'deactivated', name: string };
}

const LeaderBoard: React.FC<LeaderBoardProps> = ({ 
  condominiums,
  selectedCondo,
  meetings,
  activeMeeting,
  participants, 
  resolutions,
  powerMandates,
  onSelectCondo,
  onCreateCondo,
  onSelectMeeting,
  onCreateMeeting,
  onAddParticipant, 
  onUpdateParticipant,
  onAddResolution,
  onUpdateResolutionStatus,
  onDeleteResolution,
  onToggleParticipantStatus,
  onDeleteParticipant
}) => {
  const [activeTab, setActiveTab] = useState<'coproprietaires' | 'meetings' | 'schema'>('coproprietaires');
  const [meetingTab, setMeetingTab] = useState<'resolutions' | 'results'>('resolutions');
  
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [voterFormError, setVoterFormError] = useState<string | null>(null);

  const [showNewCondoForm, setShowNewCondoForm] = useState(false);
  const [newCondo, setNewCondo] = useState({ name: '', address: '' });
  const [showNewMeetingForm, setShowNewMeetingForm] = useState(false);
  const [newMeeting, setNewMeeting] = useState({ title: '', date: new Date().toISOString().split('T')[0] });

  const [newVoter, setNewVoter] = useState({ id: '', name: '', email: '', password: '' });
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [editingVoterId, setEditingVoterId] = useState<string | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [newRes, setNewRes] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [selectedResultRes, setSelectedResultRes] = useState<string | null>(null);

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

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handleEmailChange = (email: string) => {
    setNewVoter(prev => ({ ...prev, email }));
    setVoterFormError(null);

    // Si on est en train d'éditer, on ne fait pas la vérification d'existence temps réel (conflit potentiel)
    if (editingVoterId) return;

    if (validateEmail(email)) {
      const user = findUserByEmail(email);
      if (user) {
        setNewVoter(prev => ({ ...prev, name: user.name, password: '' }));
        setIsExistingAccount(true);
      } else {
        setIsExistingAccount(false);
        // Si on change l'email et que ce n'est plus un existant, on vide le nom si c'était celui d'un existant
        if (isExistingAccount) {
          setNewVoter(prev => ({ ...prev, name: '' }));
        }
      }
    } else {
      setIsExistingAccount(false);
    }
  };

  const handleVoterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVoterFormError(null);
    try {
      if (editingVoterId) {
        onUpdateParticipant({ id: editingVoterId, name: newVoter.name, email: newVoter.email, isActive: true });
        setEditingVoterId(null);
      } else {
        onAddParticipant({
          id: Math.random().toString(36).substr(2, 9),
          name: newVoter.name,
          email: newVoter.email,
          password: newVoter.password || '1234', // '1234' par défaut pour les existants
          isActive: true
        });
      }
      setNewVoter({ id: '', name: '', email: '', password: '' });
      setIsExistingAccount(false);
    } catch (error: any) {
      setVoterFormError(error.message || "Une erreur est survenue lors de l'enregistrement.");
    }
  };

  const startEditingVoter = (p: Participant) => {
    setEditingVoterId(p.id);
    setVoterFormError(null);
    setIsExistingAccount(false);
    setNewVoter({ id: p.id, name: p.name, email: p.email, password: '' });
  };

  const handleDeleteVoterClick = (p: Participant) => {
    setConfirmDialog({
      isOpen: true,
      title: "Confirmer la suppression",
      message: `Voulez-vous vraiment supprimer "${p.name}" ? Si ce votant a déjà déposé des bulletins, il sera seulement marqué comme périmé pour préserver l'historique des PV.`,
      onConfirm: () => {
        if (onDeleteParticipant) {
          const result = onDeleteParticipant(p.id);
          if (result.mode === 'deactivated') {
            setInfoMessage(`Le Votant ${result.name} a des votes à son actif et ne peut pas être détruit. Il a été passé en statut 'Périmé'.`);
          }
        }
        setConfirmDialog(null);
      }
    });
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

  const handleCloseVote = (res: Resolution) => {
    const votedCount = res.votes.length;
    const totalVoters = participants.filter(p => p.isActive).length;
    let message = "";
    if (votedCount === 0) {
      message = "Attention : aucun vote n'a été enregistré. Voulez-vous vraiment clôturer ?";
    } else if (votedCount < totalVoters) {
      message = `${votedCount}/${totalVoters} participants actifs ont voté. Clôturer le scrutin ?`;
    }

    if (message) {
      setConfirmDialog({
        isOpen: true,
        title: "Confirmer la clôture",
        message: message,
        onConfirm: () => {
          onUpdateResolutionStatus(res.id, ResolutionStatus.CLOSED);
          setConfirmDialog(null);
        }
      });
    } else {
      onUpdateResolutionStatus(res.id, ResolutionStatus.CLOSED);
    }
  };

  const handleDeleteResConfirm = (res: Resolution) => {
    setConfirmDialog({
      isOpen: true,
      title: "Retirer la résolution",
      message: `Voulez-vous supprimer définitivement "${res.title}" ?`,
      onConfirm: () => {
        onDeleteResolution(res.id);
        setConfirmDialog(null);
      }
    });
  };

  const handleExportCSV = () => {
    if (!activeMeeting || resolutions.length === 0) return;

    // Colonnes du CSV
    const headers = ["Résolution", "Statut", "Description", "Copropriétaire", "Vote", "Date"];
    
    // Construction des lignes
    const rows = resolutions.flatMap(res => {
      if (res.votes.length === 0) {
        return [[
          res.title,
          res.status === ResolutionStatus.CLOSED ? "Clos" : "Ouvert",
          res.description.replace(/(\r\n|\n|\r)/gm, " "),
          "N/A",
          "Aucun vote",
          ""
        ]];
      }
      
      return res.votes.map(v => {
        const p = participants.find(part => part.id === v.voterId.toString());
        return [
          res.title,
          res.status === ResolutionStatus.CLOSED ? "Clos" : "Ouvert",
          res.description.replace(/(\r\n|\n|\r)/gm, " "),
          p ? p.name : "Inconnu",
          v.option,
          new Date(v.timestamp).toLocaleString('fr-FR')
        ];
      });
    });

    // Génération du contenu CSV (séparateur point-virgule pour Excel FR)
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    // Ajout d'un BOM UTF-8 pour Excel
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `PV_AG_${activeMeeting.title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPowersCSV = () => {
    if (!activeMeeting) return;

    const headers = ["AG", "Mandant", "Mandataire", "Mode", "Date enregistrement"];

    const rows = powerMandates.length > 0
      ? powerMandates.map(mandate => [
          activeMeeting.title,
          getParticipantName(mandate.grantorId),
          getParticipantName(mandate.granteeId),
          mandate.mode === 'DELEGATED' ? 'Vote délégué' : 'Prérempli',
          new Date(mandate.createdAt).toLocaleString('fr-FR')
        ])
      : [[activeMeeting.title, 'Aucun', 'Aucun', 'Aucun pouvoir', '']];

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Pouvoirs_AG_${activeMeeting.title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getResolutionResultBadge = (res: Resolution) => {
    if (res.status !== ResolutionStatus.CLOSED) return null;
    const forVotes = res.votes.filter(v => v.option === VoteOption.YES).length;
    const againstVotes = res.votes.filter(v => v.option === VoteOption.NO).length;
    if (forVotes === 0 && againstVotes === 0) return <span className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border">Néant</span>;
    if (forVotes > againstVotes) return <span className="bg-green-100 text-green-800 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-green-200">Adopté</span>;
    if (againstVotes > forVotes) return <span className="bg-red-100 text-red-800 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-red-200">Rejeté</span>;
    return <span className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-amber-200">Égalité</span>;
  };

  const getVoteData = (res: Resolution) => {
    const yes = res.votes.filter(v => v.option === VoteOption.YES).length;
    const no = res.votes.filter(v => v.option === VoteOption.NO).length;
    const abstain = res.votes.filter(v => v.option === VoteOption.ABSTAIN).length;

    return [
      { name: 'POUR', value: yes, color: '#10b981' },
      { name: 'CONTRE', value: no, color: '#ef4444' },
      { name: 'ABSTENTION', value: abstain, color: '#94a3b8' }
    ];
  };

  const getParticipantName = (id: number) => participants.find(p => p.id === id.toString())?.name || `ID ${id}`;

  const renderPowerMandatesPanel = () => {
    const mandates = powerMandates;

    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">Pouvoirs de l'AG</h3>
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            {mandates.length} enregistré{mandates.length > 1 ? 's' : ''}
          </span>
        </div>

        {mandates.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Aucun pouvoir enregistré pour cette assemblée.</p>
        ) : (
          <div className="space-y-2">
            {mandates.map(mandate => (
              <div key={`${mandate.meetingId}-${mandate.grantorId}`} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="text-sm text-slate-700">
                  <span className="font-semibold">{getParticipantName(mandate.grantorId)}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="font-semibold">{getParticipantName(mandate.granteeId)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border ${mandate.mode === 'DELEGATED' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                    {mandate.mode === 'DELEGATED' ? 'Vote délégué' : 'Prérempli'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(mandate.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderConfirmationModal = () => {
    if (!confirmDialog || !confirmDialog.isOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-scale-up">
          <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmDialog.title}</h3>
          <p className="text-slate-600 mb-8 leading-relaxed">{confirmDialog.message}</p>
          <div className="flex space-x-3">
            <button onClick={() => setConfirmDialog(null)} className="flex-1 px-4 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-all">Annuler</button>
            <button onClick={confirmDialog.onConfirm} className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all">Confirmer</button>
          </div>
        </div>
      </div>
    );
  };

  if (!selectedCondo) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800">Mes Copropriétés</h2>
          <div className="flex space-x-2">
            <button onClick={() => setActiveTab('schema')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'schema' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Structure DB</button>
            <button onClick={() => setShowNewCondoForm(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-indigo-700 transition-all">+ Nouvelle Copropriété</button>
          </div>
        </div>

        {showNewCondoForm && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-lg animate-slide-down">
            <h3 className="font-bold mb-4">Enregistrer un nouvel immeuble</h3>
            <form onSubmit={handleCreateCondoSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Nom" className="px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500" value={newCondo.name} onChange={e => setNewCondo({...newCondo, name: e.target.value})} required />
              <input placeholder="Adresse" className="px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500" value={newCondo.address} onChange={e => setNewCondo({...newCondo, address: e.target.value})} required />
              <div className="md:col-span-2 flex justify-end space-x-2">
                <button type="button" onClick={() => setShowNewCondoForm(false)} className="px-4 py-2 text-slate-500">Annuler</button>
                <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Enregistrer</button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'schema' ? <div className="animate-fade-in"><button onClick={() => setActiveTab('coproprietaires')} className="text-indigo-600 font-bold text-sm flex items-center mb-4"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>Retour</button><SchemaVisualizer /></div> : 
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {condominiums.map(condo => (
            <button key={condo.id} onClick={() => onSelectCondo(condo)} className="bg-white p-6 rounded-2xl border border-slate-200 text-left hover:border-indigo-400 hover:shadow-md transition-all group">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2-2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg></div>
              <h3 className="font-bold text-slate-800 text-lg mb-1">{condo.name}</h3>
              <p className="text-sm text-slate-500">{condo.address}</p>
            </button>
          ))}
        </div>}
      </div>
    );
  }

  const selectedResObj = resolutions.find(r => r.id === selectedResultRes);

  return (
    <div className="space-y-6">
      {renderConfirmationModal()}
      
      {infoMessage && (
        <div className="fixed top-20 right-4 z-50 max-w-sm bg-indigo-600 text-white p-4 rounded-xl shadow-2xl animate-slide-in flex items-start">
          <svg className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="text-sm font-medium">{infoMessage}</div>
          <button onClick={() => setInfoMessage(null)} className="ml-4 hover:opacity-70"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
      )}

      <div className="flex items-center space-x-4 mb-4">
        <button onClick={() => onSelectCondo(null)} className="p-2 hover:bg-slate-200 rounded-lg"><svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
        <div><h2 className="text-2xl font-bold text-slate-800">{selectedCondo.name}</h2><p className="text-sm text-slate-500">{selectedCondo.address}</p></div>
      </div>

      <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
        <button onClick={() => setActiveTab('coproprietaires')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'coproprietaires' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>Copropriétaires</button>
        <button onClick={() => setActiveTab('meetings')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${activeTab === 'meetings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>Assemblées Générales</button>
      </div>

      {activeTab === 'coproprietaires' && (
        <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
          <div className="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h3 className="text-lg font-bold mb-4">{editingVoterId ? 'Modifier Votant' : 'Nouveau Votant'}</h3>
            
            {voterFormError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-lg flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {voterFormError}
              </div>
            )}

            <form onSubmit={handleVoterSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email</label>
                <input 
                  type="email" 
                  placeholder="votre@mail.com" 
                  className={`w-full px-4 py-2 bg-slate-50 border rounded-lg outline-none focus:ring-2 ring-indigo-500 transition-all ${isExistingAccount ? 'border-indigo-300 ring-indigo-50 bg-indigo-50/20' : ''}`} 
                  value={newVoter.email} 
                  onChange={e => handleEmailChange(e.target.value)} 
                  required 
                />
                {isExistingAccount && <p className="text-[10px] text-indigo-600 font-bold mt-1">✓ Utilisateur trouvé en base</p>}
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nom complet</label>
                <input 
                  placeholder="Prénom Nom" 
                  className={`w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 ring-indigo-500 transition-all ${isExistingAccount ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-200'}`} 
                  value={newVoter.name} 
                  onChange={e => setNewVoter({...newVoter, name: e.target.value})} 
                  readOnly={isExistingAccount}
                  required 
                />
              </div>

              {(!isExistingAccount && !editingVoterId) && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mot de passe provisoire</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 ring-indigo-500" 
                    value={newVoter.password} 
                    onChange={e => setNewVoter({...newVoter, password: e.target.value})} 
                    required 
                  />
                </div>
              )}
              
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  {editingVoterId ? 'Mettre à jour' : isExistingAccount ? 'Ajouter à la copropriété' : 'Créer & Ajouter'}
                </button>
                {editingVoterId && <button type="button" onClick={() => { setEditingVoterId(null); setVoterFormError(null); }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-bold">Annuler</button>}
              </div>
            </form>
          </div>
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b"><tr className="text-xs font-bold text-slate-500 uppercase"><th className="px-6 py-4">Nom</th><th className="px-6 py-4">Email</th><th className="px-6 py-4 text-right">Action</th></tr></thead>
              <tbody className="divide-y">{participants.map(p => (
                <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${!p.isActive ? 'opacity-50 grayscale bg-slate-50' : ''}`}>
                  <td className="px-6 py-4 font-medium">
                    {p.name}
                    {!p.isActive && <span className="ml-2 text-[8px] font-bold uppercase bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">Périmé</span>}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{p.email}</td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => startEditingVoter(p)} className="text-indigo-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-all uppercase">Modifier</button>
                    {p.isActive ? (
                      <button 
                        onClick={() => handleDeleteVoterClick(p)} 
                        className="text-red-500 font-bold text-xs opacity-0 group-hover:opacity-100 transition-all uppercase"
                      >
                        Supprimer
                      </button>
                    ) : (
                      <button 
                        onClick={() => onToggleParticipantStatus?.(p.id, true)} 
                        className="text-green-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition-all uppercase"
                      >
                        Réactiver
                      </button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
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
                <button onClick={() => setShowNewMeetingForm(true)} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-200 transition-all">+ Créer une AG</button>
              </div>

              {showNewMeetingForm && (
                <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-sm animate-slide-down">
                  <h4 className="font-bold text-indigo-900 mb-4">Nouvelle session</h4>
                  <form onSubmit={handleCreateMeetingSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input placeholder="Titre de l'AG" className="md:col-span-2 px-4 py-2 bg-white border rounded-lg outline-none" value={newMeeting.title} onChange={e => setNewMeeting({...newMeeting, title: e.target.value})} required />
                    <input type="date" className="px-4 py-2 bg-white border rounded-lg outline-none" value={newMeeting.date} onChange={e => setNewMeeting({...newMeeting, date: e.target.value})} required />
                    <div className="md:col-span-3 flex justify-end space-x-2">
                      <button type="button" onClick={() => setShowNewMeetingForm(false)} className="px-4 py-2 text-indigo-400">Annuler</button>
                      <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">Valider</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid gap-4">
                {meetings.map(m => (
                  <div key={m.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm hover:border-indigo-300 transition-all">
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg">{m.title}</h4>
                      <p className="text-sm text-slate-500 flex items-center"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>{new Date(m.date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <button onClick={() => onSelectMeeting(m)} className="bg-indigo-600 text-white px-8 py-2.5 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-all">Ouvrir</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-800 text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
                <div className="flex items-center space-x-4">
                   <button onClick={() => onSelectMeeting(null)} className="p-2 hover:bg-slate-700 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                   <div><h3 className="text-xl font-bold">{activeMeeting.title}</h3><p className="text-slate-400 text-sm">Session active • {new Date(activeMeeting.date).toLocaleDateString()}</p></div>
                </div>
                <div className="flex items-center">
                  <button 
                    onClick={handleExportPowersCSV}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center transition-all mr-2 border border-slate-600"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exporter Pouvoirs
                  </button>
                  <button 
                    onClick={handleExportCSV}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center transition-all mr-4 border border-slate-600"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exporter CSV
                  </button>
                  <div className="flex space-x-1 bg-slate-700 p-1 rounded-lg">
                    <button onClick={() => setMeetingTab('resolutions')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-all ${meetingTab === 'resolutions' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Résolutions</button>
                    <button onClick={() => setMeetingTab('results')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-all ${meetingTab === 'results' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Détails</button>
                  </div>
                </div>
              </div>

              {meetingTab === 'resolutions' && (
                <div className="space-y-6">
                  {renderPowerMandatesPanel()}

                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold mb-4">Préparation des résolutions</h3>
                    <div className="space-y-4">
                      <input placeholder="Titre court" className="w-full px-4 py-2 bg-slate-50 border rounded-lg focus:ring-2 ring-indigo-500 outline-none" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                      <textarea placeholder="Idée brute pour formulation IA..." className="w-full px-4 py-3 bg-slate-50 border rounded-xl min-h-[100px] focus:ring-2 ring-indigo-500 outline-none" value={newRes} onChange={e => setNewRes(e.target.value)} />
                      <div className="flex gap-4">
                        <button onClick={handleDraftResolution} disabled={loadingAI || !newRes} className="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 py-3 rounded-xl font-bold hover:bg-indigo-100 transition-colors">{loadingAI ? 'Formulation...' : 'Formuler par IA'}</button>
                        <button onClick={handleAddFinalResolution} disabled={!newTitle || !newRes} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">Ajouter au vote</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    {resolutions.map(res => {
                      const activeParticipantsCount = participants.filter(p => p.isActive).length;
                      const participationPercent = activeParticipantsCount > 0 ? Math.round((res.votes.length / activeParticipantsCount) * 100) : 0;
                      const instructionVotesCount = res.instructionVotes?.length || 0;
                      const forVotes     = res.votes.filter(v => v.option === VoteOption.YES).length;
                      const againstVotes = res.votes.filter(v => v.option === VoteOption.NO).length;
                      const abstainVotes = res.votes.filter(v => v.option === VoteOption.ABSTAIN).length;

                      let resultBorder = '';
                      if (res.status === ResolutionStatus.CLOSED) {
                        if (forVotes > 0 || againstVotes > 0) {
                          if (forVotes > againstVotes) resultBorder = 'border-l-green-500';
                          else if (againstVotes > forVotes) resultBorder = 'border-l-red-500';
                          else resultBorder = 'border-l-amber-400';
                        } else {
                          resultBorder = 'border-l-slate-300';
                        }
                      } else if (res.status === ResolutionStatus.ACTIVE) {
                        resultBorder = 'border-l-indigo-500';
                      } else {
                        resultBorder = 'border-l-amber-300';
                      }

                      return (
                        <div key={res.id} className={`bg-white p-6 rounded-2xl border border-slate-200 border-l-4 ${resultBorder} shadow-sm flex items-center group transition-all hover:border-indigo-200 relative overflow-hidden`}>
                          <div className="w-1/4 pr-4 border-r border-slate-100">
                            <div className="flex flex-col space-y-1">
                              <span className="font-bold text-slate-800 text-sm truncate block" title={res.title}>{res.title}</span>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap ${res.status === ResolutionStatus.ACTIVE ? 'bg-green-100 text-green-700' : res.status === ResolutionStatus.CLOSED ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'}`}>{res.status === ResolutionStatus.ACTIVE ? 'Scrutin ouvert' : res.status === ResolutionStatus.CLOSED ? `Clôturé` : 'En attente'}</span>
                                {res.status !== ResolutionStatus.CLOSED && instructionVotesCount > 0 && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    {instructionVotesCount} consigne{instructionVotesCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex-grow px-6 flex flex-col justify-center space-y-1.5">
                            <div className="flex items-center space-x-4">
                              <span className="flex items-center text-[11px] text-green-700 font-bold">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                Pour&nbsp;{forVotes}
                              </span>
                              <span className="flex items-center text-[11px] text-red-700 font-bold">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                                Contre&nbsp;{againstVotes}
                              </span>
                              <span className="flex items-center text-[11px] text-slate-500 font-bold">
                                <span className="w-2 h-2 bg-slate-400 rounded-full mr-1"></span>
                                Abstention&nbsp;{abstainVotes}
                              </span>
                              <span className="ml-auto text-[10px] font-extrabold text-indigo-600 bg-indigo-50 px-2 rounded-full">{participationPercent}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 shadow-inner">
                              <div className={`h-full transition-all duration-1000 ease-out relative ${res.status === ResolutionStatus.ACTIVE ? 'bg-indigo-600 animate-pulse-subtle' : 'bg-slate-300'}`} style={{ width: `${Math.min(100, participationPercent)}%` }}>
                                {res.status === ResolutionStatus.ACTIVE && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>}
                              </div>
                            </div>
                          </div>

                          <div className="flex space-x-2 flex-shrink-0 pl-4 items-center">
                            {res.status === ResolutionStatus.PENDING && <button onClick={() => onUpdateResolutionStatus(res.id, ResolutionStatus.ACTIVE)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-all shadow-sm">Ouvrir</button>}
                            {res.status === ResolutionStatus.ACTIVE && <button onClick={() => handleCloseVote(res)} className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-sm">Clôturer</button>}
                            {res.status === ResolutionStatus.CLOSED && getResolutionResultBadge(res)}
                            <button onClick={() => handleDeleteResConfirm(res)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Retirer"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {meetingTab === 'results' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                   <div className="md:col-span-1 space-y-2">
                    {resolutions.map(res => (
                      <button key={res.id} onClick={() => setSelectedResultRes(res.id)} className={`w-full text-left p-4 rounded-xl border transition-all ${selectedResultRes === res.id ? 'bg-indigo-50 border-indigo-500 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}><div className="font-bold text-sm truncate">{res.title}</div><div className="text-[10px] text-slate-400 font-medium">{res.votes.length} votes</div></button>
                    ))}
                   </div>
                   <div className="md:col-span-3">
                      {selectedResObj ? (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fade-in">
                           <div className="flex justify-between items-start border-b pb-4"><div><h4 className="text-xl font-bold text-slate-800">{selectedResObj.title}</h4><p className="text-sm text-slate-500 mt-1">{selectedResObj.description}</p></div>{getResolutionResultBadge(selectedResObj)}</div>
                           <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={getVoteData(selectedResObj)}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip cursor={{fill: '#f8fafc'}} /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{getVoteData(selectedResObj).map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Bar></BarChart></ResponsiveContainer></div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {selectedResObj.votes.map((v, idx) => {
                                const participant = participants.find(p => p.id === v.voterId.toString());
                                return (<div key={idx} className={`flex justify-between items-center p-3 bg-slate-50 rounded-lg text-xs border border-slate-100 ${participant && !participant.isActive ? 'opacity-50' : ''}`}><span className="font-semibold text-slate-700">{participant?.name || 'Inconnu'} {participant && !participant.isActive && '(Départ)'}</span><span className={`font-extrabold uppercase px-2 py-0.5 rounded text-[9px] ${v.option === VoteOption.YES ? 'bg-green-100 text-green-700' : v.option === VoteOption.NO ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{v.option}</span></div>);
                              })}
                           </div>

                           <div className="pt-2 border-t border-slate-100">
                              <h5 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Consignes de vote (pré-votes)</h5>
                              {(selectedResObj.instructionVotes?.length || 0) === 0 ? (
                                <p className="text-xs text-slate-400 italic">Aucune consigne enregistrée pour cette résolution.</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {selectedResObj.instructionVotes?.map((v, idx) => {
                                    const grantor = participants.find(p => p.id === v.voterId.toString());
                                    const mandate = powerMandates.find(m => m.grantorId === v.voterId);
                                    const grantee = mandate ? participants.find(p => p.id === mandate.granteeId.toString()) : null;

                                    return (
                                      <div key={`instruction-${idx}`} className={`p-3 bg-indigo-50 rounded-lg text-xs border border-indigo-100 ${grantor && !grantor.isActive ? 'opacity-60' : ''}`}>
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold text-indigo-900">
                                            {grantor?.name || 'Inconnu'} {grantor && !grantor.isActive && '(Départ)'}
                                          </span>
                                          <span className={`font-extrabold uppercase px-2 py-0.5 rounded text-[9px] ${v.option === VoteOption.YES ? 'bg-green-100 text-green-700' : v.option === VoteOption.NO ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                                            {v.option}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-indigo-700">
                                          Mandataire : {grantee?.name || 'Non défini'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                           </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 h-full min-h-[400px] rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 text-center px-10"><p className="font-medium">Sélectionnez une résolution à gauche pour analyser les résultats.</p></div>
                      )}
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-pulse-subtle { animation: pulse-subtle 2s infinite ease-in-out; }
        .animate-shimmer { animation: shimmer 3s infinite linear; }
        .animate-slide-in { animation: slideIn 0.3s ease-out; }
      `}</style>
    </div>
  );
};

export default LeaderBoard;
