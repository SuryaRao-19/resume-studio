import { useEffect, useState } from "react";
import { api } from "./api";
import type { Mode } from "./types";
import { AuthFlow } from "./components/AuthFlow";
import { BuildPanel } from "./components/BuildPanel";
import { CheckPanel } from "./components/CheckPanel";
import { OptimizePanel } from "./components/OptimizePanel";
import { CoverLetterPanel } from "./components/CoverLetterPanel";
import { MyResumes } from "./components/MyResumes";

type View = Mode | "resumes";
type SeedTarget = "check" | "optimize" | "cover";

export function App() {
  const [email, setEmail] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>("build");
  // Content lifted from a saved resume into another panel; nonce forces the
  // target panel's effect to re-run even for identical content.
  const [seed, setSeed] = useState<{ content: string; nonce: number }>({
    content: "",
    nonce: 0,
  });

  function useSaved(content: string, target: SeedTarget) {
    setSeed({ content, nonce: Date.now() });
    setView(target);
  }

  // On load: handle a magic-link verify URL, otherwise probe the session.
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const isVerify = window.location.pathname.replace(/\/+$/, "") === "/verify";
      if (isVerify && token) {
        try {
          const res = await api.verify(token);
          setEmail(res.email);
        } catch {
          /* fall through to signed-out state */
        } finally {
          window.history.replaceState({}, "", "/");
          setBooting(false);
        }
        return;
      }
      try {
        const me = await api.me();
        setEmail(me.email);
      } catch {
        /* not signed in */
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    setEmail(null);
    setView("build");
  }

  return (
    <div className="app">
      <p className="kicker">Resume Studio</p>
      <h1 className="app-title">From messy notes to a resume that gets read.</h1>
      <p className="app-sub">Build, check, and optimize — powered by AI.</p>

      {booting ? (
        <div className="loading">Loading…</div>
      ) : !email ? (
        <AuthFlow />
      ) : (
        <>
          <div className="topbar">
            <div className="nav-links">
              <button
                className="linkbtn"
                onClick={() => setView("build")}
                style={{ color: view !== "resumes" ? "var(--signal)" : undefined }}
              >
                Studio
              </button>
              <button className="linkbtn" onClick={() => setView("resumes")}>
                My resumes
              </button>
            </div>
            <div className="nav-links">
              <span className="meta">{email}</span>
              <button className="linkbtn" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>

          <div className="card">
            {view === "resumes" ? (
              <MyResumes onUse={useSaved} />
            ) : (
              <>
                <div className="tabs">
                  <button
                    className={`tab ${view === "build" ? "active" : ""}`}
                    onClick={() => setView("build")}
                  >
                    Build
                  </button>
                  <button
                    className={`tab ${view === "check" ? "active" : ""}`}
                    onClick={() => setView("check")}
                  >
                    Check
                  </button>
                  <button
                    className={`tab ${view === "optimize" ? "active" : ""}`}
                    onClick={() => setView("optimize")}
                  >
                    Optimize
                  </button>
                  <button
                    className={`tab ${view === "cover" ? "active" : ""}`}
                    onClick={() => setView("cover")}
                  >
                    Cover letter
                  </button>
                </div>

                {/* All panels stay mounted so switching tabs preserves input. */}
                <div hidden={view !== "build"}>
                  <BuildPanel />
                </div>
                <div hidden={view !== "check"}>
                  <CheckPanel seedContent={seed.content} seedNonce={seed.nonce} />
                </div>
                <div hidden={view !== "optimize"}>
                  <OptimizePanel seedContent={seed.content} seedNonce={seed.nonce} />
                </div>
                <div hidden={view !== "cover"}>
                  <CoverLetterPanel seedContent={seed.content} seedNonce={seed.nonce} />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
