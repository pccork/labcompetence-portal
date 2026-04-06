import { apiRequest } from "../../shared/api/client";

export interface CurrentUser {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  email: string;
  role: string;
  staff_type: string;
  is_global_admin: boolean;
  created_at: string;
}

export interface AuthProvidersConfig {
  local: {
    enabled: boolean;
  };
  microsoft: {
    enabled: boolean;
    clientId: string | null;
    tenantId: string | null;
    allowedEmailDomain: string | null;
  };
}

export async function loginUser(email: string, password: string) {
  return apiRequest<{ token: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginWithMicrosoftCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
) {
  return apiRequest<{ token: string }>("/auth/microsoft/login", {
    method: "POST",
    body: JSON.stringify({ code, codeVerifier, redirectUri }),
  });
}

export async function fetchAuthProvidersConfig() {
  return apiRequest<AuthProvidersConfig>("/auth/providers");
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<{ user: CurrentUser }>("/me", {}, token);
}
