import { Navigate } from "react-router-dom";

/** Sales live under Rent / Sell — keep this route for bookmarks. */
export default function SalesPage() {
  return <Navigate to="/rentals?tab=sales" replace />;
}
