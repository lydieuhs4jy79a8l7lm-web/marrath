import PocketBase from 'pocketbase';

// L'URL est récupérée depuis les variables d'environnement (Vite)
// Fallback sur l'URL de démo si non définie
// Fix: Cast import.meta to any to resolve TS error: Property 'env' does not exist on type 'ImportMeta'
const PB_URL = (import.meta as any).env?.VITE_POCKETBASE_URL || 'https://pocketbase-gc44g0840kw008gwscgc08kg.167.114.98.78.sslip.io';

export const pb = new PocketBase(PB_URL);

// Helper to check connection (optional usage in UI)
export const checkBackendHealth = async (): Promise<boolean> => {
  try {
    await pb.health.check();
    return true;
  } catch (e) {
    return false;
  }
};