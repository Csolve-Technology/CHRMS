import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

/** Sales live under Rent / Sell — keep this route for bookmarks. */
export default function SalesPage() {
  const { hasPermission } = useAuth();
  return <Navigate to="/rentals?tab=sales" replace />;
}
