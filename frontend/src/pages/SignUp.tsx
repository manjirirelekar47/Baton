/**
 * SignUp.tsx / AuthPage.tsx
 * Unified Authentication Page for Baton (Handover Engine):
 * Seamlessly handles both Registration and Login with a single toggle state.
 * 
 * Features:
 * - Dynamic mode switching: `isLogin` (false = Sign Up, true = Login).
 * - Animated form transitions: "Your Name" and "Repeat Password" smoothly appear/disappear.
 * - Dynamic headers and CTA buttons: "Welcome Back" / "Sign In to Baton →" vs "Create Your Account" / "Get Started with Baton →".
 * - Text-button mode switcher in top-nav and card footer with instant state toggle.
 * - Left-hand Dark Hero Card: 100% preserved with Kinetic Particles, 3D Knowledge Orbit, sliding satellites, and value proposition badges.
 * - Brand Logo in top-left corner: `<img src="/assets/baton-logo.png" className="w-9 h-9 object-contain" />`.
 * - 1-Click Demo Mode button for instant exploratory access.
 */

import React, { useState, useMemo, useEffect, useCallback, useRef, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/app/auth";
import { useTheme } from "@/context/ThemeContext";
import { isSupabaseConfigured, supabase } from "@/features/auth/supabase";

// ---------------------------------------------------------------------------
// 1. Kinetic Particle Field Generator
// ---------------------------------------------------------------------------

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}

function KineticParticles() {
  const particles: Particle[] = useMemo(() => {
    const colors = ["#818cf8", "#c084fc", "#38bdf8", "#a855f7", "#6366f1"];
    return Array.from({ length: 26 }, (_, i) => ({
      id: i,
      x: Math.floor(Math.random() * 95) + 2,
      size: Math.floor(Math.random() * 3.5) + 2,
      duration: Math.floor(Math.random() * 8) + 8, // 8-16s drift
      delay: Math.floor(Math.random() * 6),
      opacity: Math.random() * 0.45 + 0.2, // 0.2 - 0.65
      color: colors[i % colors.length],
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          }}
          initial={{ y: "115%", opacity: 0 }}
          animate={{
            y: ["115%", "-15%"],
            opacity: [0, p.opacity, p.opacity, 0],
            x: [`${p.x}%`, `${p.x + (p.id % 2 === 0 ? 3.5 : -3.5)}%`],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Animated Knowledge Orbit (Hero Module)
// ---------------------------------------------------------------------------

function KnowledgeOrbit() {
  return (
    <div className="relative w-full h-[280px] sm:h-[340px] flex items-center justify-center select-none overflow-visible">
      {/* Dynamic Ambient Blur Glows Behind Badge */}
      <div className="absolute w-56 h-56 rounded-full bg-indigo-600/25 blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute w-44 h-44 rounded-full bg-purple-600/30 blur-2xl pointer-events-none" />

      {/* Overlapping, Tilted Elliptical SVG Pathways */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        viewBox="0 0 500 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="orbitGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#c084fc" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="orbitGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Orbit Track 1: Tilted Left (-22 deg) */}
        <g transform="translate(250, 180) rotate(-22)">
          <ellipse
            cx="0"
            cy="0"
            rx="180"
            ry="68"
            stroke="url(#orbitGrad1)"
            strokeWidth="2"
            strokeDasharray="6 8"
            className="opacity-75"
          />
        </g>

        {/* Orbit Track 2: Tilted Right (+32 deg) */}
        <g transform="translate(250, 180) rotate(32)">
          <ellipse
            cx="0"
            cy="0"
            rx="195"
            ry="74"
            stroke="url(#orbitGrad2)"
            strokeWidth="2.2"
            strokeDasharray="8 6"
            className="opacity-80"
          />
        </g>
      </svg>

      {/* Satellite 1: 'State Claim' Document Icon (Sliding along Orbit Track 1) */}
      <motion.div
        className="absolute z-20 pointer-events-none"
        animate={{
          x: [-170, 0, 170, 0, -170],
          y: [-55, 60, -55, -60, -55],
          scale: [0.85, 1.12, 0.85, 0.75, 0.85],
          opacity: [0.75, 1, 0.75, 0.55, 0.75],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-indigo-400/50 shadow-[0_0_18px_rgba(99,102,241,0.5)] backdrop-blur-md">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-[10px] font-mono font-bold text-indigo-200 uppercase tracking-wider">
            Claim Doc
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
        </div>
      </motion.div>

      {/* Satellite 2: 'Verified' Shield Icon (Sliding along Orbit Track 2) */}
      <motion.div
        className="absolute z-20 pointer-events-none"
        animate={{
          x: [180, 0, -180, 0, 180],
          y: [70, -65, 70, 65, 70],
          scale: [0.85, 1.15, 0.85, 0.75, 0.85],
          opacity: [0.75, 1, 0.75, 0.55, 0.75],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-emerald-400/60 shadow-[0_0_18px_rgba(52,211,153,0.55)] backdrop-blur-md">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono font-bold text-emerald-200 uppercase tracking-wider">
            Verified
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
      </motion.div>

      {/* Central Containment: Baton Circular Badge */}
      <motion.div
        className="relative z-10 w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center"
        animate={{
          y: [-4, 4, -4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Rotating Outer Gradient Rim */}
        <div className="absolute inset-0 rounded-full p-[2px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 animate-spin-slow">
          <div className="w-full h-full rounded-full bg-slate-950/80 backdrop-blur-2xl" />
        </div>

        {/* Frosted Glass Shell */}
        <div className="relative w-full h-full rounded-full bg-gradient-to-tr from-white/10 via-purple-400/5 to-indigo-500/10 backdrop-blur-xl border border-white/30 shadow-[0_12px_36px_rgba(79,70,229,0.35)] flex items-center justify-center p-3 overflow-hidden">
          {/* Specular curved glint */}
          <div className="absolute top-2 left-4 w-12 h-6 rounded-full bg-white/40 blur-xs rotate-[-25deg] pointer-events-none" />

          {/* Baton Logo Asset */}
          <img
            src="/assets/baton-logo.png"
            alt="Baton Knowledge Emblem"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain relative z-10 drop-shadow-md select-none"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = "/logo.png";
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Main Split-Screen Unified Auth Component (Login + Registration)
// ---------------------------------------------------------------------------

export function SignUp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { switchRole, loginDemo } = useAuth();
  const { toggleTheme, isDark } = useTheme();

  // 1. Toggle State: false = Registration (Sign Up), true = Login
  const [isLogin, setIsLogin] = useState<boolean>(location.pathname === "/login");
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isRecovery, setIsRecovery] = useState(
    () => new URLSearchParams(location.search).get("recovery") === "1",
  );

  // Keep state synchronized if URL route shifts
  useEffect(() => {
    setIsLogin(location.pathname === "/login");
    if (new URLSearchParams(location.search).get("recovery") === "1") {
      setIsRecovery(true);
      setIsForgotPassword(false);
    }
  }, [location.pathname, location.search]);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const repeatPasswordInputRef = useRef<HTMLInputElement>(null);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const isRegistration = !isLogin && !isRecovery && !isForgotPassword;

  // Active Focus Trackers for Animated Underlines
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const completingLogin = useRef(false);
  const signupInProgress = useRef(false);

  const completeAuthenticatedLogin = useCallback(async () => {
    if (completingLogin.current) return;
    completingLogin.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await loginDemo("approver");
      navigate("/dashboard", { replace: true });
    } catch (cause) {
      completingLogin.current = false;
      setError(cause instanceof Error ? cause.message : "Signed in, but Baton could not open your workspace.");
    } finally {
      setSubmitting(false);
    }
  }, [loginDemo, navigate]);

  function changeAuthPage(nextIsLogin: boolean) {
    setIsLogin(nextIsLogin);
    setIsForgotPassword(false);
    setIsRecovery(false);
    setError(null);
    setNotice(null);
    setPassword("");
    setRepeatPassword("");
    navigate(nextIsLogin ? "/login" : "/signup", { replace: true });
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsLogin(true);
        setIsRecovery(true);
        setIsForgotPassword(false);
        setNotice("Choose a new password for your account.");
        return;
      }
      if (event === "SIGNED_IN" && signupInProgress.current) return;
      if (event === "SIGNED_IN" && session && !isRecovery) {
        window.setTimeout(() => {
          if (active) void completeAuthenticatedLogin();
        }, 0);
      }
    });

    void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      else if (sessionData.session && !isRecovery && !signupInProgress.current) void completeAuthenticatedLogin();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [completeAuthenticatedLogin, isRecovery]);

  // Password Strength Calculation (relevant for registration)
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  }, [password]);

  const passwordMatch = useMemo(() => {
    if (!repeatPassword) return null;
    return password === repeatPassword;
  }, [password, repeatPassword]);

  // Unified Form Submission Handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!supabase) {
      setError("Supabase sign-in is not configured for this deployment.");
      return;
    }

    if ((!isLogin || isRecovery) && password !== repeatPassword) {
      setError("Those passwords do not match.");
      return;
    }
    if (!isLogin && !isRecovery) {
      if (!agreeTerms) {
        setError("Please accept Baton's terms and privacy policy to continue.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isRecovery) {
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setIsRecovery(false);
        setNotice("Password updated. Opening your Baton workspace…");
        await completeAuthenticatedLogin();
      } else if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?recovery=1`,
        });
        if (resetError) throw resetError;
        setNotice("If an account exists for that address, a password reset link is on its way.");
      } else if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await completeAuthenticatedLogin();
      } else {
        signupInProgress.current = true;
        try {
          const { data, error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { full_name: name.trim() },
              emailRedirectTo: `${window.location.origin}/login`,
            },
          });
          if (signUpError) throw signUpError;

          // Supabase can return an empty identities array for an email that is
          // already registered (when email enumeration protection is enabled).
          // Keep the address and take the user straight to sign-in/recovery.
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            setIsLogin(true);
            setIsForgotPassword(false);
            setIsRecovery(false);
            setPassword("");
            setRepeatPassword("");
            setError("An account may already exist for this email. Sign in or use “Forgot password?” to reset it.");
            navigate("/login", { replace: true });
          } else if (data.session) {
            // Return to the requested sign-in page even when Supabase has email
            // confirmation disabled. Clear the just-created local session so
            // the auth listener does not skip the sign-in screen.
            const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
            if (signOutError) throw signOutError;
            setIsLogin(true);
            setIsForgotPassword(false);
            setIsRecovery(false);
            setPassword("");
            setRepeatPassword("");
            setNotice("Account created. Sign in with your email and password.");
            navigate("/login", { replace: true });
          } else {
            setIsLogin(true);
            setIsForgotPassword(false);
            setIsRecovery(false);
            setPassword("");
            setRepeatPassword("");
            setNotice("Account created. Check your email to confirm it, then sign in here.");
            navigate("/login", { replace: true });
          }
        } finally {
          signupInProgress.current = false;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t complete that request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    if (!supabase) {
      setError("Supabase sign-in is not configured for this deployment.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/login` },
      });
      if (oauthError) throw oauthError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start social sign-in.");
      setSubmitting(false);
    }
  };

  // 1-Click Demo Workspace Handler
  const handleDemoLogin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (loginDemo) {
        await loginDemo("approver");
      } else {
        await switchRole("approver");
      }
      navigate("/dashboard");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open the demo workspace.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-500 font-sans ${
        isDark ? "bg-[#080914] text-slate-100" : "bg-[#f8fafc] text-slate-900"
      }`}
    >
      {/* ===================================================================
          Top Navigation Bar (Baton Logo + Mode Toggle + Demo Mode + Theme Toggle)
         =================================================================== */}
      <header className="relative z-30 w-full px-6 lg:px-14 py-6 flex items-center justify-between">
        {/* Left Corner Logo: Baton custom emblem + Brand Typography */}
        <Link
          to="/"
          className="flex items-center gap-3.5 group focus:outline-none"
          aria-label="Baton Home"
        >
          <img
            src="/assets/baton-logo.png"
            alt="Baton Logo"
            className="w-9 h-9 object-contain transition-transform group-hover:scale-105 drop-shadow-sm select-none"
          />
          <div className="flex flex-col">
            <span
              className={`text-xl font-black tracking-tight font-display ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Baton
            </span>
            <span className="text-[10px] font-semibold text-purple-500 tracking-wider uppercase -mt-1">
              Handover Engine
            </span>
          </div>
        </Link>

        {/* Right Corner Controls: Demo Mode + Theme + Toggle Link Button */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* 1-Click Demo Mode Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={submitting}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shadow-xs ${
              isDark
                ? "bg-purple-950/60 border-purple-500/40 text-purple-200 hover:bg-purple-900/60 hover:border-purple-400"
                : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300"
            }`}
            title="Instant access without registration"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
            <span>Demo Mode</span>
          </button>

          {/* Theme Toggle Pill */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
              isDark
                ? "bg-slate-900/80 border-slate-700/60 text-amber-300 hover:text-amber-200 hover:border-slate-600"
                : "bg-white border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200"
            }`}
            title={`Switch to ${isDark ? "Light" : "Dark"} Mode`}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Toggle Link Button: Switches between Login & Sign Up */}
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs font-medium ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            <span>{isLogin ? "Don't have an account?" : "Already have an account?"}</span>
            <button
              type="button"
              onClick={() => changeAuthPage(!isLogin)}
              className="font-bold text-indigo-500 hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
            >
              {isLogin ? "Sign up here" : "Sign in here"}
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================
          Main Split Screen Layout (Left Animated Hero + Right Interactive Form)
         =================================================================== */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-14 py-4 sm:py-8">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* ---------------------------------------------------------------
              LEFT SIDE: The Kinetic Particle Space & Knowledge Orbit Hero
             --------------------------------------------------------------- */}
          <section className="lg:col-span-6 xl:col-span-7 relative flex flex-col justify-center rounded-3xl p-6 sm:p-10 lg:p-12 overflow-hidden">
            {/* Kinetic Space Ambient Background */}
            <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden">
              <div
                className={`absolute inset-0 transition-opacity duration-700 ${
                  isDark
                    ? "bg-gradient-to-tr from-indigo-950 via-slate-950 to-purple-950 opacity-95"
                    : "bg-gradient-to-tr from-indigo-900 via-slate-900 to-purple-900 opacity-90"
                }`}
              />

              {/* Shifting Gradient Mesh Overlays */}
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-purple-600/30 rounded-full blur-[90px] animate-pulse" />
              <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/35 rounded-full blur-[100px] animate-pulse" />
              <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-cyan-500/15 rounded-full blur-[80px]" />

              {/* Kinetic Particle Field */}
              <KineticParticles />
            </div>

            {/* Left Content Container */}
            <div className="relative z-10 space-y-6">
              {/* Product Badge Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-purple-200 text-xs font-semibold tracking-wide shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Next-Gen Knowledge Handover</span>
              </div>

              {/* Shimmering Metallic Gradient Headline */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.15]">
                  Prove Every Claim.{" "}
                  <span className="text-transparent bg-clip-text bg-[linear-gradient(110deg,#ffffff_20%,#c084fc_45%,#818cf8_55%,#ffffff_80%)] bg-[length:200%_100%] animate-[shimmerText_5s_infinite_linear]">
                    Handover in Minutes.
                  </span>
                </h1>
                <p className="text-slate-300 text-sm sm:text-base max-w-xl font-normal leading-relaxed">
                  Baton extracts, links, and cryptographically proves continuity across Jira,
                  GitHub, Slack, and design decisions before talent shifts.
                </p>
              </div>

              {/* Animated Knowledge Orbit Module */}
              <div className="py-2">
                <KnowledgeOrbit />
              </div>

              {/* Value Proposition Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Citations & Proof</p>
                    <p className="text-[11px] text-slate-400">Zero unverifiable claims</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Automated Review</p>
                    <p className="text-[11px] text-slate-400">92% faster sign-offs</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------
              RIGHT SIDE: Unified Interactive Underline Form (Login / Sign Up)
             --------------------------------------------------------------- */}
          <section className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
            <div
              className={`w-full max-w-md rounded-[32px] p-8 sm:p-10 shadow-2xl transition-all duration-300 border relative ${
                isDark
                  ? "bg-[#0d1024]/90 backdrop-blur-2xl border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] text-white"
                  : "bg-white border-slate-200/90 shadow-2xl shadow-indigo-100/70 text-slate-900"
              }`}
            >
              {/* Form Dynamic Header */}
              <div className="mb-6">
                <h2
                  className={`text-2xl sm:text-3xl font-black tracking-tight ${
                    isDark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {isRecovery ? "Choose a new password" : isForgotPassword ? "Reset your password" : isLogin ? "Welcome Back" : "Create Your Account"}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  {isRecovery
                    ? "Set a new password to finish recovering your account."
                    : isForgotPassword
                    ? "Enter your email and we’ll send you a password reset link."
                    : isLogin
                    ? "Sign in to access your verified handovers."
                    : "Join enterprise engineering teams powering verified handovers."}
                </p>
              </div>

              {!isSupabaseConfigured && (
                <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-medium">
                  Supabase is not configured for this site. Email sign-in and account creation are unavailable.
                </div>
              )}

              {notice && (
                <div role="status" className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-medium">
                  {notice}
                </div>
              )}

              {/* Error Notice */}
              {error && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form with Animated Underlines */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence initial={false}>
                  {/* 1. Name Field (Sign Up Only) */}
                  {isRegistration && (
                    <motion.div
                      key="signup-name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative overflow-hidden"
                    >
                      <label
                        htmlFor="signup-name"
                        className={`block text-[11px] font-bold uppercase tracking-wider mb-1 transition-colors ${
                          focusedField === "name"
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        Your Name
                      </label>
                      <div className="relative flex items-center">
                        <User className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 flex-shrink-0" />
                        <input
                          id="signup-name"
                          type="text"
                          required={isRegistration}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onFocus={() => setFocusedField("name")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="e.g. Aarav Mehta"
                          className={`w-full bg-transparent py-2.5 px-0 text-sm font-medium focus:outline-none placeholder:text-slate-400 border-b transition-colors ${
                            isDark
                              ? "text-white border-white/10"
                              : "text-slate-900 border-slate-200"
                          }`}
                        />
                        {/* Animated Focus Bar */}
                        <motion.div
                          className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: focusedField === "name" ? 1 : 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          style={{ originX: 0 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 2. Work Email Field (Always Shown) */}
                {!isRecovery && <div className="relative">
                  <label
                    htmlFor="signup-email"
                    className={`block text-[11px] font-bold uppercase tracking-wider mb-1 transition-colors ${
                      focusedField === "email"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    Work Email
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 flex-shrink-0" />
                    <input
                      id="signup-email"
                      type="email"
                      required
                      minLength={isLogin && !isRecovery ? undefined : 8}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      placeholder="name@company.com"
                      className={`w-full bg-transparent py-2.5 px-0 text-sm font-medium focus:outline-none placeholder:text-slate-400 border-b transition-colors ${
                        isDark
                          ? "text-white border-white/10"
                          : "text-slate-900 border-slate-200"
                      }`}
                    />
                    {/* Animated Focus Bar */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: focusedField === "email" ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ originX: 0 }}
                    />
                  </div>
                </div>}

                {/* 3. Password Field (Always Shown) */}
                {!isForgotPassword && <div className="relative">
                  <label
                    htmlFor="signup-password"
                    className={`block text-[11px] font-bold uppercase tracking-wider mb-1 transition-colors ${
                      focusedField === "password"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {isRecovery ? "New Password" : isLogin ? "Password" : "Create Password"}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 flex-shrink-0" />
                    <input
                      key={showPassword ? "password-visible" : "password-hidden"}
                      ref={passwordInputRef}
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      placeholder={isLogin && !isRecovery ? "Enter your password" : "At least 8 characters"}
                      className={`w-full bg-transparent py-2.5 pr-8 pl-0 text-sm font-medium focus:outline-none placeholder:text-slate-400 border-b transition-colors ${
                        isDark
                          ? "text-white border-white/10"
                          : "text-slate-900 border-slate-200"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (passwordInputRef.current) setPassword(passwordInputRef.current.value);
                        setShowPassword((visible) => !visible);
                      }}
                      className="absolute right-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    {/* Animated Focus Bar */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: focusedField === "password" ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      style={{ originX: 0 }}
                    />
                  </div>

                  {/* Password Strength Indicator Bar (Sign Up Only) */}
                  {isRegistration && password && (
                    <div className="mt-2 space-y-1">
                      <div className="w-full bg-slate-200 dark:bg-white/10 h-1 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${
                            passwordStrength <= 25
                              ? "bg-rose-500"
                              : passwordStrength <= 50
                              ? "bg-amber-500"
                              : passwordStrength <= 70
                              ? "bg-indigo-500"
                              : "bg-emerald-500"
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${passwordStrength}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Strength</span>
                        <span className="font-semibold">
                          {passwordStrength <= 25
                            ? "Weak"
                            : passwordStrength <= 50
                            ? "Fair"
                            : passwordStrength <= 75
                            ? "Good"
                            : "Strong"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>}

                <AnimatePresence initial={false}>
                  {/* 4. Repeat Password Field (Sign Up Only) */}
                  {(isRegistration || isRecovery) && (
                    <motion.div
                      key="signup-repeat-password-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative overflow-hidden"
                    >
                      <label
                        htmlFor="signup-repeat-password"
                        className={`block text-[11px] font-bold uppercase tracking-wider mb-1 transition-colors ${
                          focusedField === "repeatPassword"
                            ? "text-indigo-600 dark:text-indigo-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {isRecovery ? "Confirm New Password" : "Repeat Password"}
                      </label>
                      <div className="relative flex items-center">
                        <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2 flex-shrink-0" />
                        <input
                          key={showRepeatPassword ? "repeat-password-visible" : "repeat-password-hidden"}
                          ref={repeatPasswordInputRef}
                          id="signup-repeat-password"
                          type={showRepeatPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          value={repeatPassword}
                          onChange={(e) => setRepeatPassword(e.target.value)}
                          onFocus={() => setFocusedField("repeatPassword")}
                          onBlur={() => setFocusedField(null)}
                          placeholder="Confirm password"
                          className={`w-full bg-transparent py-2.5 pr-8 pl-0 text-sm font-medium focus:outline-none placeholder:text-slate-400 border-b transition-colors ${
                            isDark
                              ? "text-white border-white/10"
                              : "text-slate-900 border-slate-200"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (repeatPasswordInputRef.current) setRepeatPassword(repeatPasswordInputRef.current.value);
                            setShowRepeatPassword((visible) => !visible);
                          }}
                          className="absolute right-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                          aria-label={showRepeatPassword ? "Hide repeat password" : "Show repeat password"}
                          aria-pressed={showRepeatPassword}
                        >
                          {showRepeatPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        {/* Animated Focus Bar */}
                        <motion.div
                          className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: focusedField === "repeatPassword" ? 1 : 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          style={{ originX: 0 }}
                        />
                      </div>

                      {/* Password Match Status */}
                      {repeatPassword && (
                        <p
                          className={`text-[10px] mt-1 font-medium ${
                            passwordMatch ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {passwordMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Terms Agreement Checkbox (Sign Up Only) */}
                {isRegistration && (
                  <div className="flex items-start pt-1">
                    <input
                      id="agree-terms"
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer mt-0.5"
                    />
                    <label
                      htmlFor="agree-terms"
                      className="ml-2.5 text-xs text-slate-500 dark:text-slate-400 leading-normal select-none cursor-pointer"
                    >
                      I agree to Baton&apos;s{" "}
                      <a href="#terms" className="text-indigo-500 hover:underline">
                        Terms of Service
                      </a>{" "}
                      and{" "}
                      <a href="#privacy" className="text-indigo-500 hover:underline">
                        Privacy Policy
                      </a>
                      .
                    </label>
                  </div>
                )}

                {!isRecovery && isLogin && !isForgotPassword && (
                  <div className="-mt-3 text-right">
                    <button
                      type="button"
                      onClick={() => { setIsForgotPassword(true); setError(null); setNotice(null); }}
                      className="text-xs font-semibold text-indigo-500 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Dynamic Submit Button */}
                <motion.button
                  type="submit"
                  disabled={submitting}
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg shadow-indigo-600/30 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                >
                  <span>
                    {submitting
                      ? isRecovery ? "Updating password…" : isForgotPassword ? "Sending reset link…" : isLogin ? "Signing in…" : "Creating account…"
                      : isRecovery ? "Update Password →" : isForgotPassword ? "Send Reset Link →" : isLogin ? "Sign In to Baton →" : "Create Account →"}
                  </span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </form>

              {/* Or Divider */}
              {!isForgotPassword && !isRecovery && <div className="relative my-6 text-center">
                <div aria-hidden="true" className="absolute inset-0 flex items-center">
                  <div
                    className={`w-full border-t ${
                      isDark ? "border-white/10" : "border-slate-200"
                    }`}
                  />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span
                    className={`px-3 uppercase tracking-wider font-semibold text-[10px] ${
                      isDark ? "bg-[#0d1024] text-slate-500" : "bg-white text-slate-400"
                    }`}
                  >
                    {isLogin ? "Or continue with" : "Or register with"}
                  </span>
                </div>
              </div>}

              {/* SSO / Social Fast Auth Buttons */}
              {!isForgotPassword && !isRecovery && <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => void handleOAuth("github")}
                  disabled={submitting}
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    isDark
                      ? "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    />
                  </svg>
                  <span>GitHub</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleOAuth("google")}
                  disabled={submitting}
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition cursor-pointer ${
                    isDark
                      ? "bg-white/5 border-white/10 text-slate-200 hover:bg-white/10"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Google</span>
                </button>
              </div>}

              {/* 1-Click Demo Workspace Option */}
              {!isForgotPassword && !isRecovery && <div className="mt-5 pt-4 border-t border-dashed border-indigo-400/25 text-center">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={submitting}
                  className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer shadow-sm ${
                    isDark
                      ? "bg-gradient-to-r from-purple-950/60 to-indigo-950/60 border-purple-500/40 text-purple-200 hover:border-purple-400 hover:text-white hover:brightness-110"
                      : "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 text-purple-800 hover:bg-purple-100 hover:border-purple-300"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                  <span>Launch Demo Workspace (1-Click Instant Access) →</span>
                </button>
                <p className={`text-[11px] mt-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Explore preloaded project state, claims ledger, and risk radar.
                </p>
              </div>}

              {/* Bottom Mode Toggle Link Button */}
              <div
                className={`mt-6 pt-5 border-t text-center text-xs ${
                  isDark
                    ? "border-white/10 text-slate-400"
                    : "border-slate-100 text-slate-500"
                }`}
              >
                <span>{isForgotPassword || isRecovery ? "Remembered your password? " : isLogin ? "Don't have an account? " : "Already have an account? "}</span>
                <button
                  type="button"
                  onClick={() => changeAuthPage(isForgotPassword || isRecovery ? true : !isLogin)}
                  className="font-bold text-indigo-500 hover:text-indigo-400 hover:underline transition-colors cursor-pointer"
                >
                  {isForgotPassword || isRecovery ? "Sign in here" : isLogin ? "Sign up here" : "Sign in here"}
                </button>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* ===================================================================
          Bottom Footer
         =================================================================== */}
      <footer
        className={`relative z-20 w-full px-6 lg:px-14 py-6 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors ${
          isDark
            ? "border-white/10 text-slate-500"
            : "border-slate-200 text-slate-500"
        }`}
      >
        <div className="flex items-center gap-2">
          <span>© 2026 Baton Inc. AI-Powered Project Continuity &amp; Handover Engine.</span>
        </div>
        <div className="flex items-center space-x-6">
          <a className="hover:text-indigo-500 transition-colors" href="#privacy">
            Privacy Policy
          </a>
          <a className="hover:text-indigo-500 transition-colors" href="#soc2">
            SOC2 Certified
          </a>
          <a className="hover:text-indigo-500 transition-colors" href="#terms">
            Terms of Service
          </a>
          <a className="hover:text-indigo-500 transition-colors" href="#docs">
            Documentation
          </a>
        </div>
      </footer>
    </div>
  );
}

// Aliases ensuring backwards compatibility with any router or imports
export { SignUp as AuthPage, SignUp as LoginPage, SignUp as default };
