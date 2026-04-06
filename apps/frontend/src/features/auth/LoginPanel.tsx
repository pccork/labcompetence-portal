import { useState, useTransition } from "react";

interface LoginPanelProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onMicrosoftLogin: () => Promise<void>;
  errorMessage: string | null;
  localEnabled: boolean;
  microsoftEnabled: boolean;
  microsoftEmailDomain?: string | null;
  authConfigReady: boolean;
  isMicrosoftPending?: boolean;
}

export function LoginPanel({
  onLogin,
  onMicrosoftLogin,
  errorMessage,
  localEnabled,
  microsoftEnabled,
  microsoftEmailDomain,
  authConfigReady,
  isMicrosoftPending = false,
}: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

                {!authConfigReady ? (
                  <p className="has-text-grey">Loading sign-in options...</p>
                ) : null}

                {microsoftEnabled ? (
                  <>
                    <button
                      className={`button is-medium is-fullwidth ${
                        isMicrosoftPending ? "is-loading" : ""
                      }`}
                      type="button"
                      disabled={!authConfigReady || isPending || isMicrosoftPending}
                      onClick={() => {
                        startTransition(() => {
                          void onMicrosoftLogin();
                        });
                      }}
                    >
                      Continue with Microsoft
                    </button>
                    {microsoftEmailDomain ? (
                      <p className="help">
                        Use your company Microsoft account ending in @{microsoftEmailDomain}.
                      </p>
                    ) : null}
                  </>
                ) : null}

                {localEnabled ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      startTransition(() => {
                        void onLogin(email, password);
                      });
                    }}
                  >
                    {microsoftEnabled ? <hr /> : null}

                    <div className="field">
                      <label className="label" htmlFor="login-email">
                        Email
                      </label>
                      <div className="control">
                        <input
                          id="login-email"
                          className="input is-medium"
                          type="email"
                          autoComplete="username"
                          placeholder="name@company.ie"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="label" htmlFor="login-password">
                        Password
                      </label>
                      <div className="control">
                        <input
                          id="login-password"
                          className="input is-medium"
                          type="password"
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      className={`button is-link is-medium is-fullwidth ${
                        isPending ? "is-loading" : ""
                      }`}
                      type="submit"
                      disabled={!authConfigReady || isPending || isMicrosoftPending}
                    >
                      Enter dashboard
                    </button>
                  </form>
                ) : null}

                {!localEnabled && !microsoftEnabled && authConfigReady ? (
                  <p className="help is-danger">
                    No sign-in providers are currently enabled.
                  </p>
                ) : null}

                {errorMessage ? (
                  <p className="help is-danger">{errorMessage}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
