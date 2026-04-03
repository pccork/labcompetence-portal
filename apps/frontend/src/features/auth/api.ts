import { apiRequest } from "../../shared/api/client";

export interface CurrentUser {
  id: number;
  hospital_id: number;
  hospital_name: string;
  name: string;
  email: string;
  role: string;
  staff_type: string;
  created_at: string;
}

export async function loginUser(email: string, password: string) {
  return apiRequest<{ token: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentUser(token: string) {
  return apiRequest<{ user: CurrentUser }>("/me", {}, token);
}
