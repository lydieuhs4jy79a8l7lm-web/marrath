import React, { useEffect, useState } from 'react';
import { pb } from '../services/pocketbase';
import { Participant, Category, Gender } from '../types';
import { formatTime } from '../utils/helpers';
import { Trophy, Clock, Users, User, RotateCcw, AlertTriangle, Loader2 } from 'lucide-react';

const Leaderboard: React.FC = () => {
  const [results, setResults] = useState<Participant[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<Gender | ''>('');
  
  // States pour la réinitialisation
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const fetchResults = async () => {
    try {
      let filter = "status = 'finished'";
      if (selectedCategory) {
        filter += ` && category = '${selectedCategory}'`;
      }
      if (selectedGender) {
        filter += ` && gender = '${selectedGender}'`;
      }

      const records = await pb.collection('participants').getList<Participant>(1, 100, {
        sort: 'finishedAt', // Sort by time (implies rank)
        filter: filter,
      });
      setResults(records.items);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchResults();
    
    // Auto refresh every 10 seconds for "Live" feel without complex sockets for this demo
    const interval = setInterval(fetchResults, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedGender]);

  const handleResetResults = async () => {
    setIsResetting(true);
    try {
        // 1. Récupérer tous les participants ayant le statut 'finished'
        // On utilise getFullList pour être sûr de tous les avoir
        const finishedParticipants = await pb.collection('participants').getFullList<Participant>({
            filter: "status = 'finished'"
        });

        // 2. Mettre à jour chaque participant pour réinitialiser ses données de course
        // Note: PocketBase JS SDK permet de passer "" pour vider une date
        const promises = finishedParticipants.map(p => 
            pb.collection('participants').update(p.id, {
                status: 'registered',
                finishedAt: "", 
                rankCategory: null,
                rankGlobal: null
            })
        );

        await Promise.all(promises);

        // 3. Rafraîchir l'affichage et fermer la modale
        fetchResults();
        setShowResetModal(false);
    } catch (err) {
        console.error("Erreur lors de la réinitialisation :", err);
        alert("Une erreur est survenue lors de la réinitialisation.");
    } finally {
        setIsResetting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-slate-900 text-white p-6 rounded-t-xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-black italic uppercase flex items-center gap-3">
            <Trophy className="text-yellow-400" /> Résultats en Direct
            </h1>
            <p className="text-slate-400 mt-2">Mise à jour automatique toutes les 10s</p>
        </div>
        
        <button 
            onClick={() => setShowResetModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition shadow-md border border-red-500"
        >
            <RotateCcw size={16} /> Réinitialiser
        </button>
      </div>

      <div className="bg-white border-x border-b p-4 shadow-lg rounded-b-xl">
        
        {/* GENDER TABS */}
        <div className="flex p-1 bg-slate-100 rounded-lg mb-6">
            <button
                onClick={() => setSelectedGender('')}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition ${
                    selectedGender === '' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <Users size={16} /> Mixte
            </button>
            <button
                onClick={() => setSelectedGender(Gender.M)}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition ${
                    selectedGender === Gender.M ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <User size={16} /> Hommes
            </button>
            <button
                onClick={() => setSelectedGender(Gender.F)}
                className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition ${
                    selectedGender === Gender.F ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
                <User size={16} /> Femmes
            </button>
        </div>

        {/* CATEGORY FILTER */}
        <div className="mb-6 overflow-x-auto pb-2">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Catégorie d'âge</label>
          <div className="flex gap-2 min-w-max">
            <button 
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition border ${
                selectedCategory === '' 
                ? 'bg-slate-800 text-white border-slate-800' 
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              Toutes
            </button>
            {Object.values(Category).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition border ${
                    selectedCategory === cat 
                    ? 'bg-slate-800 text-white border-slate-800' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
              >
                {cat.split(' ')[0]} 
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
            {results.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">
                    Aucun résultat enregistré pour le moment.
                </div>
            ) : (
                results.map((p, index) => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-transparent hover:border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 flex items-center justify-center rounded-full font-black text-lg shadow-sm ${
                                index === 0 ? 'bg-yellow-100 text-yellow-600' :
                                index === 1 ? 'bg-gray-200 text-gray-600' :
                                index === 2 ? 'bg-orange-100 text-orange-600' :
                                'bg-white border text-gray-400'
                            }`}>
                                {index + 1}
                            </div>
                            <div className="flex items-center gap-3">
                                {p.profilePicture && (
                                    <img 
                                        src={pb.files.getUrl(p, p.profilePicture, { thumb: '100x100' })} 
                                        alt="avatar" 
                                        className="w-10 h-10 rounded-full object-cover border border-white shadow-sm"
                                    />
                                )}
                                <div>
                                    <h3 className="font-bold text-gray-900">{p.firstName} {p.lastName}</h3>
                                    <div className="text-xs text-gray-500 flex gap-2 mt-0.5">
                                        <span className={`px-1.5 rounded font-bold ${p.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                            {p.gender}
                                        </span>
                                        <span className="bg-slate-200 text-slate-700 px-1.5 rounded font-medium">{p.category.split(' ')[0]}</span>
                                        <span>#{p.bibNumber}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                             <div className="flex items-center justify-end gap-1 text-xl font-mono font-bold text-slate-800">
                                <Clock size={16} className="text-gray-400" />
                                {formatTime(p.finishedAt)}
                             </div>
                        </div>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* CONFIRM RESET MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Réinitialiser la course ?</h3>
                <p className="text-gray-600 mb-6 text-sm">
                    Attention : Tous les temps d'arrivée et les classements seront supprimés. Les participants resteront inscrits.<br/><br/>
                    <b>Cette action est irréversible.</b>
                </p>
                
                <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => setShowResetModal(false)}
                        disabled={isResetting}
                        className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition flex-1 disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={handleResetResults}
                        disabled={isResetting}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isResetting ? <Loader2 className="animate-spin" size={18} /> : "Confirmer"}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;