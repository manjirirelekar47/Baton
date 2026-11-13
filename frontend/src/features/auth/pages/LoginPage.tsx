import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/app/auth";
import { ROLE_LABELS, type Role } from "@/shared/types";

export function LoginPage() {
  const { switchRole, error: authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("samruddhi@company.com");
  const [password, setPassword] = useState("••••••••••••");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("approver");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(roleToLogin: Role = selectedRole) {
    setSubmitting(true);
    setError(null);
    try {
      await switchRole(roleToLogin);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void handleLogin(selectedRole);
  }

  return (
    <div className="relative text-slate-100 antialiased overflow-x-hidden flex flex-col justify-between min-h-screen bg-[#0b0d1b]">
      {/* BEGIN: AmbientBackgroundGradients */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 mesh-glow-left"></div>
        <div className="absolute inset-0 mesh-glow-topright"></div>
        <div className="absolute inset-0 mesh-glow-bottom"></div>
        <div className="absolute inset-0 contour-lines opacity-60"></div>
        {/* Curving dynamic abstract vector glow */}
        <svg
          className="absolute top-0 right-0 w-[55vw] h-full opacity-35 mix-blend-screen pointer-events-none"
          fill="none"
          viewBox="0 0 800 800"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M780 50C620 180 540 380 620 540C700 700 820 740 850 780"
            filter="blur(60px)"
            stroke="url(#curveGrad)"
            strokeLinecap="round"
            strokeWidth="64"
          ></path>
          <path
            d="M850 20C690 120 480 320 520 560C560 800 720 820 850 860"
            filter="blur(40px)"
            stroke="#8b5cf6"
            strokeLinecap="round"
            strokeWidth="32"
          ></path>
          <defs>
            <linearGradient id="curveGrad" x1="500" x2="850" y1="50" y2="780" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4f46e5"></stop>
              <stop offset="0.6" stopColor="#8b5cf6"></stop>
              <stop offset="1" stopColor="#38bdf8"></stop>
            </linearGradient>
          </defs>
        </svg>
      </div>
      {/* END: AmbientBackgroundGradients */}

      {/* BEGIN: NavigationBar */}
      <header className="relative z-20 w-full px-6 lg:px-16 pt-8 pb-4 flex items-center justify-between">
        <Link to="/" aria-label="Baton Home" className="flex items-center gap-3 group focus:outline-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-400 flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform duration-200">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5.5 4.5H13C15.4853 4.5 17.5 6.51472 17.5 9C17.5 11.0264 16.1557 12.7383 14.3057 13.2981C16.5928 13.7845 18.25 15.8058 18.25 18.25C18.25 20.8734 16.1234 23 13.5 23H5.5C4.67157 23 4 22.3284 4 21.5V6C4 5.17157 4.67157 4.5 5.5 4.5Z"
                fill="currentColor"
                fillOpacity="0.2"
              ></path>
              <path
                clipRule="evenodd"
                d="M7 6C7 4.89543 7.89543 4 9 4H13.2C15.3539 4 17.1 5.74609 17.1 7.9C17.1 9.47959 16.1601 10.8388 14.8062 11.4554C16.4828 12.0622 17.65 13.6811 17.65 15.58C17.65 18.0211 15.6711 20 13.23 20H9C7.89543 20 7 19.1046 7 18V6ZM10.5 7.5V10.5H13.1C13.9284 10.5 14.6 9.82843 14.6 9C14.6 8.17157 13.9284 7.5 13.1 7.5H10.5ZM10.5 13.5V16.5H13.2C14.056 16.5 14.75 15.806 14.75 14.95C14.75 14.094 14.056 13.4 13.2 13.4H10.5Z"
                fill="white"
                fillRule="evenodd"
              ></path>
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white font-sans flex items-center">
            Baton
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-4 text-sm text-slate-300">
          <span>Need an enterprise demo?</span>
          <button
            onClick={() => void handleLogin("approver")}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition-colors cursor-pointer"
          >
            Launch Demo
          </button>
        </div>
      </header>
      {/* END: NavigationBar */}

      {/* BEGIN: MainContent */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-6 lg:px-16 py-8">
        <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* BEGIN: HeroShowcaseLeft */}
          <section className="lg:col-span-6 xl:col-span-7 flex flex-col justify-center space-y-8 pr-0 lg:pr-6">
            {/* Live status pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/25 text-indigo-300 text-xs font-semibold uppercase tracking-wider w-fit backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              AI-Powered Project Continuity
            </div>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
                Every Handover <br />
                with{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-purple-400">
                  Proof.
                </span>
              </h1>
              <p className="text-lg sm:text-xl font-medium text-slate-200">
                Capture. Verify. Transfer.
              </p>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl font-normal leading-relaxed">
                Baton ensures no knowledge walks out the door — with trusted, cited, and actionable insights gathered
                directly from your repositories, pull requests, and chat.
              </p>
            </div>

            {/* Feature bullet list */}
            <div className="space-y-4 pt-2 max-w-lg">
              <div className="flex items-center gap-3.5 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm group-hover:border-indigo-400/60 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    ></path>
                  </svg>
                </div>
                <span className="text-base text-slate-200 font-medium">Evidence-backed AI summaries</span>
              </div>

              <div className="flex items-center gap-3.5 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm group-hover:border-indigo-400/60 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    ></path>
                  </svg>
                </div>
                <span className="text-base text-slate-200 font-medium">Risk Radar for critical gaps & single owners</span>
              </div>

              <div className="flex items-center gap-3.5 group">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm group-hover:border-indigo-400/60 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    ></path>
                  </svg>
                </div>
                <span className="text-base text-slate-200 font-medium">Seamless handover workflows & action plans</span>
              </div>
            </div>

            {/* Trust badges */}
            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-400 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clipRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fillRule="evenodd"
                  ></path>
                </svg>
                <span>SOC2 Type II Certified</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    clipRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    fillRule="evenodd"
                  ></path>
                </svg>
                <span>Direct GitHub, Notion & Slack Citations</span>
              </div>
            </div>
          </section>
          {/* END: HeroShowcaseLeft */}

          {/* BEGIN: SignInCardRight */}
          <section className="lg:col-span-6 xl:col-span-5 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white text-slate-900 rounded-[28px] p-8 sm:p-10 shadow-2xl shadow-indigo-950/40 border border-slate-100 relative">
              <div className="text-left mb-6">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Welcome Back!
                </h2>
                <p className="text-sm text-slate-500 mt-1.5 font-normal">
                  Sign in or switch demo persona to continue
                </p>
              </div>

              {/* Demo Persona Quick Select */}
              <div className="mb-5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                  Select Demo Persona
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setSelectedRole(r);
                        void handleLogin(r);
                      }}
                      className={`px-3 py-2 text-xs font-medium rounded-xl border text-left transition ${
                        selectedRole === r
                          ? "border-indigo-600 bg-indigo-50/80 text-indigo-700 font-bold"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Alert */}
              {(error || authError) && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error || authError}
                </div>
              )}

              {/* Sign-In Form */}
              <form onSubmit={onSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5" htmlFor="email">
                    Work Email
                  </label>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                      </svg>
                    </div>
                    <input
                      className="block w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition-colors"
                      id="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      type="email"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600" htmlFor="password">
                      Password
                    </label>
                    <a className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors" href="#forgot">
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative rounded-xl shadow-sm">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          clipRule="evenodd"
                          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          fillRule="evenodd"
                        ></path>
                      </svg>
                    </div>
                    <input
                      className="block w-full rounded-xl border border-slate-200 pl-10 pr-10 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 transition-colors"
                      id="password"
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      type={showPassword ? "text" : "password"}
                    />
                    <button
                      aria-label="Toggle password visibility"
                      className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"></path>
                        <path
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.8"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Remember Device Checkbox */}
                <div className="flex items-center pt-1 pb-1">
                  <input
                    defaultChecked
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    id="remember-me"
                    type="checkbox"
                  />
                  <label className="ml-2.5 block text-xs sm:text-sm text-slate-600 cursor-pointer select-none" htmlFor="remember-me">
                    Remember this device for 30 days
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl text-white font-semibold text-sm shadow-md btn-gradient-primary cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                  type="submit"
                >
                  {submitting ? "Signing In..." : "Sign In to Baton"}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6 text-center">
                <div aria-hidden="true" className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">or</span>
                </div>
              </div>

              {/* SSO OAuth Buttons */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => void handleLogin("approver")}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm social-btn focus:outline-none cursor-pointer"
                >
                  <svg aria-hidden="true" className="w-5 h-5 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                      fillRule="evenodd"
                    ></path>
                  </svg>
                  <span>Continue with GitHub</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleLogin("incoming_maintainer")}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium text-sm social-btn focus:outline-none cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.15z"
                      fill="#4285F4"
                    ></path>
                    <path
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                      fill="#34A853"
                    ></path>
                    <path
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      fill="#FBBC05"
                    ></path>
                    <path
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      fill="#EA4335"
                    ></path>
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </div>

              {/* Enterprise SAML SSO toggle hint */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => void handleLogin("approver")}
                  className="text-xs text-slate-500 hover:text-indigo-600 font-medium inline-flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  </svg>
                  Sign in with SAML / Okta SSO
                </button>
              </div>

              {/* Card Footer */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  New to Baton?{" "}
                  <button
                    onClick={() => void handleLogin("approver")}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-all"
                  >
                    Explore Demo Workspace
                  </button>
                </p>
              </div>
            </div>
          </section>
          {/* END: SignInCardRight */}
        </div>
      </main>
      {/* END: MainContent */}

      {/* BEGIN: PageFooter */}
      <footer className="relative z-20 w-full px-6 lg:px-16 py-6 border-t border-slate-800/60 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>© 2025 Baton Inc. AI-Powered Project Continuity & Handover Engine.</span>
        </div>
        <div className="flex items-center space-x-6">
          <a className="hover:text-slate-300 transition-colors" href="#privacy">
            Privacy Policy
          </a>
          <a className="hover:text-slate-300 transition-colors" href="#soc2">
            SOC2 Certified
          </a>
          <a className="hover:text-slate-300 transition-colors" href="#terms">
            Terms of Service
          </a>
          <a className="hover:text-slate-300 transition-colors" href="#support">
            Support Center
          </a>
        </div>
      </footer>
      {/* END: PageFooter */}
    </div>
  );
}
