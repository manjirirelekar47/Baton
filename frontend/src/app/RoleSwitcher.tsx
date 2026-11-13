import { ROLE_LABELS, type Role } from "@/shared/types";
import { useAuth } from "./auth";

export function RoleSwitcher() {
  const { user, switchRole } = useAuth();
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/90 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-2.5 py-1.5 transition cursor-pointer">
      <span className="text-slate-400 font-semibold uppercase text-[10px]">Role:</span>
      <select
        className="bg-transparent border-none text-slate-800 font-semibold text-xs focus:ring-0 focus:outline-none cursor-pointer p-0 pr-4"
        value={user?.role ?? ""}
        onChange={(e) => void switchRole(e.target.value as Role)}
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <option key={role} value={role} className="bg-white text-slate-800">
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </label>
  );
}
