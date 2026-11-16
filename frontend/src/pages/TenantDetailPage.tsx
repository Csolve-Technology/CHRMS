import { Navigate, useParams } from "react-router-dom";

/** Legacy route — unified housing record. */
export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/housing/tenant/${id}`} replace />;
}
