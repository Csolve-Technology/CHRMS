/** Client-side estimate of how many months an amount covers (FIFO hint). */
export function estimateRentCoverage(
  amount: number,
  monthlyRent: number,
  outstandingBalance?: number | null,
): string | null {
  if (!amount || amount <= 0 || !monthlyRent || monthlyRent <= 0) return null;
  const capped =
    outstandingBalance != null && outstandingBalance > 0
      ? Math.min(amount, outstandingBalance)
      : amount;
  const full = Math.floor(capped / monthlyRent + 1e-9);
  const partial = Math.round((capped - full * monthlyRent) * 100) / 100;
  if (full === 0 && partial > 0) {
    return `Partial month · ${partial.toLocaleString()} of ${monthlyRent.toLocaleString()} ETB`;
  }
  if (full > 0 && partial > 0) {
    return `Covers ${full} month${full === 1 ? "" : "s"} + partial (${partial.toLocaleString()} ETB)`;
  }
  if (full > 0) {
    return `Covers ${full} month${full === 1 ? "" : "s"}`;
  }
  return null;
}
