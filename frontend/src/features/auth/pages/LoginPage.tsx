import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/app/auth";
import { isSupabaseConfigured, supabase } from "@/app/supabase";
import "./auth.css";

type AuthMode = "signin" | "signup" | "forgot" | "recovery";

export function LoginPage() {
  const { user, enterDemoWorkspace, error: authError } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isSupabaseConfigured && user && mode !== "recovery") navigate("/dashboard", { replace: true });
  }, [user, mode, navigate]);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("recovery");
        setNotice("Choose a new password for your account.");
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function changeMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirmPassword("");
  }

  async function finishSignIn() {
    // The current Baton API uses seeded demo identities. Supabase verifies the
    // account first; backend identity mapping is a separate integration step.
    await enterDemoWorkspace();
    navigate("/dashboard", { replace: true });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError("Connect a Supabase project by adding its URL and publishable key to frontend/.env.local.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Those passwords don’t match.");
      return;
    }
    if (mode === "recovery" && password !== confirmPassword) {
      setError("Those passwords don’t match.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await finishSignIn();
      } else if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) await finishSignIn();
        else setNotice("Check your email for a confirmation link, then come back here to sign in.");
      } else if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?recovery=1`,
        });
        if (resetError) throw resetError;
        setNotice("If an account exists for that address, a password reset link is on its way.");
      } else {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setNotice("Password updated. Signing you in…");
        await finishSignIn();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setNotice(null);
    if (!supabase) {
      setError("Connect a Supabase project before using social sign-in.");
      return;
    }
    setBusy(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start social sign-in.");
      setBusy(false);
    }
  }

  const heading =
    mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : mode === "recovery" ? "Set a new password" : "Welcome back";
  const submitLabel =
    mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "recovery" ? "Update password" : "Sign in to Baton";

  return (
    <main className="auth-page">
      <div className="auth-frame">
        <section className="auth-story" aria-label="About Baton">
          <div className="auth-foliage auth-foliage-one" aria-hidden="true" />
          <div className="auth-foliage auth-foliage-two" aria-hidden="true" />
          <div className="auth-story-content">
            <a className="auth-brand" href="/login" aria-label="Baton sign in">
              <span className="auth-brand-mark">B</span>
              <span>Baton</span>
            </a>
            <div className="auth-story-copy">
              <span className="auth-eyebrow"><span /> Knowledge that carries forward</span>
              <h1>Every handover deserves a fresh start.</h1>
              <p>Keep the decisions, context, and proof your team needs to move forward with confidence.</p>
              <div className="auth-proof-row">
                <span>Evidence linked</span>
                <span>People first</span>
                <span>Ready on day one</span>
              </div>
            </div>
            <div className="auth-story-foot"><span className="auth-foot-icon">✳</span> Built for teams passing knowledge forward</div>
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="auth-heading">
          <div className="auth-form-shell">
            <div className="auth-mobile-brand"><span className="auth-brand-mark">B</span><span>Baton</span></div>
            <div className="auth-kicker">YOUR TEAM’S NEXT CHAPTER</div>
            <h2 id="auth-heading">{heading}</h2>
            <p className="auth-subtitle">
              {mode === "signup" ? "Create a Baton account to keep your team in sync." : mode === "forgot" ? "We’ll email you a secure link to reset it." : mode === "recovery" ? "Pick a strong password you haven’t used before." : "Sign in to continue your team’s work."}
            </p>

            {mode === "signin" && (
              <div className="auth-mode-switch" role="tablist" aria-label="Account access">
                <button aria-selected="true" className="active" onClick={() => changeMode("signin")} role="tab" type="button">Sign in</button>
                <button aria-selected="false" onClick={() => changeMode("signup")} role="tab" type="button">Create account</button>
              </div>
            )}

            {!isSupabaseConfigured && (
              <div className="auth-config-note" role="status">
                <strong>Supabase isn’t connected yet.</strong>
                Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>frontend/.env.local</code> to enable account sign-in.
              </div>
            )}
            {(error || authError) && <div className="auth-alert" role="alert">{error || authError}</div>}
            {notice && <div className="auth-notice" role="status">{notice}</div>}

            <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
              {mode === "signup" && (
                <label className="auth-field">
                  <span>Your name</span>
                  <input autoComplete="name" onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" required value={name} />
                </label>
              )}
              {mode !== "recovery" && (
                <label className="auth-field">
                  <span>Email address</span>
                  <input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required type="email" value={email} />
                </label>
              )}
              {mode !== "forgot" && (
                <label className="auth-field">
                  <span>{mode === "recovery" ? "New password" : "Password"}</span>
                  <input autoComplete={mode === "recovery" || mode === "signup" ? "new-password" : "current-password"} minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required type="password" value={password} />
                </label>
              )}
              {(mode === "signup" || mode === "recovery") && (
                <label className="auth-field">
                  <span>Confirm password</span>
                  <input autoComplete="new-password" minLength={8} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" required type="password" value={confirmPassword} />
                </label>
              )}
              {mode === "signin" && (
                <button className="auth-text-button auth-forgot" onClick={() => changeMode("forgot")} type="button">Forgot password?</button>
              )}
              <button className="auth-submit" disabled={busy} type="submit">
                {busy ? <><span className="auth-spinner" /> Please wait…</> : <>{submitLabel}<span aria-hidden="true">→</span></>}
              </button>
            </form>

            {(mode === "signin" || mode === "signup") && (
              <>
                <div className="auth-divider"><span>or continue with</span></div>
                <div className="auth-socials">
                  <button disabled={busy} onClick={() => void handleOAuth("google")} type="button"><GoogleIcon />Google</button>
                  <button disabled={busy} onClick={() => void handleOAuth("github")} type="button"><GitHubIcon />GitHub</button>
                </div>
              </>
            )}

            {mode !== "signin" && (
              <p className="auth-switch-copy">
                {mode === "signup" ? "Already have an account?" : "Remembered your password?"}{" "}
                <button className="auth-text-button" onClick={() => changeMode("signin")} type="button">Sign in</button>
              </p>
            )}

            <div className="auth-demo-box">
              <div><span className="auth-demo-dot" /><span>Just looking around?</span></div>
              <button disabled={busy} onClick={async () => {
                setBusy(true);
                setError(null);
                try { await enterDemoWorkspace(); navigate("/dashboard", { replace: true }); }
                catch (cause) { setError(cause instanceof Error ? cause.message : "Could not open the demo workspace."); }
                finally { setBusy(false); }
              }} type="button">Explore the demo <span aria-hidden="true">↗</span></button>
              <p>This opens Baton’s shared seeded demo workspace.</p>
            </div>

            <p className="auth-legal">By continuing, you agree to Baton’s <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
          </div>
        </section>
      </div>
      <footer className="auth-footer"><span>© 2026 Baton</span><span>Evidence-backed knowledge handovers</span></footer>
    </main>
  );
}

function GoogleIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.41-.18-2.08H12v3.94h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.25c1.9-1.75 2.97-4.33 2.97-7.43Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.63-2.44l-3.25-2.55c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.75-5.59-4.1H3.05v2.63A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.87a6 6 0 0 1 0-3.74V7.5H3.05a10 10 0 0 0 0 9Z"/><path fill="#EA4335" d="M12 6.03c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.59 9.59 0 0 0 12 2a10 10 0 0 0-8.95 5.5l3.36 2.63C7.2 7.78 9.4 6.03 12 6.03Z"/></svg>;
}

function GitHubIcon() {
  return <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.08c-3.1.68-3.76-1.32-3.76-1.32-.5-1.29-1.23-1.63-1.23-1.63-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.9 2.34 3.35 1.66.1-.72.4-1.21.69-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.14a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.05-1.14 3.05-1.14.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.3-2.61 5.23-5.1 5.51.4.34.74 1.03.74 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z"/></svg>;
}
