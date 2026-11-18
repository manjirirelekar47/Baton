import React from "react";
import { Search, X } from "lucide-react";

export type NodeFilterType = "all" | "person" | "module" | "task" | "claim";

interface GraphControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedFilter: NodeFilterType;
  onFilterChange: (filter: NodeFilterType) => void;
  nodeCounts: {
    all: number;
    person: number;
    module: number;
    task: number;
    claim: number;
  };
  isDark: boolean;
}

const filterOptions: { label: string; value: NodeFilterType; countKey: keyof GraphControlsProps["nodeCounts"] }[] = [
  { label: "All", value: "all", countKey: "all" },
  { label: "People", value: "person", countKey: "person" },
  { label: "Modules", value: "module", countKey: "module" },
  { label: "Tasks", value: "task", countKey: "task" },
  { label: "Claims", value: "claim", countKey: "claim" },
];

export const GraphControls: React.FC<GraphControlsProps> = ({
  searchQuery,
  onSearchChange,
  selectedFilter,
  onFilterChange,
  nodeCounts,
  isDark,
}) => {
  return (
    <div className="space-y-3">
      {/* Order 3: Search */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
          <Search className={`w-4 h-4 ${isDark ? "text-slate-400" : "text-slate-400"}`} />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search people, modules, tasks..."
          className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm transition-all outline-none ${
            isDark
              ? "bg-black/40 border border-white/10 text-white placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              : "bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-sm"
          }`}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className={`absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs ${
              isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
            }`}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Order 4: Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {filterOptions.map((opt) => {
          const isActive = selectedFilter === opt.value;
          const count = nodeCounts[opt.countKey];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? isDark
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/40"
                    : "bg-purple-600 text-white shadow-sm"
                  : isDark
                    ? "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
              }`}
            >
              <span>{opt.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive
                    ? "bg-white/20 text-white"
                    : isDark
                      ? "bg-white/10 text-slate-400"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
