import { CurrentUser } from "../../auth/api";

export function requiresManagementConfirmation(user: CurrentUser) {
  return user.role === "admin" || user.staff_type === "training_coordinator";
}

export function confirmManagedAction(
  user: CurrentUser,
  message: string,
  secondMessage = "Please confirm again to continue."
) {
  if (!requiresManagementConfirmation(user)) {
    return true;
  }

  if (!window.confirm(message)) {
    return false;
  }

  return window.confirm(secondMessage);
}
