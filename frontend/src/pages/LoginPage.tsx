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
          <FlaskConical size={24} />
          <span>Namotech Consultancy</span>
        </div>
        <p className="section-label">NCRC</p>
        <h1>Internal Software</h1>
        <p>
          From intake to certified report — registrations, lab observations,
          approvals, and billing, all in one record per job.
        </p>
      </section>

      <form className="auth-panel" onSubmit={handleSubmit}>
        <div>
          <p className="section-label">Secure access</p>
          <h2>Sign in</h2>
        </div>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <div className="error-banner">{error}</div> : null}
        <span className="sync-pill" style={{ alignSelf: "flex-start" }}>
          {status}
        </span>
        <button type="submit">
          Sign in
          <ArrowRight size={18} />
        </button>
        <button
          type="button"
          className="ghost-button"
          onClick={() => setShowForgot(true)}
          style={{ marginTop: "0.25rem" }}
        >
          Forgot Password?
        </button>
      </form>
    </main>
  );
}
