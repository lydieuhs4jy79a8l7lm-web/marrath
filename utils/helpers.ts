import { Category } from '../types';

export const calculateCategory = (birthDateString: string): string => {
  if (!birthDateString) return Category.UNKNOWN;

  const birthDate = new Date(birthDateString);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  
  // Adjust if birthday hasn't occurred yet this year (optional precision, usually year is enough for races)
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Logic based on prompt rules
  if (age >= 12 && age <= 13) return Category.BENJAMIN;
  if (age >= 14 && age <= 15) return Category.MINIME;
  if (age >= 16 && age <= 17) return Category.CADET;
  if (age >= 18 && age <= 19) return Category.JUNIOR;
  if (age >= 20 && age <= 22) return Category.ESPOIR;
  if (age >= 23 && age <= 39) return Category.SENIOR;
  if (age >= 40) return Category.MASTER;

  return Category.UNKNOWN; // Or "Enfant" if < 12
};

export const generateBibNumber = (): string => {
  // Client-side generation for demo. Ideally this is a Backend Hook.
  // Format: RUN{Year}-{Random4Digits}
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `RUN${year}-${random}`;
};

export const formatTime = (isoString?: string): string => {
  if (!isoString) return '--:--:--';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 2 // milliseconds for race precision
  } as any).format(date);
};