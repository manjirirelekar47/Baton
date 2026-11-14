import { describe, expect, it } from "vitest";
import { formatUser } from "../AuthContext";
import type { UserProfile } from "../../api/client";

const seededApprover: UserProfile = {
  id: "approver-1",
  name: "Manjiri Relekar",
  role: "approver",
  project_id: "baton-demo",
};

describe("formatUser", () => {
  it("uses the signed-in Supabase email instead of the seeded demo email", () => {
    const user = formatUser(seededApprover, "bhavesh@example.com");

    expect(user.email).toBe("bhavesh@example.com");
    expect(user.role).toBe("approver");
    expect(user.displayRole).toBe("Project Admin");
  });

  it("keeps the seeded persona email when there is no Supabase account", () => {
    const user = formatUser(seededApprover);

    expect(user.email).toBe("manjiri.relekar47@gmail.com");
  });
});
