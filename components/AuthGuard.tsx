import React, { useState, useEffect } from 'react';
import { Lock, Unlock, ArrowRight, AlertCircle } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
}

const SECRET_CODE = "GV25@";
const STORAGE_KEY = "marathon_auth_token";

const AuthGuard: React.FC<AuthGuardProps> = ({ children, title = "Accès Restreint" }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [error, setError] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Vérifier si déjà authentifié dans la session
    const storedAuth = sessionStorage.getItem(STORAGE_KEY);
    if (storedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setIsChecking(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode === SECRET_CODE) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setInputCode("");
      // Petit effet de vibration visuelle via timeout si on voulait, 
      // ici on se contente du message d'erreur
    }
  };

  if (isChecking) {
    return null; // ou un loader
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 text-center animate-fade-in">
        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <Lock className="text-orange-500" size={32} />
        </div>
        
        <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase">{title}</h2>
        <p className="text-slate-500 mb-8">Veuillez saisir le code organisateur pour accéder à cette section.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Code d'accès..."
              className={`w-full px-4 py-3 rounded-lg border outline-none transition font-mono text-center text-lg tracking-widest ${
                error 
                ? 'border-red-500 bg-red-50 text-red-900 focus:ring-2 focus:ring-red-200' 
                : 'border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200'
              }`}
              autoFocus
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm font-bold flex items-center justify-center gap-2 animate-bounce">
              <AlertCircle size={16} /> Code incorrect
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            Déverrouiller <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthGuard;