import {
  createPublicKey,
  createVerify,
} from "crypto";

import { env } from "../config/env";

interface MicrosoftOpenIdConfiguration {
  issuer: string;
  jwks_uri: string;
  token_endpoint: string;
}

interface MicrosoftJwk {
  alg?: string;
  e: string;
  kid: string;
  kty: string;
  n: string;
  use?: string;
}

interface MicrosoftJwksResponse {
  keys: MicrosoftJwk[];
}

interface MicrosoftTokenResponse {
  error?: string;
  error_description?: string;
  id_token?: string;
}

interface IdTokenHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

interface IdTokenClaims {
  aud?: string;
  email?: string;
  exp?: number;
  iss?: string;
  name?: string;
  nbf?: number;
  preferred_username?: string;
  tid?: string;
  upn?: string;
}

export interface MicrosoftUserProfile {
  email: string;
  name: string;
}

let configurationCache:
  | { expiresAt: number; value: MicrosoftOpenIdConfiguration }
  | null = null;
let jwksCache:
  | { expiresAt: number; value: MicrosoftJwk[] }
  | null = null;

function assertMicrosoftAuthEnabled() {
  if (!env.AUTH_MICROSOFT_ENABLED) {
    throw new Error("Microsoft sign-in is not enabled");
  }

  if (
    !env.MICROSOFT_TENANT_ID ||
    !env.MICROSOFT_CLIENT_ID ||
    !env.MICROSOFT_CLIENT_SECRET
  ) {
    throw new Error(
      "Microsoft sign-in is enabled but required environment variables are missing"
    );
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );

  return Buffer.from(padded, "base64").toString("utf8");
}

function parseJsonSegment<T>(segment: string): T {
  return JSON.parse(decodeBase64Url(segment)) as T;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Microsoft auth request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function getOpenIdConfiguration() {
  assertMicrosoftAuthEnabled();

  if (
    configurationCache &&
    configurationCache.expiresAt > Date.now()
  ) {
    return configurationCache.value;
  }

  const configuration = await fetchJson<MicrosoftOpenIdConfiguration>(
    `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/v2.0/.well-known/openid-configuration`
  );

  configurationCache = {
    value: configuration,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return configuration;
}

async function getSigningKeys() {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.value;
  }

  const configuration = await getOpenIdConfiguration();
  const jwks = await fetchJson<MicrosoftJwksResponse>(configuration.jwks_uri);

  jwksCache = {
    value: jwks.keys,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return jwks.keys;
}

function verifyJwtSignature(token: string, jwk: MicrosoftJwk) {
  const [headerSegment, payloadSegment, signatureSegment] = token.split(".");

  if (!headerSegment || !payloadSegment || !signatureSegment) {
    throw new Error("Microsoft ID token is malformed");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerSegment}.${payloadSegment}`);
  verifier.end();

  const publicKey = createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: "jwk",
  });

  const isValid = verifier.verify(
    publicKey,
    Buffer.from(signatureSegment.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  );

  if (!isValid) {
    throw new Error("Microsoft ID token signature validation failed");
  }
}

function getUserEmail(claims: IdTokenClaims) {
  return claims.preferred_username ?? claims.email ?? claims.upn ?? null;
}

export async function exchangeMicrosoftCodeForProfile(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  assertMicrosoftAuthEnabled();

  const configuration = await getOpenIdConfiguration();
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID!,
    client_secret: env.MICROSOFT_CLIENT_SECRET!,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: input.redirectUri,
    scope: "openid profile email",
  });

  const tokenResponse = await fetchJson<MicrosoftTokenResponse>(
    configuration.token_endpoint,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );

  if (!tokenResponse.id_token) {
    throw new Error(
      tokenResponse.error_description ||
        tokenResponse.error ||
        "Microsoft sign-in did not return an ID token"
    );
  }

  const [headerSegment, payloadSegment] = tokenResponse.id_token.split(".");

  if (!headerSegment || !payloadSegment) {
    throw new Error("Microsoft ID token is malformed");
  }

  const header = parseJsonSegment<IdTokenHeader>(headerSegment);
  const claims = parseJsonSegment<IdTokenClaims>(payloadSegment);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Microsoft ID token uses an unsupported signing algorithm");
  }

  const signingKeys = await getSigningKeys();
  const signingKey = signingKeys.find((key) => key.kid === header.kid);

  if (!signingKey) {
    jwksCache = null;
    const refreshedKeys = await getSigningKeys();
    const refreshedSigningKey = refreshedKeys.find(
      (key) => key.kid === header.kid
    );

    if (!refreshedSigningKey) {
      throw new Error("Unable to find a signing key for the Microsoft ID token");
    }

    verifyJwtSignature(tokenResponse.id_token, refreshedSigningKey);
  } else {
    verifyJwtSignature(tokenResponse.id_token, signingKey);
  }

  const now = Math.floor(Date.now() / 1000);

  if (claims.aud !== env.MICROSOFT_CLIENT_ID) {
    throw new Error("Microsoft ID token audience is invalid");
  }

  if (claims.iss !== configuration.issuer) {
    throw new Error("Microsoft ID token issuer is invalid");
  }

  if (!claims.exp || claims.exp <= now) {
    throw new Error("Microsoft ID token has expired");
  }

  if (claims.nbf && claims.nbf > now + 60) {
    throw new Error("Microsoft ID token is not yet valid");
  }

  const email = getUserEmail(claims)?.trim().toLowerCase();

  if (!email) {
    throw new Error("Microsoft sign-in did not return a company email address");
  }

  if (
    env.MICROSOFT_ALLOWED_EMAIL_DOMAIN &&
    !email.endsWith(`@${env.MICROSOFT_ALLOWED_EMAIL_DOMAIN.toLowerCase()}`)
  ) {
    throw new Error("Microsoft sign-in is restricted to approved company emails");
  }

  return {
    email,
    name: claims.name?.trim() || email,
  } satisfies MicrosoftUserProfile;
}
