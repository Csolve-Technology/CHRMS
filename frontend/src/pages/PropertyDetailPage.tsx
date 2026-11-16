import { Navigate, useParams } from "react-router-dom";

/** Legacy route — unified housing record. */
export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/housing/property/${id}`} replace />;
}
