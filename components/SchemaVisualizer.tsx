
import React, { useMemo } from 'react';
import { getDatabaseSchema } from '../services/dbService';

const SchemaVisualizer: React.FC = () => {
  const schema = useMemo(() => getDatabaseSchema(), []);

  return (
    <div className="bg-slate-900 rounded-3xl p-8 min-h-[600px] overflow-hidden relative border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-white text-xl font-bold flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
            Modèle de Données Relationnel
          </h3>
          <p className="text-slate-400 text-xs mt-1">Architecture des tables via introspection SQLite PRAGMA.</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span> Clé Étrangère
          </span>
          <span className="flex items-center text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span> Clé Primaire
          </span>
        </div>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
        {schema.tables.map(table => (
          <div 
            key={table.name} 
            className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-10 w-full overflow-hidden hover:border-indigo-500/50 transition-colors"
          >
            <div className="bg-slate-700/50 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <span className="text-indigo-300 font-bold text-sm tracking-wide uppercase">{table.name}</span>
              <span className="text-slate-500 text-[10px] font-mono">{table.columns.length} colonnes</span>
            </div>
            <div className="p-0">
              {table.columns.map((col) => {
                const isFK = table.foreignKeys.some(f => f.from === col.name);
                return (
                  <div 
                    key={col.name} 
                    className={`px-4 py-2.5 flex items-center justify-between text-xs border-b border-slate-700/50 last:border-0 ${col.pk ? 'bg-amber-500/5' : isFK ? 'bg-indigo-500/5' : ''}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-4 flex justify-center">
                        {col.pk ? (
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                          </svg>
                        ) : isFK ? (
                          <svg className="w-3.5 h-3.5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <div className="w-1 h-1 bg-slate-600 rounded-full" />
                        )}
                      </div>
                      <span className={`font-mono tracking-tight ${col.pk ? 'text-amber-400 font-bold' : isFK ? 'text-indigo-300' : 'text-slate-300'}`}>
                        {col.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                       <span className="text-slate-600 text-[9px] font-bold uppercase bg-slate-900/50 px-1.5 py-0.5 rounded border border-slate-700/50">
                        {col.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {table.foreignKeys.length > 0 && (
              <div className="bg-slate-900/30 px-4 py-2 border-t border-slate-700/50">
                <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Relations :</div>
                {table.foreignKeys.map((fk, fidx) => (
                  <div key={fidx} className="text-[10px] text-indigo-400/80 font-mono">
                    {fk.from} → {fk.toTable}.{fk.toColumn}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {schema.tables.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
           <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
           <p className="font-medium">Aucune table détectée dans la base.</p>
        </div>
      )}
    </div>
  );
};

export default SchemaVisualizer;
