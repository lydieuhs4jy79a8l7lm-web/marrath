import React, { useEffect, useState } from 'react';
import { pb } from '../services/pocketbase';
import { Participant } from '../types';
import { BarChart, Users, Flag, Activity, RefreshCw } from 'lucide-react';

const Reports: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch all participants to calculate stats client-side
      const records = await pb.collection('participants').getFullList<Participant>({
        sort: '-created',
      });
      setParticipants(records);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  // --- Calculations ---

  const totalRegistered = participants.length;
  const finishedCount = participants.filter(p => p.status === 'finished').length;
  const finishRate = totalRegistered > 0 ? Math.round((finishedCount / totalRegistered) * 100) : 0;
  
  // Gender Stats
  const males = participants.filter(p => p.gender === 'M').length;
  const females = participants.filter(p => p.gender === 'F').length;
  
  // Category Stats
  const categories: Record<string, number> = {};
  participants.forEach(p => {
    // Extract base category name (remove age range if present in helper)
    // Assuming format "Category (Age)" or just "Category"
    const catName = p.category ? p.category.split(' ')[0] : 'Inconnu';
    categories[catName] = (categories[catName] || 0) + 1;
  });

  const categoryLabels = Object.keys(categories).sort();

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-slate-800 text-white rounded-lg">
           <BarChart size={24} />
        </div>
        <h1 className="text-3xl font-black text-slate-800 uppercase">Rapports & Statistiques</h1>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-md border-b-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase">Total Inscrits</p>
              <h3 className="text-4xl font-black text-slate-800 mt-1">{totalRegistered}</h3>
            </div>
            <Users className="text-blue-100" size={48} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border-b-4 border-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase">Arrivées</p>
              <h3 className="text-4xl font-black text-slate-800 mt-1">{finishedCount}</h3>
            </div>
            <Flag className="text-green-100" size={48} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-md border-b-4 border-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase">Taux de participation</p>
              <h3 className="text-4xl font-black text-slate-800 mt-1">{finishRate}%</h3>
            </div>
            <Activity className="text-orange-100" size={48} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GENDER DISTRIBUTION */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">Répartition par Genre</h3>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 font-bold text-blue-600">Hommes</div>
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
               <div 
                  className="bg-blue-500 h-full rounded-full" 
                  style={{ width: `${totalRegistered ? (males / totalRegistered) * 100 : 0}%` }}
               ></div>
            </div>
            <div className="w-12 text-right font-mono">{males}</div>
            <div className="w-12 text-right text-xs text-slate-400">{totalRegistered ? Math.round((males / totalRegistered) * 100) : 0}%</div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 font-bold text-pink-600">Femmes</div>
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
               <div 
                  className="bg-pink-500 h-full rounded-full" 
                  style={{ width: `${totalRegistered ? (females / totalRegistered) * 100 : 0}%` }}
               ></div>
            </div>
            <div className="w-12 text-right font-mono">{females}</div>
            <div className="w-12 text-right text-xs text-slate-400">{totalRegistered ? Math.round((females / totalRegistered) * 100) : 0}%</div>
          </div>
        </div>

        {/* CATEGORY DISTRIBUTION */}
        <div className="bg-white p-6 rounded-xl shadow-md">
          <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">Répartition par Catégorie</h3>
          <div className="space-y-3">
             {categoryLabels.map(cat => {
               const count = categories[cat];
               const percent = totalRegistered ? Math.round((count / totalRegistered) * 100) : 0;
               return (
                 <div key={cat} className="flex items-center text-sm">
                   <div className="w-24 font-bold text-slate-600 truncate" title={cat}>{cat}</div>
                   <div className="flex-1 mx-3">
                      <div className="w-full bg-slate-100 rounded-full h-2.5">
                        <div className="bg-slate-600 h-2.5 rounded-full" style={{ width: `${percent}%` }}></div>
                      </div>
                   </div>
                   <div className="font-mono font-bold text-slate-800 w-8 text-right">{count}</div>
                 </div>
               );
             })}
             {categoryLabels.length === 0 && <p className="text-center text-slate-400 italic">Aucune donnée</p>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Reports;