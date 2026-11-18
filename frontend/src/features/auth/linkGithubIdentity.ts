import { supabase } from "./supabase";

export async function linkGithubIdentity(): Promise<void> {
  if (!supabase) throw new Error("Supabase sign-in is not configured for this deployment.");

  const { error } = await supabase.auth.linkIdentity({
    provider: "github",
    options: { redirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) throw error;
}
