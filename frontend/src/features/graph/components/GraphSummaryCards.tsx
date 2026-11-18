import React from "react";
import { Users, Network, GitFork } from "lucide-react";

interface GraphSummaryCardsProps {
  totalNodes: number;
  connections: number;
  people: number;
  isDark: boolean;
}

export const GraphSummaryCards: React.FC<GraphSummaryCardsProps> = ({
  totalNodes,
  connections,
  people,
  isDark,
}) => {
  const cards = [
    {
      label: "Total Nodes",
      value: totalNodes,
      description: "Entities represented in graph",
      icon: Network,
      color: "text-purple-400 dark:text-purple-400 text-purple-600",
      bgLight: "bg-purple-50 border-purple-200",
      bgDark: "bg-purple-950/30 border-purple-500/20",
    },
    {
      label: "Connections",
      value: connections,
      description: "Relationships between entities",
      icon: GitFork,
      color: "text-indigo-400 dark:text-indigo-400 text-indigo-600",
      bgLight: "bg-indigo-50 border-indigo-200",
      bgDark: "bg-indigo-950/30 border-indigo-500/20",
    },
    {
      label: "People",
      value: people,
      description: "Team members & contributors",
      icon: Users,
      color: "text-blue-400 dark:text-blue-400 text-blue-600",
      bgLight: "bg-blue-50 border-blue-200",
      bgDark: "bg-blue-950/30 border-blue-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`p-5 rounded-2xl transition-all duration-200 ${
              isDark
                ? "bg-black/40 backdrop-blur-xl border border-white/10 shadow-xl hover:border-purple-500/30"
                : "bg-white border border-slate-200 shadow-sm hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {card.label}
              </span>
              <div
                className={`p-2 rounded-xl border ${
                  isDark ? card.bgDark : card.bgLight
                } ${card.color}`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <p
              className={`text-2xl font-black mt-2 font-display ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              {card.value}
            </p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};
