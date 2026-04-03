import { useState, useTransition } from "react";

interface LoginPanelProps {
  onLogin: (email: string, password: string) => Promise<void>;
  errorMessage: string | null;
}

export function LoginPanel({ onLogin, errorMessage }: LoginPanelProps) {
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("password123");
  const [isPending, startTransition] = useTransition();

  return (
    <section className="hero auth-hero is-fullheight">
      <div className="hero-body">
        <div className="container">
          <div className="columns is-centered">
            <div className="column is-5-tablet is-4-desktop">
              <div className="box auth-card">
                <p className="eyebrow">Lab Competence Portal</p>
                <h1 className="title is-2 auth-title">
                  Training that feels organised, visible, and audit-ready.
                </h1>
                <p className="subtitle is-6">
                  Sign in to manage templates, review due training, and track
                  section competency records.
                </p>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(() => {
                      void onLogin(email, password);
                    });
                  }}
                >
                  <div className="field">
                    <label className="label">Email</label>
                    <div className="control">
                      <input
                        className="input is-medium"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label className="label">Password</label>
                    <div className="control">
                      <input
                        className="input is-medium"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </div>
                  </div>

                  {errorMessage ? (
                    <p className="help is-danger">{errorMessage}</p>
                  ) : null}

                  <button
                    className={`button is-link is-medium is-fullwidth ${
                      isPending ? "is-loading" : ""
                    }`}
                    type="submit"
                    disabled={isPending}
                  >
                    Enter dashboard
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
