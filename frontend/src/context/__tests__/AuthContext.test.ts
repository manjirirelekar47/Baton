import { describe, expect, it } from "vitest";
import { formatUser, formatUserDropdownRole } from "../AuthContext";
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
    expect(user.displayRole).toBe("Manjiri Relekar (Engineering Lead)");
  });

  it("keeps the seeded persona email when there is no Supabase account", () => {
    const user = formatUser(seededApprover);

    expect(user.email).toBe("manjiri.relekar47@gmail.com");
  });

  it("sets is_demo to false for registered non-demo accounts", () => {
    const registeredUser: UserProfile = {
      id: "usr-real-1",
      name: "Samiksha Lead",
      role: "approver",
      email: "samiksha@example.com",
      is_demo: false,
      project_id: "baton-demo",
    };
    const user = formatUser(registeredUser);

    expect(user.is_demo).toBe(false);
    expect(user.email).toBe("samiksha@example.com");
    expect(user.firstName).toBe("Samiksha");
    expect(user.displayRole).toBe("Samiksha Lead (Engineering Lead)");
  });

  it("formats display role correctly across all 4 roles", () => {
    const roles: Array<{ role: UserProfile["role"]; expectedTitle: string }> = [
      { role: "approver", expectedTitle: "Project Admin" },
      { role: "leaver", expectedTitle: "Aarav (Departing Lead)" },
      { role: "incoming_maintainer", expectedTitle: "Meera (Incoming Maintainer)" },
      { role: "incoming_contributor", expectedTitle: "Incoming Contributor" },
    ];

    roles.forEach(({ role, expectedTitle }) => {
      const user = formatUser({
        id: `usr-${role}`,
        name: "",
        role,
        is_demo: true,
        project_id: "baton-demo",
      });
      expect(user.displayRole).toBe(expectedTitle);
      expect(user.is_demo).toBe(true);
    });
  });

  it("formats dropdown role with user name first, followed by assigned role in brackets", () => {
    expect(formatUserDropdownRole({ name: "Aarav", role: "leaver" })).toBe("Aarav (Departing Lead)");
    expect(formatUserDropdownRole({ name: "Meera", role: "incoming_maintainer" })).toBe("Meera (Incoming Maintainer)");
    expect(formatUserDropdownRole({ name: "Samiksha", role: "approver" })).toBe("Samiksha (Engineering Lead)");
    expect(formatUserDropdownRole({ name: "Priya", role: "incoming_contributor" })).toBe("Priya (Incoming Contributor)");
    // Verifies name is fetched from profile and NOT from email
    expect(formatUserDropdownRole({ name: "Aarav", email: "somebody.else@example.com", role: "leaver" })).toBe("Aarav (Departing Lead)");
  });
});
