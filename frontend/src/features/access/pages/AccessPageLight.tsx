/**
 * AccessPageLight.tsx
 * Dedicated Light Mode page for Access Control & Permissions.
 * Preserves the pristine white card aesthetic.
 */

import React from "react";
import { Link } from "react-router-dom";

export const AccessPageLight: React.FC = () => {
  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 p-8 shadow-md shadow-slate-200/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              <span>Team Permissions & Visibility</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-50 border border-purple-100 shadow-xs">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
                Access Control & Visibility
              </h1>
            </div>

            <p className="text-base font-bold text-slate-800">
              Team Roles & Visibility Settings
            </p>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Choose who can see and edit specific project details. Sensitive facts stay protected and hidden based on each person's team role.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Link
              to="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl btn-glow-purple font-semibold text-xs shadow-md transition-all cursor-pointer"
            >
              <span>← Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Team-Wide Details</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">19 Details</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Public to all team roles</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Maintainer Details</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">3 Details</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Visible to maintainers and leads</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-md shadow-slate-200/50 hover:shadow-lg transition-all">
          <p className="text-xs font-semibold text-slate-500">Leadership Only</p>
          <p className="text-2xl font-black text-slate-900 mt-1 font-display">2 Details</p>
          <p className="text-xs text-purple-700 font-medium mt-1">Confidential & financial details</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white/75 backdrop-blur-xl border border-white p-6 shadow-xl shadow-slate-200/50 space-y-4">
        <h2 className="text-sm font-bold text-slate-900">Who Can See What</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500 border-b border-slate-100 bg-slate-50/70 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Visibility Level</th>
                <th className="py-2.5 px-3">Approver</th>
                <th className="py-2.5 px-3">Incoming Maintainer</th>
                <th className="py-2.5 px-3">Incoming Contributor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">Team-Wide (L1)</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">Read + Edit</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">Read</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">Read</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">Maintainers Only (L2)</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">Read + Edit</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">Read</td>
                <td className="py-3 px-3 text-amber-600 font-mono font-semibold">Hidden (Count only)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">Leadership Only (L3)</td>
                <td className="py-3 px-3 text-emerald-600 font-bold">Read + Edit</td>
                <td className="py-3 px-3 text-amber-600 font-mono font-semibold">Hidden (Count only)</td>
                <td className="py-3 px-3 text-amber-600 font-mono font-semibold">Hidden (Count only)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-900">Private Secrets & Keys (L4)</td>
                <td className="py-3 px-3 text-rose-600 font-mono font-semibold">Filtered Out</td>
                <td className="py-3 px-3 text-rose-600 font-mono font-semibold">Hidden from All</td>
                <td className="py-3 px-3 text-rose-600 font-mono font-semibold">Hidden from All</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccessPageLight;
