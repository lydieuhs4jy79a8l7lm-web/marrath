import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, UserPlus, List, Scan, Trophy, BarChart } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => 
    location.pathname === path ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white";

  return (
    <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 font-bold text-xl">
              <span className="text-orange-500">RUN</span>
              <span>MANAGER</span>
            </Link>
          </div>
          <div className="flex space-x-2 sm:space-x-4 overflow-x-auto no-scrollbar">
            <Link to="/register" className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/register')}`}>
              <UserPlus size={18} />
              <span className="hidden sm:inline">Inscription</span>
            </Link>
            <Link to="/admin" className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/admin')}`}>
              <List size={18} />
              <span className="hidden sm:inline">Admin</span>
            </Link>
            <Link to="/scanner" className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/scanner')}`}>
              <Scan size={18} />
              <span className="hidden sm:inline">Scan</span>
            </Link>
            <Link to="/leaderboard" className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/leaderboard')}`}>
              <Trophy size={18} />
              <span className="hidden sm:inline">Résultats</span>
            </Link>
            <Link to="/reports" className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${isActive('/reports')}`}>
              <BarChart size={18} />
              <span className="hidden sm:inline">Rapports</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;