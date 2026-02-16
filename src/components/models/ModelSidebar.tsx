import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import type { ModelDefinition, ModelCategory } from './ModelRegistry.ts';

const CATEGORIES: ModelCategory[] = ['Animals', 'Environment'];

export default function ModelSidebar({
  models,
  selected,
  onSelect,
}: {
  models: ModelDefinition[];
  selected: ModelDefinition;
  onSelect: (model: ModelDefinition) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q),
    );
  }, [models, search]);

  const grouped = useMemo(() => {
    const map = new Map<ModelCategory, ModelDefinition[]>();
    for (const cat of CATEGORIES) {
      const items = filtered.filter((m) => m.category === cat);
      if (items.length > 0) map.set(cat, items);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex h-screen w-72 flex-col border-r border-white/10 bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <button
          onClick={() => navigate('/')}
          className="cursor-pointer text-white/60 transition-colors hover:text-white"
          title="Back to simulation"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold text-white">Models</h1>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search models..."
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Model list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {[...grouped.entries()].map(([category, items]) => (
          <div key={category} className="mt-3">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {category}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((model) => (
                <button
                  key={model.id}
                  onClick={() => onSelect(model)}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-left transition-colors ${
                    selected.id === model.id
                      ? 'bg-cyan-500/10 ring-1 ring-cyan-500'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: model.accentColor }}
                    />
                    <span
                      className={`text-xs font-medium ${
                        selected.id === model.id ? 'text-cyan-300' : 'text-white/80'
                      }`}
                    >
                      {model.name}
                    </span>
                  </div>
                  <p className="mt-0.5 pl-[18px] text-[10px] leading-tight text-white/40">
                    {model.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="mt-8 text-center text-xs text-white/30">
            No models match your search.
          </div>
        )}
      </div>
    </div>
  );
}
