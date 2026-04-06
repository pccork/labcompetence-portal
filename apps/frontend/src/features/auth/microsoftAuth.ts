interface PendingMicrosoftAuth {
  codeVerifier: string;
  redirectUri: string;
  state: string;
}

const MICROSOFT_AUTH_KEY = "labcompetence-microsoft-auth";

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function createCodeChallenge(codeVerifier: string) {
  const verifierBytes = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", verifierBytes);

  return encodeBase64Url(new Uint8Array(digest));
}

function randomString(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export function getPendingMicrosoftAuth() {
  const raw = window.sessionStorage.getItem(MICROSOFT_AUTH_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingMicrosoftAuth;
  } catch {
    window.sessionStorage.removeItem(MICROSOFT_AUTH_KEY);
    return null;
  }
}

export function clearPendingMicrosoftAuth() {
  window.sessionStorage.removeItem(MICROSOFT_AUTH_KEY);
}

export async function beginMicrosoftLogin(input: {
  clientId: string;
  tenantId: string;
}) {
  const state = randomString(24);
  const codeVerifier = randomString(64);
  const codeChallenge = await createCodeChallenge(codeVerifier);
  const redirectUri = `${window.location.origin}${window.location.pathname}`;

  const authorizationUrl = new URL(
    `https://login.microsoftonline.com/${input.tenantId}/oauth2/v2.0/authorize`
  );

  authorizationUrl.searchParams.set("client_id", input.clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("response_mode", "query");
  authorizationUrl.searchParams.set("scope", "openid profile email");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", codeChallenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  authorizationUrl.searchParams.set("prompt", "select_account");

  window.sessionStorage.setItem(
    MICROSOFT_AUTH_KEY,
    JSON.stringify({
      codeVerifier,
      redirectUri,
      state,
    } satisfies PendingMicrosoftAuth)
  );

  window.location.assign(authorizationUrl.toString());
}
