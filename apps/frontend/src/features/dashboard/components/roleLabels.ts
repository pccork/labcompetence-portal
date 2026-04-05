import { CurrentUser } from "../../auth/api";
import { UserSummary } from "../api";

export function getAccountScopeLabel(
  user: Pick<CurrentUser, "role" | "is_global_admin">
) {
  if (user.role !== "admin") {
    return "Standard access";
  }

  return user.is_global_admin
    ? "Global admin"
    : "Local admin / Training coordinator";
}

export function getRoleDisplayLabel(
  user: Pick<UserSummary, "role" | "is_global_admin">
) {
  if (user.role === "admin") {
    return user.is_global_admin
      ? "Global admin"
      : "Local admin / Training coordinator";
  }

  if (user.role === "trainer") {
    return "Trainer";
  }

  return "Staff";
}
