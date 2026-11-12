import { ROLE_LABELS, type Role } from "@/shared/types";
import { useAuth } from "./auth";

export function RoleSwitcher() {
  const { user, switchRole } = useAuth();
  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span>Viewing as</span>
      <select
        className="rounded-md border border-line bg-card px-2 py-1 text-ink"
        value={user?.role ?? ""}
        onChange={(e) => void switchRole(e.target.value as Role)}
      >
        {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </label>
  );
}
