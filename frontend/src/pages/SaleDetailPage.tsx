import { Navigate, useParams } from "react-router-dom";

/** Legacy route — unified housing record. */
export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/housing/sale/${id}`} replace />;
}