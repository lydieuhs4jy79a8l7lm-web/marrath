
export enum Category {
  BENJAMIN = 'Benjamin (12-13)',
  MINIME = 'Minime (14-15)',
  CADET = 'Cadet (16-17)',
  JUNIOR = 'Junior (18-19)',
  ESPOIR = 'Espoir (20-22)',
  SENIOR = 'Senior (23-39)',
  MASTER = 'Master (40+)',
  UNKNOWN = 'Inconnu'
}

export enum Gender {
  M = 'M',
  F = 'F'
}

export interface Participant {
  id: string;
  collectionId: string;
  collectionName: string;
  created: string;
  updated: string;
  
  // Basic Info
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string; // ISO string YYYY-MM-DD
  category: string;
  phone?: string; // New field
  profilePicture?: string;
  
  // Race Data
  bibNumber: string; // e.g., RUN2025-001
  status: 'registered' | 'finished' | 'dnf';
  finishedAt?: string; // ISO timestamp
  rankCategory?: number;
  rankGlobal?: number;
}

// Data embedded in the QR Code
export interface QRPayload {
  id: string;
  bib: string;
  n: string; // Name compressed
  c: string; // Category compressed
}