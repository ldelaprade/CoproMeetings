
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
  condominiumId: number;
  role: RoleType;
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
}

export interface Resolution {
  id: string;
  meetingId: number;
  title: string;
  description: string;
  status: ResolutionStatus;
  votes: Vote[];
}
