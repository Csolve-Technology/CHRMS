export const SECURITY_DEPOSIT_METHOD = "security_deposit";

export type MonthRentStatus =
  | "not_due"
  | "unpaid"
  | "partial"
  | "paid"
  | "overdue";

export function formatPaymentMethod(method: string): string {
  switch (method) {
    case SECURITY_DEPOSIT_METHOD:
      return "Security deposit";
    case "cash":
      return "Cash";
    case "bank":
      return "Bank transfer";
    case "mobile":
      return "Mobile money";
    case "other":
      return "Other";
    default:
      return method;
  }
}

export function formatMonthRentStatus(status: string | null | undefined): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "unpaid":
      return "Unpaid";
    case "overdue":
      return "Overdue";
    case "not_due":
      return "Not due yet";
    default:
      return "—";
  }
}

export function rentalStatusHelp(status: string): string {
  switch (status) {
    case "active":
      return "Lease ongoing — rent payments and due reminders apply; property is rented.";
    case "completed":
      return "Lease finished on its scheduled end date.";
    case "expired":
      return "Lease reached its end date without renewal. Property is available; tenant history is kept.";
    case "cancelled":
      return "Lease ended early (terminated). Property is freed; payments and history stay on record.";
    default:
      return "";
  }
}
