import { Navigate, useParams } from "react-router-dom";

/** Legacy route — unified housing record. */
export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/housing/rental/${id}`} replace />;
}
