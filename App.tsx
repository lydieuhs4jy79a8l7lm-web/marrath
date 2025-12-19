import React from 'react';
import { HashRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Registration from './components/Registration';
import AdminDashboard from './components/AdminDashboard';
import Scanner from './components/Scanner';
import Leaderboard from './components/Leaderboard';
import Reports from './components/Reports';
import AuthGuard from './components/AuthGuard';

// Landing Page Component
const Home = () => (
  <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 text-center">
    <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
      <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600">
        MARATHON
      </span>
      <br />
      MANAGER
    </h1>
    <p className="text-xl text-slate-300 max-w-2xl mb-8">
      Solution complète de gestion de course. Inscriptions, Dossards, Chronométrage et Résultats en temps réel.
    </p>
    <div className="flex flex-wrap gap-4 justify-center">
      <Link to="/register" className="px-8 py-4 bg-orange-600 hover:bg-orange-700 rounded-lg font-bold text-lg transition inline-block text-white">
        S'inscrire
      </Link>
      <Link to="/leaderboard" className="px-8 py-4 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold text-lg transition inline-block text-white">
        Voir les résultats
      </Link>
    </div>
  </div>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            
            {/* Public Route */}
            <Route path="/register" element={<Registration />} />
            <Route path="/scanner" element={<Scanner />} />

            {/* Protected Routes */}
            <Route 
              path="/admin" 
              element={
                <AuthGuard title="Administration">
                  <AdminDashboard />
                </AuthGuard>
              } 
            />
            
            <Route 
              path="/leaderboard" 
              element={
                <AuthGuard title="Résultats">
                  <Leaderboard />
                </AuthGuard>
              } 
            />
            
            <Route 
              path="/reports" 
              element={
                <AuthGuard title="Rapports">
                  <Reports />
                </AuthGuard>
              } 
            />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <footer className="bg-white border-t py-6 text-center text-sm text-gray-500">
          <p>© 2025 Marathon Manager. Propulsé par PocketBase.</p>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;