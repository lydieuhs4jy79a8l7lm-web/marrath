import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';
import { pb } from '../services/pocketbase';
import { calculateCategory, generateBibNumber } from '../utils/helpers';
import { Gender, Participant, QRPayload } from '../types';
import { Save, RefreshCw, CheckCircle, AlertCircle, Scan, QrCode } from 'lucide-react';

type FormData = {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  category: string;
  phone: string;
};

const Registration: React.FC = () => {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      gender: Gender.M,
      firstName: '',
      lastName: '',
      birthDate: '',
      category: '',
      phone: ''
    }
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<Participant | null>(null);
  const [manualCategory, setManualCategory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New states for Bib assignment
  const [assignMode, setAssignMode] = useState<'auto' | 'manual'>('auto');
  const [manualBib, setManualBib] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const birthDate = watch('birthDate');

  useEffect(() => {
    if (birthDate && !manualCategory) {
      const cat = calculateCategory(birthDate);
      setValue('category', cat);
    }
  }, [birthDate, setValue, manualCategory]);

  // Scanner Effect
  useEffect(() => {
    if (showScanner) {
        // Init scanner
        const timer = setTimeout(() => {
            const elementId = "bib-scanner";
            if (!document.getElementById(elementId)) return;

            // Prevent double init
            if (scannerRef.current) return;

            const html5QrCode = new Html5Qrcode(elementId);
            scannerRef.current = html5QrCode;

            html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    // Success callback
                    try {
                        const data = JSON.parse(decodedText);
                        if (data.bib) {
                            setManualBib(data.bib);
                        } else {
                            setManualBib(decodedText);
                        }
                    } catch (e) {
                        setManualBib(decodedText);
                    }
                    setShowScanner(false);
                },
                (errorMessage) => {
                    // ignore errors for better UX
                }
            ).catch((err) => {
                console.error("Erreur démarrage caméra", err);
                setErrorMessage("Impossible d'accéder à la caméra. Vérifiez les permissions.");
                setShowScanner(false);
            });
        }, 100);

        return () => clearTimeout(timer);
    } else {
        // Cleanup
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                scannerRef.current = null;
            }).catch(err => {
                console.warn("Failed to stop scanner", err);
                scannerRef.current = null;
            });
        }
    }

    return () => {
        // Unmount cleanup
        if (scannerRef.current) {
            if (scannerRef.current.isScanning) {
                 scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(console.warn);
            } else {
                 scannerRef.current.clear();
            }
            scannerRef.current = null;
        }
    };
  }, [showScanner]);

  const onSubmit = async (data: FormData) => {
    if (assignMode === 'manual' && !manualBib.trim()) {
        setErrorMessage("Veuillez scanner ou entrer un numéro de dossard.");
        return;
    }

    setIsSubmitting(true);
    setSuccessData(null);
    setErrorMessage(null);

    try {
      // Basic client-side validations
      if (!data.firstName.trim() || !data.lastName.trim()) {
         throw new Error("Nom et Prénom sont obligatoires.");
      }
      
      const dateObj = new Date(data.birthDate);
      if (isNaN(dateObj.getTime())) {
        throw new Error("Date de naissance invalide");
      }
      
      const formattedDate = data.birthDate; 

      // --- VÉRIFICATION PRÉALABLE (Mode Manuel) ---
      if (assignMode === 'manual') {
          const checkBib = manualBib.trim();
          try {
              const existing = await pb.collection('participants').getFirstListItem(`bibNumber="${checkBib}"`);
              if (existing) {
                  // Message spécifique demandé par l'utilisateur
                  setErrorMessage(`Le dossard ${checkBib} est déjà attribué à ${existing.firstName} ${existing.lastName}.`);
                  setIsSubmitting(false);
                  return; // Arrêt immédiat
              }
          } catch (err: any) {
              // 404 signifie que le dossard est libre, on continue
              if (err.status !== 404) {
                  throw err; // Erreur technique réelle
              }
          }
      }

      let record;
      let attempts = 0;
      const maxAttempts = assignMode === 'manual' ? 1 : 3;
      
      while (!record && attempts < maxAttempts) {
          const bib = assignMode === 'manual' ? manualBib.trim() : generateBibNumber();
          
          const payload = {
              firstName: data.firstName.trim(),
              lastName: data.lastName.trim(),
              gender: data.gender,
              birthDate: formattedDate,
              category: data.category || calculateCategory(data.birthDate),
              bibNumber: bib,
              phone: data.phone,
              status: 'registered',
              // Workaround: The backend seems to have a required 'fieldText' field 
              // that is not in the standard schema. We send a dummy value to satisfy it.
              fieldText: '.' 
          };

          try {
            record = await pb.collection('participants').create<Participant>(payload);
          } catch (innerErr: any) {
              const status = innerErr?.status || 0;
              const responseData = innerErr?.response?.data || {};
              const bibError = responseData?.bibNumber;
              
              // Check for unique constraint violation
              const isBibCollision = status === 400 && bibError && bibError.code === 'validation_not_unique';
              
              if (isBibCollision) {
                  if (assignMode === 'manual') {
                      // Si collision en mode manuel (concurrence), on tente de récupérer le propriétaire
                      try {
                          const owner = await pb.collection('participants').getFirstListItem(`bibNumber="${bib}"`);
                          throw new Error(`Le dossard ${bib} est déjà attribué à ${owner.firstName} ${owner.lastName}.`);
                      } catch (fetchErr) {
                          throw new Error(`Le dossard ${bib} est déjà pris.`);
                      }
                  }
                  attempts++;
                  console.warn(`Bib collision for ${bib}, retrying (${attempts}/${maxAttempts})...`);
                  if (attempts >= maxAttempts) throw new Error("Impossible de générer un dossard unique après plusieurs essais.");
              } else {
                  throw innerErr;
              }
          }
      }

      if (record) {
        setSuccessData(record);
        reset();
        setManualBib('');
      }

    } catch (err: any) {
      console.error("Registration Error:", err);
      if (err.response) console.error("Response Data:", JSON.stringify(err.response, null, 2));
      
      let msg = "Une erreur est survenue.";

      const status = err?.status;
      const data = err?.response?.data || {};

      if (status === 403) {
          msg = "Permission refusée (403). Vérifiez les 'API Rules' de PocketBase (create rule).";
      } else if (status === 400) {
           const fieldErrors = Object.entries(data).map(([field, error]: [string, any]) => {
               let fieldName = field;
               if (field === 'bibNumber') fieldName = 'Dossard';
               if (field === 'firstName') fieldName = 'Prénom';
               if (field === 'lastName') fieldName = 'Nom';
               if (field === 'birthDate') fieldName = 'Date de naissance';
               if (field === 'gender') fieldName = 'Sexe';
               if (field === 'phone') fieldName = 'Téléphone';
               if (field === 'fieldText') fieldName = 'Erreur Configuration Backend (fieldText)';
               
               return `• ${fieldName}: ${error.message}`;
           });
           
           if (fieldErrors.length > 0) {
               msg = `Erreur de validation :\n${fieldErrors.join('\n')}`;
           } else {
               // Fallback if data is empty or generic
               msg = `Erreur de validation : ${err.message}`;
           }
      } else if (status === 0) {
            msg = "Erreur réseau. Vérifiez l'URL du backend.";
      } else if (status === 404) {
            msg = "Collection introuvable (404).";
      } else if (err instanceof Error) {
          msg = err.message;
      } else if (typeof err === 'string') {
          msg = err;
      }

      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-slate-800 p-6 text-white">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Save /> Inscription Coureur
          </h2>
          <p className="text-slate-400 mt-1">Enregistrement d'un nouveau participant</p>
        </div>

        {errorMessage && (
            <div className={`border-l-4 p-4 m-6 rounded-r shadow-sm ${
                errorMessage.includes('déjà attribué') 
                ? 'bg-orange-50 border-orange-500' 
                : 'bg-red-50 border-red-500'
            }`}>
                <div className="flex items-start">
                    <div className={`flex-shrink-0 mt-1 ${
                        errorMessage.includes('déjà attribué') ? 'text-orange-500' : 'text-red-500'
                    }`}>
                        <AlertCircle size={24} />
                    </div>
                    <div className="ml-3 w-full overflow-hidden">
                        <p className={`text-sm font-bold uppercase tracking-wide ${
                            errorMessage.includes('déjà attribué') ? 'text-orange-800' : 'text-red-700'
                        }`}>
                            {errorMessage.includes('déjà attribué') ? 'Attention : Dossard existant' : "Échec de l'enregistrement"}
                        </p>
                        <pre className={`text-sm mt-1 whitespace-pre-wrap break-words font-mono p-2 rounded ${
                             errorMessage.includes('déjà attribué') ? 'text-orange-800 bg-orange-100' : 'text-red-600 bg-red-100'
                        }`}>
                            {errorMessage}
                        </pre>
                    </div>
                </div>
            </div>
        )}

        {successData ? (
          <div className="p-8 text-center animate-fade-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Inscription Validée !</h3>
            <p className="text-gray-600 mb-6">Le dossard a été généré/assigné avec succès.</p>
            
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 inline-block max-w-sm w-full mx-auto shadow-inner">
              <div className="text-4xl font-black text-slate-800 mb-2 tracking-tighter">
                {successData.bibNumber}
              </div>
              <div className="text-lg font-semibold text-slate-600 mb-4">
                {successData.firstName} {successData.lastName}
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow-sm inline-block">
                <QRCodeCanvas 
                  value={JSON.stringify({
                    id: successData.id,
                    bib: successData.bibNumber,
                    n: `${successData.firstName} ${successData.lastName}`,
                    c: successData.category
                  } as QRPayload)}
                  size={180}
                  level={"M"}
                />
              </div>
            </div>

            <button 
              onClick={() => setSuccessData(null)}
              className="mt-8 block w-full sm:w-auto mx-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Nouvelle Inscription
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Attribution du Dossard</label>
                <div className="flex gap-4 mb-4">
                    <button
                        type="button"
                        onClick={() => setAssignMode('auto')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition ${assignMode === 'auto' ? 'bg-white border-2 border-orange-500 text-orange-600 shadow-sm' : 'bg-gray-100 text-gray-500'}`}
                    >
                        Génération Auto
                    </button>
                    <button
                        type="button"
                        onClick={() => setAssignMode('manual')}
                        className={`flex-1 py-2 px-3 rounded-md text-sm font-semibold transition ${assignMode === 'manual' ? 'bg-white border-2 border-orange-500 text-orange-600 shadow-sm' : 'bg-gray-100 text-gray-500'}`}
                    >
                        Scanner / Manuel
                    </button>
                </div>

                {assignMode === 'manual' && (
                    <div className="animate-fade-in">
                        {showScanner ? (
                            <div className="mb-4">
                                <div id="bib-scanner" className="bg-black rounded-lg overflow-hidden min-h-[300px]"></div>
                                <button type="button" onClick={() => setShowScanner(false)} className="mt-2 text-sm text-red-500 underline text-center w-full">Annuler le scan</button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualBib}
                                    onChange={(e) => setManualBib(e.target.value)}
                                    placeholder="Scannez ou tapez le n°"
                                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono font-bold text-lg"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowScanner(true)}
                                    className="bg-slate-800 text-white px-4 rounded-lg hover:bg-slate-700"
                                    title="Scanner le code QR"
                                >
                                    <Scan size={24} />
                                </button>
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-2">
                            Scannez le QR code sur le dossard pré-imprimé pour l'associer au coureur.
                        </p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  {...register('lastName', { required: 'Le nom est requis' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition uppercase"
                  placeholder="DUPONT"
                />
                {errors.lastName && <span className="text-red-500 text-xs">{errors.lastName.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input
                  type="text"
                  {...register('firstName', { required: 'Le prénom est requis' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Jean"
                />
                {errors.firstName && <span className="text-red-500 text-xs">{errors.firstName.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
                <select
                  {...register('gender', { required: true })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value={Gender.M}>Homme</option>
                  <option value={Gender.F}>Femme</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
                <input
                  type="date"
                  {...register('birthDate', { required: 'La date est requise' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {errors.birthDate && <span className="text-red-500 text-xs">{errors.birthDate.message}</span>}
              </div>
              
              {/* Phone Field Added Here */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  {...register('phone')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Catégorie</label>
                  <button 
                    type="button" 
                    onClick={() => setManualCategory(!manualCategory)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {manualCategory ? 'Calculer automatiquement' : 'Modifier manuellement'}
                  </button>
                </div>
                <input
                  type="text"
                  readOnly={!manualCategory}
                  {...register('category')}
                  className={`w-full px-4 py-2 border rounded-lg outline-none ${manualCategory ? 'bg-white border-blue-300 ring-2 ring-blue-100' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Déterminée automatiquement selon la date de naissance.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <RefreshCw className="animate-spin" /> : 'Valider Inscription'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default Registration;