import { useState, type FormEvent } from "react";
import { FlaskConical, ArrowRight } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

export function LoginPage() {
  const [email, setEmail] = useState("admin@admin.com");
  const [password, setPassword] = useState("password");
  const [showForgot, setShowForgot] = useState(false);
  const { login, error, status } = useAuth();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await login(email, password);
  };

  if (showForgot) {
    return <ForgotPasswordPage onBack={() => setShowForgot(false)} />;
  }

  return (
    <main className="login-screen">
      <section className="login-art">
        <div className="brand-mark">
          <span className="sidebar-brand__logo"><FlaskConical size={18} /></span>
          <span>Namotech Consultancy</span>
        </div>
        <div className="login-art__body">
          <h1>NCRC <em>Lab</em> Management</h1>
          <p>
            From intake to certified report — registrations, lab observations,
            approvals, and billing, all in one record per job.
          </p>
        </div>
        <span className="login-art__foot">Internal software · Authorized personnel only</span>
      </section>

      <form className="auth-panel" onSubmit={handleSubmit}>
        <div>
          <h2>Sign in</h2>
          <p className="auth-panel__sub">Use your work account to continue.</p>
        </div>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            Password
            <button type="button" className="link" style={{ fontSize: "0.8rem" }} onClick={() => setShowForgot(true)}>
              Forgot password?
            </button>
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <div className="error-banner">{error}</div> : null}
        <button type="submit" disabled={status === "Signing in"}>
          {status === "Signing in" ? "Signing in…" : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
    </main>
  );
}
