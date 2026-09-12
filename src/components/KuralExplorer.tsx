import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import { kurals, Kural } from '../kurals';

interface KuralExplorerProps {
  onSelectKural?: (kural: Kural) => void;
}

export default function KuralExplorer({ onSelectKural }: KuralExplorerProps) {
  const [explorerLang, setExplorerLang] = useState<'tamil' | 'english' | 'both'>('both');
  const [searchQuery, setSearchQuery] = useState('');
  const [explorerKural, setExplorerKural] = useState<Kural>(kurals[0]);

  // Handle random Kural from Aram/Porul
  const triggerExplorerRandom = () => {
    const filtered = kurals.filter(k => k.paaal !== "காமத்துப்பால்");
    const randomIndex = Math.floor(Math.random() * filtered.length);
    const chosen = filtered[randomIndex];
    setExplorerKural(chosen);
    if (onSelectKural) onSelectKural(chosen);
  };

  const handleSelectKural = (k: Kural) => {
    setExplorerKural(k);
    if (onSelectKural) onSelectKural(k);
  };

  // Filter kurals by ID, Adhigaram, or any other words
  const q = searchQuery.toLowerCase().trim();
  const filteredKurals = q 
    ? kurals.filter(k => 
        k.id.toString() === q ||
        k.adhigaram.toLowerCase().includes(q) ||
        k.vilakam.toLowerCase().includes(q) ||
        k.transliteration.toLowerCase().includes(q) ||
        k.english.toLowerCase().includes(q)
      )
    : kurals;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="kural_explorer">
      {/* LEFT COLUMN: LIST AND SEARCH (5 Columns) */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <BookOpen size={15} className="text-slate-600" /> Kural Library & Search
          </h2>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['tamil', 'english', 'both'] as const).map(l => (
              <button
                key={l}
                onClick={() => setExplorerLang(l)}
                className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                  explorerLang === l ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Search Box */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Kural ID (1-100), Adhigaram, or words..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-950/10 focus:border-slate-400 transition-all placeholder:text-slate-400 text-slate-800 font-medium"
          />
        </div>

        {/* List of matched kurals */}
        <div className="flex flex-col gap-1 max-h-96 overflow-y-auto border border-slate-150 rounded-xl p-2 bg-slate-50/50">
          {filteredKurals.length > 0 ? (
            filteredKurals.map(k => (
              <button
                key={k.id}
                onClick={() => handleSelectKural(k)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                  explorerKural.id === k.id 
                    ? 'bg-slate-950 text-white shadow-sm' 
                    : 'hover:bg-slate-250/60 text-slate-700'
                }`}
              >
                <span className="truncate">
                  <b>Kural {k.id}:</b> {k.kural.replace(/<br\s*\/?>/gi, ' ')}
                </span>
                <span className="text-[9px] opacity-75 font-mono ml-2 uppercase shrink-0">
                  {k.paaal}
                </span>
              </button>
            ))
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <AlertCircle size={14} /> No matching couplets found.
            </div>
          )}
        </div>
      </section>

      {/* RIGHT COLUMN: READING CARD (7 Columns) */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-xs flex flex-col justify-between gap-8 relative overflow-hidden">
        {/* Background ID Badge */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-100/50 rounded-bl-full flex items-center justify-center border-l border-b border-slate-200/50">
          <span className="text-lg font-bold font-serif text-slate-300">
            #{explorerKural.id}
          </span>
        </div>

        <div className="flex flex-col gap-6">
          {/* Category tags */}
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 border border-slate-200 text-slate-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {explorerKural.paaal}
            </span>
            <span className="bg-amber-50 border border-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {explorerKural.adhigaram}
            </span>
          </div>

          {/* Couplet Body */}
          <div className="flex flex-col gap-6 border-l-4 border-slate-950 pl-4 py-1">
            {(explorerLang === 'tamil' || explorerLang === 'both') && (
              <p 
                className="text-base lg:text-lg font-bold text-slate-900 leading-relaxed font-sans"
                dangerouslySetInnerHTML={{ __html: explorerKural.kural }}
              />
            )}
            
            {explorerLang === 'english' && (
              <p className="text-sm lg:text-base font-bold text-slate-700 italic leading-relaxed">
                {explorerKural.transliteration}
              </p>
            )}
          </div>

          {/* Explanations */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            {(explorerLang === 'tamil' || explorerLang === 'both') && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  உரை / tamil meaning
                </h4>
                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                  {explorerKural.vilakam}
                </p>
              </div>
            )}

            {(explorerLang === 'english' || explorerLang === 'both') && (
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  translation & explanation
                </h4>
                <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                  {explorerKural.english.replace(/\$/g, ' ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick action bar */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-4">
          <div className="text-[10px] text-slate-400">
            Chapter ID: <b>{explorerKural.adhigaram_id}</b>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={triggerExplorerRandom}
              className="flex items-center gap-1.5 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-semibold px-4 py-2.5 rounded-xl border border-slate-200 cursor-pointer"
            >
              <RefreshCw size={13} /> Random Couplet 🎲
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
