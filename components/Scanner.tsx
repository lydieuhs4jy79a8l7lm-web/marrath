import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { pb } from '../services/pocketbase';
import { QRPayload, Participant } from '../types';
import { formatTime } from '../utils/helpers';
import { AlertTriangle, Check, RefreshCcw, Volume2, Keyboard, Search } from 'lucide-react';

const Scanner: React.FC = () => {
  const [scanResult, setScanResult] = useState<{ status: 'success' | 'error' | 'idle'; message: string; participant?: Participant } | null>(null);
  const [manualBib, setManualBib] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  
  // Ref to track if the component is mounted to prevent state updates on unmounted component
  // and to handle strict mode double-invocation.
  const isMounted = useRef(false);

  // Fonction pour générer des sons sans fichiers externes via AudioContext
  const playFeedbackSound = (type: 'success' | 'error') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        if (type === 'success') {
            // Son type "Ding" montant (Victoire/Validation)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // Do (C5)
            osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // Octave au-dessus
            
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else {
            // Son type "Buzzer" grave (Erreur)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(110, ctx.currentTime); // La grave
            osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3); // Descendant
            
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        }
    } catch (e) {
        console.error("Audio feedback failed", e);
    }
  };

  useEffect(() => {
    isMounted.current = true;
    
    // If we have a result, the scanner UI is hidden, so do not init scanner.
    if (scanResult) return;

    let scannerInstance: Html5QrcodeScanner | null = null;

    // Slight delay to ensure DOM is ready
    const initTimer = setTimeout(() => {
        if (!isMounted.current) return;
        // Verify element exists
        if (!document.getElementById("reader")) return;
        
        try {
            // Cleanup existing instance if any (though cleanup function should have handled it)
            if (scannerRef.current) {
                scannerRef.current.clear().catch(() => {});
                scannerRef.current = null;
            }

            scannerInstance = new Html5QrcodeScanner(
                "reader",
                { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    // Important: disable flip to avoid mirroring confusion
                    disableFlip: false 
                },
                false
            );
            scannerRef.current = scannerInstance;
    
            scannerInstance.render(onScanSuccess, onScanFailure);
        } catch (e) {
            console.error("Scanner init error", e);
        }
    }, 100);

    return () => {
      isMounted.current = false;
      clearTimeout(initTimer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.warn("Failed to clear html5-qrcode scanner. ", error);
        });
        scannerRef.current = null;
      }
    };
    // Re-run effect when scanResult changes (to re-init when going back to scan mode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanResult]);

  const processInput = async (inputValue: string) => {
    if (!inputValue) return;

    if (scannerRef.current) {
        try {
             // Pause scanning to process
             // Note: pause() might throw if not scanning, safe to ignore
            scannerRef.current.pause();
        } catch(e) { /* ignore */ }
    }

    try {
      let data: Partial<QRPayload> = {};
      
      // 1. Format Validation (JSON vs Raw String)
      try {
        const parsed = JSON.parse(inputValue);
        // Basic check to see if it looks like our payload
        if(parsed && (parsed.id || parsed.bib)) {
            data = parsed;
        } else {
            // Valid JSON but not our schema, treat as raw bib
            data = { bib: inputValue };
        }
      } catch (e) {
        // Not JSON, treat as raw bib number
        data = { bib: inputValue.trim() };
      }

      let participant: Participant;

      // 2. Participant Lookup (ID or Fallback to Bib)
      if (data.id) {
        try {
            participant = await pb.collection('participants').getOne<Participant>(data.id);
        } catch (err: any) {
            if (err.status === 404) throw new Error("Participant introuvable (ID inconnu).");
            throw err;
        }
      } else if (data.bib) {
        // Fallback for pre-assigned bibs or manual entry
        try {
            participant = await pb.collection('participants').getFirstListItem<Participant>(`bibNumber="${data.bib}"`);
        } catch (err: any) {
             if (err.status === 404) throw new Error(`Dossard "${data.bib}" non attribué.`);
             throw err;
        }
      } else {
        throw new Error("Donnée invalide : Aucune identification.");
      }

      // 3. Status Check
      if (participant.status === 'finished') {
        playFeedbackSound('error');
        setScanResult({
            status: 'error',
            message: `Déjà arrivé à ${formatTime(participant.finishedAt)}.`,
            participant
        });
        return;
      }

      // 4. Calculate Rank
      const existing = await pb.collection('participants').getList(1, 1, {
        filter: `status = 'finished' && category = '${participant.category}' && gender = '${participant.gender}'`,
        $autoCancel: false
      });
      
      const rankCat = existing.totalItems + 1;
      const now = new Date().toISOString();

      // 5. Update Record
      const updated = await pb.collection('participants').update<Participant>(participant.id, {
        status: 'finished',
        finishedAt: now,
        rankCategory: rankCat
      });

      playFeedbackSound('success');
      setScanResult({
        status: 'success',
        message: 'Arrivée validée !',
        participant: updated
      });
      setManualBib(''); // Clear input

    } catch (err: any) {
      console.error(err);
      playFeedbackSound('error');
      
      let msg = err.message || "Erreur de traitement.";
      if (err.status === 0) msg = "Erreur de connexion au serveur PocketBase.";

      setScanResult({
        status: 'error',
        message: msg
      });
      
      // If error, resume scanning so they can try again or scan another
      // Unless it's a "fatal" error, but typically we want to keep going.
      // However, for UX, maybe we keep the error displayed until manual reset?
      // The current UI shows the error result screen, so we don't need to resume scanner immediately behind it.
    }
  };

  const onScanSuccess = (decodedText: string) => {
    processInput(decodedText);
  };

  const onScanFailure = (error: any) => {
    // Standard noise, ignore
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualBib.trim()) {
        processInput(manualBib.trim());
    }
  };

  const resetScanner = () => {
    // When we reset, we set scanResult to null.
    // This triggers the useEffect to re-initialize the scanner.
    setScanResult(null);
    setManualBib('');
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-4 text-center text-slate-800 flex items-center justify-center gap-2">
        <Volume2 size={20} className="text-slate-400" /> Scan Arrivée
      </h2>
      
      {!scanResult && (
        <div className="space-y-6 animate-fade-in">
            {/* Camera Area */}
            <div id="reader" className="w-full bg-slate-200 rounded-lg overflow-hidden shadow-inner min-h-[300px] border border-slate-300"></div>
            
            {/* Divider */}
            <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-300"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-semibold uppercase">Ou saisie manuelle</span>
                <div className="flex-grow border-t border-slate-300"></div>
            </div>

            {/* Manual Input Area */}
            <form onSubmit={handleManualSubmit} className="bg-white p-4 rounded-lg shadow-md border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                    <Keyboard size={14} /> Numéro de dossard
                </label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={manualBib}
                        onChange={(e) => setManualBib(e.target.value)}
                        placeholder="Ex: RUN2025-001"
                        className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono font-bold uppercase"
                    />
                    <button 
                        type="submit"
                        className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-slate-700 transition flex items-center justify-center"
                    >
                        <Search size={24} />
                    </button>
                </div>
            </form>
        </div>
      )}

      {scanResult && (
        <div className={`mt-6 p-6 rounded-xl shadow-lg text-center animate-bounce-in ${
            scanResult.status === 'success' 
            ? 'bg-green-50 border-4 border-green-500 shadow-green-200' 
            : 'bg-red-50 border-4 border-red-500 shadow-red-200'
        }`}>
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-transform transform scale-110 ${
                scanResult.status === 'success' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            }`}>
                {scanResult.status === 'success' ? <Check size={48} strokeWidth={3}/> : <AlertTriangle size={48} strokeWidth={3}/>}
            </div>

            <h3 className="text-3xl font-black mb-2 uppercase tracking-tight">
                {scanResult.status === 'success' ? 'ARRIVÉE OK !' : 'ATTENTION'}
            </h3>
            
            <p className="text-lg font-medium mb-4 text-slate-800">{scanResult.message}</p>

            {scanResult.participant && (
                <div className="text-left bg-white p-4 rounded-lg shadow-sm text-slate-700 mb-6 border border-slate-200">
                    <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                         {scanResult.participant.profilePicture && (
                            <img 
                                src={pb.files.getUrl(scanResult.participant, scanResult.participant.profilePicture, { thumb: '100x100' })} 
                                className="w-16 h-16 rounded-full object-cover border"
                                alt="Profil"
                            />
                        )}
                        <div>
                            <p className="font-bold text-xl text-gray-900">{scanResult.participant.firstName} {scanResult.participant.lastName}</p>
                            <p className="font-mono text-gray-500">{scanResult.participant.bibNumber}</p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="font-bold text-gray-500">Catégorie :</span>
                        <span>{scanResult.participant.category} ({scanResult.participant.gender})</span>
                    </div>
                    {scanResult.participant.rankCategory && (
                        <div className="mt-3 pt-3 border-t text-center">
                            <span className="text-sm text-gray-500 uppercase font-bold">Classement Catégorie</span>
                            <div className="text-4xl font-black text-orange-600 animate-pulse">
                                #{scanResult.participant.rankCategory}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <button 
                onClick={resetScanner}
                className="w-full py-4 text-lg bg-slate-800 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-slate-700 transition shadow-md active:scale-95"
            >
                <RefreshCcw size={24} /> Scanner le suivant
            </button>
        </div>
      )}

      {!scanResult && (
        <div className="mt-8 p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
            <div className="flex items-center gap-2 font-bold mb-2">
                <AlertTriangle size={16} /> Mode Opératoire
            </div>
            <ul className="list-disc pl-5 space-y-1">
                <li>Visez le QR Code du dossard <b>OU</b> saisissez le numéro manuellement.</li>
                <li>Le son <span className="font-bold">Ding</span> confirme l'arrivée.</li>
                <li>Le son <span className="font-bold">Buzzer</span> indique une erreur.</li>
            </ul>
        </div>
      )}
      
      {/* Styles d'animation inline pour la simplicité */}
      <style>{`
        @keyframes bounce-in {
            0% { transform: scale(0.9); opacity: 0; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); }
        }
        .animate-bounce-in {
            animation: bounce-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in {
            animation: fade-in 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default Scanner;