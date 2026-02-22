
export enum VoteOption {
  YES = 'POUR',
  NO = 'CONTRE',
  ABSTAIN = 'ABSTENTION'
}

export enum ResolutionStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED'
}

export type RoleType = 'MANAGER' | 'VOTER';

export interface Participant {
  id: string;
  name: string;
  email: string;
  password?: string;
  isActive: boolean;
}

export interface Condominium {
  id: number;
  name: string;
  address: string;
  managerId: number;
}

export interface UserLogin {
  id: number;
  name: string;
  email: string;
  password?: string;
  condominiumId?: number; // Optionnel tant qu'une session n'est pas choisie
  role: RoleType;
  isActive: boolean;
}

export interface GeneralMeeting {
  id: number;
  condominiumId: number;
  date: string;
  title: string;
}

export interface Vote {
  voterId: number;
  option: VoteOption;
  timestamp: number;
  voteKind?: 'REAL' | 'INSTRUCTION';
}

export type PowerMode = 'PRE_FILLED' | 'DELEGATED';

export interface PowerMandate {
  meetingId: number;
  grantorId: number;
  granteeId: number;
  mode: PowerMode;
  createdAt: number;
}

export interface Resolution {
  id: string;
  meetingId: number;
  title: string;
  description: string;
  status: ResolutionStatus;
  votes: Vote[];
  instructionVotes?: Vote[];
}
