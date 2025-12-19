import React, { useEffect, useState } from 'react';
import { pb } from '../services/pocketbase';
import { Participant, Category, Gender } from '../types';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { FileDown, Filter, RefreshCw, Printer, Trash2, Layers, QrCode, Eye, X, User, AlertTriangle } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  
  // State pour la modale de confirmation de suppression
  const [itemToDelete, setItemToDelete] = useState<{id: string, name: string} | null>(null);
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Mass Gen State
  const [startNum, setStartNum] = useState<number>(1);
  const [countNum, setCountNum] = useState<number>(100);
  const [prefix, setPrefix] = useState<string>('RUN2025');

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      let filterString = '';
      if (filterCategory) filterString += `category = '${filterCategory}'`;
      if (filterStatus) {
        if (filterString) filterString += ' && ';
        filterString += `status = '${filterStatus}'`;
      }

      // Max 500 for demo, usually use pagination for real apps
      const records = await pb.collection('participants').getList<Participant>(1, 500, {
        sort: '-created',
        filter: filterString
      });
      setParticipants(records.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterStatus]);

  // Étape 1 : Demander confirmation (Ouvre la modale)
  const confirmDelete = (id: string, name: string) => {
    setItemToDelete({ id, name });
  };

  // Étape 2 : Exécuter la suppression
  const executeDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await pb.collection('participants').delete(itemToDelete.id);
      
      // Mise à jour de l'état local
      setParticipants(prev => prev.filter(p => p.id !== itemToDelete.id));
      
      // Si le participant supprimé était ouvert dans la modale de détails, on la ferme
      if (selectedParticipant?.id === itemToDelete.id) {
        setSelectedParticipant(null);
      }
      
      // Fermer la modale de suppression
      setItemToDelete(null);
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      if (err.status === 403) {
          alert("Impossible de supprimer : Permission refusée.\n\nVeuillez vérifier que la règle 'API Rule > Delete' est bien activée (cadenas ouvert ou vide) dans les paramètres de la collection PocketBase.");
      } else {
          alert(`Erreur lors de la suppression : ${err.message || "Erreur inconnue"}`);
      }
      // On ferme la modale même en cas d'erreur pour ne pas bloquer l'UI
      setItemToDelete(null);
    }
  };

  const generatePDF = async () => {
    if (participants.length === 0) return;
    await createPdfFromList(participants);
  };

  // Generic PDF creator
  const createPdfFromList = async (list: Partial<Participant>[], isBlankMode = false) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6'
    });

    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (i > 0) doc.addPage();

      // Border
      doc.setLineWidth(1);
      doc.rect(5, 5, 95, 138);

      // Header Event Name
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("MARATHON 2025", 52.5, 15, { align: "center" });

      // Bib Number (Huge)
      doc.setFontSize(40);
      doc.setFont("helvetica", "bold");
      const bibString = p.bibNumber || "000";
      const bibDisplay = bibString.includes('-') ? bibString.split('-')[1] : bibString;
      doc.text(bibDisplay, 52.5, 50, { align: "center" });

      if (!isBlankMode) {
        // Category / Gender
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`${p.category || "?"} - ${p.gender || "?"}`, 52.5, 65, { align: "center" });

        // Name
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(`${(p.firstName || "").toUpperCase()}`, 52.5, 80, { align: "center" });
        doc.text(`${(p.lastName || "").toUpperCase()}`, 52.5, 90, { align: "center" });
      } else {
        doc.setFontSize(14);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(150);
        doc.text("À ASSIGNER", 52.5, 80, { align: "center" });
        doc.setTextColor(0);
      }

      // QR Code
      try {
        // For blank bibs, we only encode the bibNumber in a JSON structure compatible with registration
        const qrPayload = isBlankMode 
            ? JSON.stringify({ bib: bibString, type: 'preassigned' })
            : JSON.stringify({ 
                id: p.id, 
                bib: p.bibNumber, 
                n: `${p.firstName || ""} ${p.lastName || ""}`, 
                c: p.category 
              });

        const qrDataUrl = await QRCode.toDataURL(qrPayload);
        doc.addImage(qrDataUrl, 'PNG', 32.5, 100, 40, 40);
      } catch (e) {
        console.error("QR Generation failed", e);
      }

      // Small Bib Text ID
      doc.setFontSize(8);
      doc.text(bibString, 52.5, 142, { align: "center" });
    }

    doc.save(isBlankMode ? 'dossards_vierges.pdf' : 'dossards_participants.pdf');
  };

  const generateBlankBibs = async () => {
    if (countNum <= 0) return;
    
    const blankList: Partial<Participant>[] = [];
    for (let i = 0; i < countNum; i++) {
        const num = startNum + i;
        // Pad number with zeros (e.g. 0001)
        const padded = num.toString().padStart(4, '0');
        blankList.push({
            bibNumber: `${prefix}-${padded}`,
            firstName: '',
            lastName: '',
        });
    }
    
    await createPdfFromList(blankList, true);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8 relative">
      
      {/* SECTION GENERATION MASSE */}
      <div className="bg-slate-800 text-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4 border-b border-slate-600 pb-4">
            <Layers className="text-orange-500" />
            <h2 className="text-xl font-bold">Génération de Dossards Vierges</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
                <label className="block text-sm text-slate-400 mb-1">Préfixe</label>
                <input 
                    type="text" 
                    value={prefix} 
                    onChange={e => setPrefix(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:border-orange-500 outline-none"
                />
            </div>
            <div>
                <label className="block text-sm text-slate-400 mb-1">Numéro de début</label>
                <input 
                    type="number" 
                    value={startNum} 
                    onChange={e => setStartNum(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:border-orange-500 outline-none"
                />
            </div>
            <div>
                <label className="block text-sm text-slate-400 mb-1">Quantité</label>
                <input 
                    type="number" 
                    value={countNum} 
                    onChange={e => setCountNum(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 focus:border-orange-500 outline-none"
                />
            </div>
            <div>
                <button 
                    onClick={generateBlankBibs}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded flex items-center justify-center gap-2 transition"
                >
                    <QrCode size={18} /> Générer PDF
                </button>
            </div>
        </div>
        <p className="text-xs text-slate-400 mt-2 italic">
            Cela génère un PDF avec des QR codes. Lors de l'inscription, scannez ce code pour l'attribuer à un coureur.
        </p>
      </div>

      {/* SECTION LISTING */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Printer /> Liste des Participants
            </h1>
            <button 
            onClick={generatePDF}
            disabled={participants.length === 0}
            className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
            <FileDown size={18} /> Télécharger PDF ({participants.length})
            </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Catégorie</label>
            <select 
                value={filterCategory} 
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full mt-1 border rounded p-2"
            >
                <option value="">Toutes</option>
                {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            </div>
            
            <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Statut</label>
            <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full mt-1 border rounded p-2"
            >
                <option value="">Tous</option>
                <option value="registered">Inscrit</option>
                <option value="finished">Arrivé</option>
            </select>
            </div>

            <div className="md:col-start-4 flex justify-end">
            <button onClick={fetchParticipants} className="bg-blue-50 text-blue-600 px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-100">
                <Filter size={18} /> Appliquer
            </button>
            </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                <th className="px-6 py-3">Dossard</th>
                <th className="px-6 py-3">Nom</th>
                <th className="px-6 py-3">Cat.</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3">Actions</th>
                </tr>
            </thead>
            <tbody>
                {loading ? (
                <tr><td colSpan={5} className="text-center py-8"><RefreshCw className="animate-spin inline mr-2"/> Chargement...</td></tr>
                ) : participants.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8">Aucun participant trouvé.</td></tr>
                ) : (
                participants.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-bold font-mono text-slate-700">{p.bibNumber}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">{p.lastName} {p.firstName}</td>
                    <td className="px-6 py-4">{p.category}</td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                        p.status === 'finished' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                        {p.status === 'finished' ? 'ARRIVÉ' : 'INSCRIT'}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setSelectedParticipant(p)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase tracking-wide flex items-center gap-1"
                            >
                                <Eye size={16} /> Voir
                            </button>
                            <button 
                                onClick={() => confirmDelete(p.id, `${p.firstName} ${p.lastName}`)}
                                className="text-red-400 hover:text-red-700 transition-colors p-1"
                                title="Supprimer le participant"
                                aria-label="Supprimer"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </td>
                    </tr>
                ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      {/* VIEW MODAL */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <User size={20} /> Détails Participant
                    </h3>
                    <button 
                        onClick={() => setSelectedParticipant(null)}
                        className="text-slate-400 hover:text-white transition"
                    >
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6">
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-100 shadow-md mb-4 bg-slate-200 flex items-center justify-center">
                            {selectedParticipant.profilePicture ? (
                                <img 
                                    src={pb.files.getUrl(selectedParticipant, selectedParticipant.profilePicture)} 
                                    alt="Profil" 
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <User size={48} className="text-slate-400" />
                            )}
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase">{selectedParticipant.lastName}</h2>
                        <h3 className="text-xl text-slate-600">{selectedParticipant.firstName}</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Dossard</p>
                            <p className="text-lg font-mono font-bold text-orange-600">{selectedParticipant.bibNumber}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Catégorie</p>
                            <p className="text-md font-medium">{selectedParticipant.category} ({selectedParticipant.gender})</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Statut</p>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${
                                selectedParticipant.status === 'finished' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                            }`}>
                                {selectedParticipant.status === 'finished' ? 'ARRIVÉ' : 'INSCRIT'}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold">Temps</p>
                            <p className="text-md font-mono">{selectedParticipant.finishedAt ? new Date(selectedParticipant.finishedAt).toLocaleTimeString() : '--:--'}</p>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <button 
                            onClick={() => setSelectedParticipant(null)}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded text-slate-800 font-medium transition"
                        >
                            Fermer
                        </button>
                        <button 
                            onClick={() => confirmDelete(selectedParticipant.id, `${selectedParticipant.firstName} ${selectedParticipant.lastName}`)}
                            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded font-medium transition flex items-center gap-2"
                        >
                            <Trash2 size={16} /> Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
                <p className="text-gray-600 mb-6">
                    Êtes-vous sûr de vouloir supprimer <b>{itemToDelete.name}</b> ?<br/>
                    Cette action est irréversible.
                </p>
                <div className="flex gap-3 justify-center">
                    <button 
                        onClick={() => setItemToDelete(null)}
                        className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold transition flex-1"
                    >
                        Non
                    </button>
                    <button 
                        onClick={executeDelete}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition flex-1"
                    >
                        Oui
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;