import { useState } from "react";
import { api, ApiError } from "../api";

export function AuthFlow() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.requestLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card">
        <p className="kicker">Check your email</p>
        <h2 className="section-header">Sign-in link sent</h2>
        <p className="app-sub">
          If <strong>{email}</strong> is valid, a sign-in link is on its way. In
          development the link is printed to the backend console.
        </p>
        <button className="btn secondary" onClick={() => setSent(false)}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <p className="kicker">Sign in</p>
      <h2 className="section-header">Enter your email</h2>
      <p className="app-sub">
        We'll email you a one-time sign-in link. No password required.
      </p>
      <form onSubmit={submit}>
        <div className="field">
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            required
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <div className="msg error">{error}</div>}
        <div className="actions">
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send sign-in link"}
          </button>
        </div>
      </form>
    </div>
  );
}
