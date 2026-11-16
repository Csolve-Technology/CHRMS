import { PaymentProgressBar } from "@/components/chrms/PaymentProgressBar";
import { PaymentSummaryCard } from "@/components/chrms/PaymentSummaryCard";
import { StatusBadge } from "@/components/chrms/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { propertyLabel } from "@/lib/property-label";
import { estimateRentCoverage } from "@/lib/rent-coverage";
import {
  formatMonthRentStatus,
  type MonthRentStatus,
} from "@/lib/rental-labels";
import { api, getApiErrorMessage } from "@/services/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  downloadUploadedFile,
  viewUploadedFile,
} from "@/services/file-download";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Home,
  MapPin,
  Paperclip,
  Plus,
  UserRound,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

type EntityType = "property" | "tenant" | "rental" | "sale";

type PropertyBundle = {
  property: {
    id: string;
    type: string;
    category: string | null;
    woreda: string;
    kebele: string;
    houseNumber: string;
    rooms: number | null;
    area: number;
    status: string;
    latitude: number | null;
    longitude: number | null;
  };
  tenant: null | {
    id: string;
    fullName: string;
    phone: string;
    nationalId?: string | null;
    address?: string | null;
    rental: {
      id: string;
      agreementNumber?: string | null;
      agreementFile?: string | null;
      monthlyRent: number;
      deposit: number | null;
      status: string;
      startDate: string;
      endDate?: string | null;
    };
  };
  sale: null | {
    id: string;
    totalPrice: number;
    totalPaid: number;
    remaining: number;
    completionPercentage: number;
    isCompleted: boolean;
    buyer: { id: string; fullName: string; phone: string };
    downPayment: number;
    durationMonths: number;
    startDate: string;
    status: string;
  };
  paymentSummary: {
    context: "rental" | "sale" | null;
    total: number;
    paid: number;
    remaining: number;
    completionPercentage: number;
  };
  documents?: Array<{
    id: string;
    title: string;
    filePath: string;
    fileName?: string | null;
    createdAt: string;
  }>;
};

type TenantDetail = {
  id: string;
  fullName: string;
  gender: string;
  phone: string;
  nationalId: string | null;
  address: string | null;
  familySize: number;
  status: string;
  rentals: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string | null;
    monthlyRent: unknown;
    agreementNumber?: string;
    property: {
      id: string;
      houseNumber: string;
      woreda: string;
      kebele: string;
    };
  }>;
  purchases: Array<{
    id: string;
    status: string;
    totalPrice: unknown;
    startDate: string;
    property: { id: string; houseNumber: string };
  }>;
};

type PeriodMonth = {
  year: number;
  month: number;
  label: string;
  dueDate: string;
  expected: number;
  paid: number;
  balance: number;
  status: "paid" | "partial" | "unpaid" | "overdue" | "upcoming";
};

type RentalDetail = {
  id: string;
  status: string;
  agreementNumber?: string | null;
  agreementFile?: string | null;
  startDate: string;
  endDate: string | null;
  monthlyRent: number;
  deposit: number | string | null;
  overdue: boolean;
  paymentStatus?: MonthRentStatus | null;
  balanceDue?: number | null;
  period?: {
    totalExpected: number;
    totalPaid: number;
    outstandingBalance: number;
    monthsExpected: number;
    monthsPaid: number;
    monthsUnpaid: number;
    monthsOverdue: number;
    months: PeriodMonth[];
  };
  tenant: {
    id: string;
    fullName: string;
    phone: string;
    nationalId?: string | null;
    address?: string | null;
  };
  property: {
    id: string;
    type?: string;
    category?: string | null;
    woreda: string;
    kebele: string;
    houseNumber: string;
  };
  payments: Array<{
    id: string;
    amount: string | number;
    paidAt: string;
    method: string;
    receiptNo?: string | null;
    receiptFile?: string | null;
    kind?: "rent" | "deposit";
    coverageLabel?: string | null;
    monthsCovered?: Array<{
      label: string;
      amountApplied: number;
      statusAfter: string;
    }>;
  }>;
};

type SaleDetail = {
  id: string;
  status: string;
  startDate: string;
  durationMonths: number;
  downPayment: number;
  totalPrice: number;
  totalPaid: number;
  remaining: number;
  outstandingBalance: number;
  completionPercentage: number;
  isCompleted: boolean;
  installmentsPaid?: number;
  property: {
    id: string;
    woreda: string;
    kebele: string;
    houseNumber: string;
  };
  buyer: { id: string; fullName: string; phone?: string };
  payments: Array<{
    id: string;
    amount: string | number;
    paidAt: string;
    method: string;
  }>;
};

function etb(n: number) {
  return `ETB ${n.toLocaleString()}`;
}

function MonthStatusBadge({ status }: { status: PeriodMonth["status"] }) {
  if (status === "paid")
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 font-normal">
        Paid
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 font-normal">
        Partial
      </Badge>
    );
  if (status === "overdue")
    return (
      <Badge variant="destructive" className="gap-1 font-normal">
        <AlertTriangle className="h-3 w-3" />
        Overdue
      </Badge>
    );
  if (status === "upcoming")
    return (
      <Badge variant="outline" className="font-normal">
        Upcoming
      </Badge>
    );
  return (
    <Badge variant="secondary" className="font-normal">
      Unpaid
    </Badge>
  );
}

export default function HousingDetailPage() {
  const { hasPermission } = useAuth();
  const { type, id } = useParams<{ type: EntityType; id: string }>();
  const qc = useQueryClient();
  const entityType = (type ?? "property") as EntityType;

  const [rentPayOpen, setRentPayOpen] = useState(false);
  const [salePayOpen, setSalePayOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [rentPay, setRentPay] = useState({
    amount: "",
    paidAt: format(new Date(), "yyyy-MM-dd"),
    method: "cash",
    receiptFile: null as File | null,
  });
  const [salePay, setSalePay] = useState({
    amount: "",
    paidAt: format(new Date(), "yyyy-MM-dd"),
    method: "cash",
  });

  const propertyQuery = useQuery({
    queryKey: ["housing", "property", id],
    enabled: !!id && entityType === "property",
    queryFn: async () => (await api.get<PropertyBundle>(`/properties/${id}`)).data,
  });

  const tenantQuery = useQuery({
    queryKey: ["housing", "tenant", id],
    enabled: !!id && entityType === "tenant",
    queryFn: async () => (await api.get<TenantDetail>(`/tenants/${id}`)).data,
  });

  const rentalQuery = useQuery({
    queryKey: ["housing", "rental", id],
    enabled: !!id && entityType === "rental",
    queryFn: async () => (await api.get<RentalDetail>(`/rentals/${id}`)).data,
  });

  const saleQuery = useQuery({
    queryKey: ["housing", "sale", id],
    enabled: !!id && entityType === "sale",
    queryFn: async () => (await api.get<SaleDetail>(`/sales/${id}`)).data,
  });

  const linkedPropertyId = useMemo(() => {
    if (entityType === "property") return id;
    if (entityType === "rental") return rentalQuery.data?.property.id;
    if (entityType === "sale") return saleQuery.data?.property.id;
    if (entityType === "tenant") {
      const active = tenantQuery.data?.rentals.find((r) => r.status === "active");
      return active?.property.id ?? tenantQuery.data?.purchases[0]?.property.id;
    }
    return undefined;
  }, [entityType, id, rentalQuery.data, saleQuery.data, tenantQuery.data]);

  const linkedRentalId = useMemo(() => {
    if (entityType === "rental") return id;
    if (entityType === "property") return propertyQuery.data?.tenant?.rental.id;
    if (entityType === "tenant") {
      return tenantQuery.data?.rentals.find((r) => r.status === "active")?.id;
    }
    return undefined;
  }, [entityType, id, propertyQuery.data, tenantQuery.data]);

  const linkedSaleId = useMemo(() => {
    if (entityType === "sale") return id;
    if (entityType === "property") return propertyQuery.data?.sale?.id;
    if (entityType === "tenant") return tenantQuery.data?.purchases[0]?.id;
    return undefined;
  }, [entityType, id, propertyQuery.data, tenantQuery.data]);

  const hubPropertyQuery = useQuery({
    queryKey: ["housing", "property-hub", linkedPropertyId],
    enabled:
      !!linkedPropertyId &&
      entityType !== "property" &&
      (entityType === "tenant" || entityType === "rental" || entityType === "sale"),
    queryFn: async () =>
      (await api.get<PropertyBundle>(`/properties/${linkedPropertyId}`)).data,
  });

  const hubRentalQuery = useQuery({
    queryKey: ["housing", "rental-hub", linkedRentalId],
    enabled: !!linkedRentalId && entityType !== "rental",
    queryFn: async () =>
      (await api.get<RentalDetail>(`/rentals/${linkedRentalId}`)).data,
  });

  const hubSaleQuery = useQuery({
    queryKey: ["housing", "sale-hub", linkedSaleId],
    enabled: !!linkedSaleId && entityType !== "sale",
    queryFn: async () =>
      (await api.get<SaleDetail>(`/sales/${linkedSaleId}`)).data,
  });

  const propertyBundle =
    entityType === "property" ? propertyQuery.data : hubPropertyQuery.data;
  const rental =
    entityType === "rental" ? rentalQuery.data : hubRentalQuery.data;
  const sale = entityType === "sale" ? saleQuery.data : hubSaleQuery.data;
  const tenantOnly = entityType === "tenant" ? tenantQuery.data : null;

  const loading =
    (entityType === "property" && propertyQuery.isLoading) ||
    (entityType === "tenant" && tenantQuery.isLoading) ||
    (entityType === "rental" && rentalQuery.isLoading) ||
    (entityType === "sale" && saleQuery.isLoading);

  const error =
    propertyQuery.error ||
    tenantQuery.error ||
    rentalQuery.error ||
    saleQuery.error;

  const backHref =
    entityType === "tenant"
      ? "/tenants"
      : entityType === "rental"
        ? "/rentals"
        : entityType === "sale"
          ? "/rentals?tab=sales"
          : "/properties";

  const title =
    propertyBundle?.property != null
      ? propertyLabel(propertyBundle.property)
      : rental
        ? propertyLabel(rental.property)
        : sale
          ? propertyLabel(sale.property)
          : tenantOnly?.fullName ?? "Housing record";

  const createRentPay = useMutation({
    mutationFn: async () => {
      if (!rental) throw new Error("No rental");
      const fd = new FormData();
      fd.append("rentalId", rental.id);
      fd.append("amount", String(Number(rentPay.amount)));
      fd.append("paidAt", new Date(rentPay.paidAt).toISOString());
      fd.append("method", rentPay.method);
      if (rentPay.receiptFile) fd.append("receiptFile", rentPay.receiptFile);
      const res = await api.post<{ coverageLabel?: string }>(
        "/rental-payments",
        fd,
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Payment recorded",
        description: data.coverageLabel ?? undefined,
      });
      setRentPayOpen(false);
      setRentPay({
        amount: "",
        paidAt: format(new Date(), "yyyy-MM-dd"),
        method: "cash",
        receiptFile: null,
      });
      qc.invalidateQueries({ queryKey: ["housing"] });
      qc.invalidateQueries({ queryKey: ["rental-payments"] });
      qc.invalidateQueries({ queryKey: ["rentals"] });
    },
    onError: (err) =>
      toast({
        title: "Could not record payment",
        description: getApiErrorMessage(err),
        variant: "destructive",
      }),
  });

  const createSalePay = useMutation({
    mutationFn: async () => {
      if (!sale) throw new Error("No sale");
      await api.post("/sale-payments", {
        saleId: sale.id,
        amount: Number(salePay.amount),
        paidAt: salePay.paidAt,
        method: salePay.method,
      });
    },
    onSuccess: () => {
      toast({ title: "Payment recorded" });
      setSalePayOpen(false);
      qc.invalidateQueries({ queryKey: ["housing"] });
    },
    onError: (err) =>
      toast({
        title: "Payment failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      }),
  });

  const uploadDocument = useMutation({
    mutationFn: async () => {
      const propertyId =
        (entityType === "property" ? id : undefined) ?? linkedPropertyId;
      if (!propertyId) throw new Error("No property");
      if (!docFile) throw new Error("Choose a file");
      if (!docTitle.trim()) throw new Error("Title is required");
      const fd = new FormData();
      fd.append("title", docTitle.trim());
      fd.append("file", docFile);
      await api.post(`/properties/${propertyId}/documents`, fd);
    },
    onSuccess: () => {
      toast({ title: "Document attached" });
      setDocOpen(false);
      setDocTitle("");
      setDocFile(null);
      qc.invalidateQueries({ queryKey: ["housing"] });
    },
    onError: (err) =>
      toast({
        title: "Upload failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      }),
  });

  if (loading) {
    return <p className="text-muted-foreground">Loading housing record…</p>;
  }
  if (error) {
    return (
      <p className="text-destructive" role="alert">
        {getApiErrorMessage(error)}
      </p>
    );
  }

  const property = propertyBundle?.property;
  const occupant =
    propertyBundle?.tenant ??
    (rental
      ? {
          id: rental.tenant.id,
          fullName: rental.tenant.fullName,
          phone: rental.tenant.phone,
          nationalId: rental.tenant.nationalId,
          address: rental.tenant.address,
          rental: {
            id: rental.id,
            agreementNumber: rental.agreementNumber,
            agreementFile: rental.agreementFile,
            monthlyRent: rental.monthlyRent,
            deposit:
              rental.deposit == null ? null : Number(rental.deposit),
            status: rental.status,
            startDate: rental.startDate,
            endDate: rental.endDate,
          },
        }
      : null);
  const buyer =
    propertyBundle?.sale?.buyer ??
    (sale
      ? {
          id: sale.buyer.id,
          fullName: sale.buyer.fullName,
          phone: sale.buyer.phone ?? "",
        }
      : tenantOnly && !occupant
        ? {
            id: tenantOnly.id,
            fullName: tenantOnly.fullName,
            phone: tenantOnly.phone,
          }
        : null);

  const mapsUrl =
    property?.latitude != null && property?.longitude != null
      ? `https://www.google.com/maps?q=${property.latitude},${property.longitude}`
      : null;

  const partyName =
    occupant?.fullName ??
    propertyBundle?.sale?.buyer.fullName ??
    sale?.buyer.fullName ??
    (entityType === "tenant" ? tenantOnly?.fullName : undefined);
  const partyRole = occupant
    ? "Tenant"
    : propertyBundle?.sale || sale
      ? "Buyer"
      : entityType === "tenant"
        ? "Tenant"
        : null;

  const agreementFile =
    rental?.agreementFile ??
    propertyBundle?.tenant?.rental.agreementFile ??
    null;
  const agreementNumber =
    rental?.agreementNumber ??
    propertyBundle?.tenant?.rental.agreementNumber ??
    null;
  const propertyDocuments = propertyBundle?.documents ?? [];
  const canAttachDocument =
    !!property?.id && hasPermission("properties.write");

  const downloadFile = async (path: string, name?: string | null) => {
    try {
      await downloadUploadedFile(path, name ?? undefined);
    } catch (err) {
      toast({
        title: "Download failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const viewFile = async (path: string) => {
    // Open the tab during the click gesture so the browser allows it.
    const previewTab = window.open("about:blank", "_blank");
    try {
      await viewUploadedFile(path, previewTab);
    } catch (err) {
      previewTab?.close();
      toast({
        title: "Could not open file",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="relative space-y-4 p-5 sm:p-7">
          <Button variant="ghost" size="sm" className="-ml-2" asChild>
            <Link to={backHref}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-3xl font-bold tracking-tight">
                  {property ? propertyLabel(property) : title}
                </h1>
                {partyName ? (
                  <>
                    <span className="hidden text-muted-foreground sm:inline">
                      ·
                    </span>
                    <div className="flex items-center gap-2 text-lg text-foreground/90">
                      <UserRound className="h-5 w-5 text-primary" />
                      <span className="font-semibold">{partyName}</span>
                      {partyRole ? (
                        <Badge variant="secondary" className="font-normal">
                          {partyRole}
                        </Badge>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {property ? <StatusBadge status={property.status} /> : null}
                {rental ? (
                  <Badge variant="outline" className="capitalize">
                    Rental · {rental.status}
                  </Badge>
                ) : null}
                {sale ? (
                  <Badge variant="outline" className="capitalize">
                    Sale · {sale.status}
                  </Badge>
                ) : null}
                {property ? (
                  <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {property.woreda}, Kebele {property.kebele}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Home className="h-4 w-4 text-primary" />
              Property details
            </CardTitle>
            <CardDescription>Registered house information</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {property ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="House number">
                  {propertyLabel(property)}
                </DetailField>
                <DetailField label="Status">
                  <StatusBadge status={property.status} />
                </DetailField>
                <DetailField label="Type">
                  <span className="capitalize">{property.type}</span>
                </DetailField>
                <DetailField label="Category">
                  <span className="capitalize">{property.category ?? "—"}</span>
                </DetailField>
                <DetailField label="City">{property.woreda}</DetailField>
                <DetailField label="Kebele">{property.kebele}</DetailField>
                <DetailField label="Area">{property.area} m²</DetailField>
                {property.type === "residential" ? (
                  <DetailField label="Rooms">
                    {property.rooms ?? "—"}
                  </DetailField>
                ) : null}
                <DetailField label="GPS">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {property.latitude != null && property.longitude != null
                      ? `${property.latitude}, ${property.longitude}`
                      : "—"}
                    {mapsUrl ? (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-primary hover:underline"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Maps
                      </a>
                    ) : null}
                  </span>
                </DetailField>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No linked property for this record.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="h-4 w-4 text-primary" />
              {occupant ? "Tenant" : sale || propertyBundle?.sale ? "Buyer" : "Tenant / Buyer"}
            </CardTitle>
            <CardDescription>
              {occupant
                ? "Current occupant on the active rental"
                : sale || propertyBundle?.sale
                  ? "Buyer on the sale agreement"
                  : "Person linked to this housing record"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {occupant ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Full name">{occupant.fullName}</DetailField>
                <DetailField label="Phone">{occupant.phone}</DetailField>
                <DetailField label="National ID">
                  {occupant.nationalId ?? "—"}
                </DetailField>
                <DetailField label="Address">
                  {occupant.address ?? "—"}
                </DetailField>
              </dl>
            ) : sale || propertyBundle?.sale ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Full name">
                  {(propertyBundle?.sale?.buyer ?? sale?.buyer)?.fullName}
                </DetailField>
                <DetailField label="Phone">
                  {(propertyBundle?.sale?.buyer ?? sale?.buyer)?.phone || "—"}
                </DetailField>
              </dl>
            ) : tenantOnly ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Full name">{tenantOnly.fullName}</DetailField>
                <DetailField label="Phone">{tenantOnly.phone}</DetailField>
                <DetailField label="Gender">
                  <span className="capitalize">{tenantOnly.gender}</span>
                </DetailField>
                <DetailField label="Family size">
                  {tenantOnly.familySize}
                </DetailField>
                <DetailField label="National ID">
                  {tenantOnly.nationalId ?? "—"}
                </DetailField>
                <DetailField label="Status">
                  <StatusBadge status={tenantOnly.status} />
                </DetailField>
                <div className="sm:col-span-2">
                  <DetailField label="Address">
                    {tenantOnly.address ?? "—"}
                  </DetailField>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tenant or buyer is linked yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Agreement
            </CardTitle>
            <CardDescription>
              Rent or sale terms linked to this house
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {rental ? (
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailField label="Agreement no.">
                  {rental.agreementNumber ?? "—"}
                </DetailField>
                <DetailField label="Monthly rent">
                  {etb(rental.monthlyRent)}
                </DetailField>
                <DetailField label="Status">
                  <StatusBadge status={rental.status} />
                </DetailField>
                <DetailField label="Start">
                  {format(new Date(rental.startDate), "MMM d, yyyy")}
                </DetailField>
                <DetailField label="End">
                  {rental.endDate
                    ? format(new Date(rental.endDate), "MMM d, yyyy")
                    : "Open"}
                </DetailField>
                {rental.paymentStatus ? (
                  <div className="sm:col-span-2">
                    <DetailField label="This month">
                      {formatMonthRentStatus(rental.paymentStatus)}
                      {rental.balanceDue != null && rental.balanceDue > 0
                        ? ` · ${etb(rental.balanceDue)} due`
                        : ""}
                    </DetailField>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {sale ? (
              <div className="space-y-4">
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailField label="Total price">
                    {etb(sale.totalPrice)}
                  </DetailField>
                  <DetailField label="Down payment">
                    {etb(sale.downPayment)}
                  </DetailField>
                  <DetailField label="Duration">
                    {sale.durationMonths} months
                  </DetailField>
                  <DetailField label="Outstanding">
                    {etb(sale.outstandingBalance ?? sale.remaining)}
                  </DetailField>
                  <DetailField label="Start">
                    {format(new Date(sale.startDate), "MMM d, yyyy")}
                  </DetailField>
                  <DetailField label="Status">
                    <StatusBadge status={sale.status} />
                  </DetailField>
                </dl>
                <PaymentSummaryCard
                  title="Sale progress"
                  description={`Buyer: ${sale.buyer.fullName}`}
                  total={sale.totalPrice}
                  paid={sale.totalPaid}
                  remaining={sale.remaining}
                  completionPercentage={sale.completionPercentage}
                />
              </div>
            ) : null}

            {tenantOnly &&
            (tenantOnly.rentals.length > 0 || tenantOnly.purchases.length > 0) &&
            !rental &&
            !sale ? (
              <div className="space-y-3">
                {tenantOnly.rentals.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 p-3"
                  >
                    <div>
                      <Link
                        to={`/housing/rental/${r.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Rental · {propertyLabel(r.property)}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {etb(Number(r.monthlyRent))} ·{" "}
                        {format(new Date(r.startDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
                {tenantOnly.purchases.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/20 p-3"
                  >
                    <div>
                      <Link
                        to={`/housing/sale/${s.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Sale · {propertyLabel(s.property)}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {etb(Number(s.totalPrice))} ·{" "}
                        {format(new Date(s.startDate), "MMM d, yyyy")}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            ) : null}

            {!rental &&
            !sale &&
            !(
              tenantOnly &&
              (tenantOnly.rentals.length > 0 || tenantOnly.purchases.length > 0)
            ) ? (
              <p className="text-sm text-muted-foreground">
                No rent or sale agreement is linked yet.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Documents
                </CardTitle>
                <CardDescription>
                  Rental agreement and other attached files for this house
                </CardDescription>
              </div>
              {canAttachDocument ? (
                <Dialog open={docOpen} onOpenChange={setDocOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Attach document
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Attach document</DialogTitle>
                    </DialogHeader>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        uploadDocument.mutate();
                      }}
                    >
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                          placeholder="e.g. Ownership certificate"
                          required
                        />
                      </div>
                      <div>
                        <Label>File</Label>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          onChange={(e) =>
                            setDocFile(e.target.files?.[0] ?? null)
                          }
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={uploadDocument.isPending}
                      >
                        Upload
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {agreementFile ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">Rental agreement</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {agreementNumber
                        ? `${agreementNumber} · Attached file`
                        : "Attached agreement file"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => viewFile(agreementFile)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(agreementFile)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : null}

            {propertyDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Paperclip className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{doc.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {doc.fileName ?? "Attached file"}
                      {" · "}
                      {format(new Date(doc.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => viewFile(doc.filePath)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadFile(doc.filePath, doc.fileName)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ))}

            {!agreementFile && propertyDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents attached yet. Use Attach document to upload files
                for this property.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm lg:col-span-2">
          <CardHeader className="border-b bg-muted/30 pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Banknote className="h-4 w-4 text-primary" />
                  Payments & activity
                </CardTitle>
                <CardDescription>
                  {rental
                    ? `Expected ${etb(rental.period?.totalExpected ?? 0)} · Received ${etb(rental.period?.totalPaid ?? 0)}`
                    : sale
                      ? `${sale.completionPercentage.toFixed(1)}% of sale price received`
                      : "Payment history for linked agreements"}
                </CardDescription>
              </div>
              {rental && hasPermission("rental_payments.write") ? (
                <Dialog open={rentPayOpen} onOpenChange={setRentPayOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Record payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record rental payment</DialogTitle>
                    </DialogHeader>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        createRentPay.mutate();
                      }}
                    >
                      <div>
                        <Label>Amount (ETB)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={rentPay.amount}
                          onChange={(e) =>
                            setRentPay((f) => ({
                              ...f,
                              amount: e.target.value,
                            }))
                          }
                          required
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Monthly rent {etb(rental?.monthlyRent ?? 0)}
                          {rental?.period?.outstandingBalance != null
                            ? ` · Outstanding ${etb(rental.period.outstandingBalance)}`
                            : ""}
                          . You can pay multiple months at once.
                        </p>
                        {estimateRentCoverage(
                          Number(rentPay.amount),
                          Number(rental?.monthlyRent ?? 0),
                          rental?.period?.outstandingBalance,
                        ) ? (
                          <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {estimateRentCoverage(
                              Number(rentPay.amount),
                              Number(rental?.monthlyRent ?? 0),
                              rental?.period?.outstandingBalance,
                            )}
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <Label>Paid at</Label>
                        <Input
                          type="date"
                          value={rentPay.paidAt}
                          onChange={(e) =>
                            setRentPay((f) => ({
                              ...f,
                              paidAt: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Method</Label>
                        <Select
                          value={rentPay.method}
                          onValueChange={(v) =>
                            setRentPay((f) => ({ ...f, method: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank">Bank</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Receipt (optional)</Label>
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                          onChange={(e) =>
                            setRentPay((f) => ({
                              ...f,
                              receiptFile: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createRentPay.isPending}
                      >
                        Save payment
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
              {sale && hasPermission("sale_payments.write") ? (
                <Dialog open={salePayOpen} onOpenChange={setSalePayOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-1 h-4 w-4" />
                      Record payment
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Record sale payment</DialogTitle>
                    </DialogHeader>
                    <form
                      className="space-y-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        createSalePay.mutate();
                      }}
                    >
                      <div>
                        <Label>Amount</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={salePay.amount}
                          onChange={(e) =>
                            setSalePay((f) => ({
                              ...f,
                              amount: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Paid at</Label>
                        <Input
                          type="date"
                          value={salePay.paidAt}
                          onChange={(e) =>
                            setSalePay((f) => ({
                              ...f,
                              paidAt: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label>Method</Label>
                        <Select
                          value={salePay.method}
                          onValueChange={(v) =>
                            setSalePay((f) => ({ ...f, method: v }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="bank">Bank</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createSalePay.isPending}
                      >
                        Save payment
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {sale && !rental ? (
              <PaymentProgressBar value={sale.completionPercentage} />
            ) : null}

            {rental?.period?.months?.length ? (
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Month</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rental.period.months.map((m) => (
                      <TableRow key={`${m.year}-${m.month}`}>
                        <TableCell>{m.label}</TableCell>
                        <TableCell>{etb(m.expected)}</TableCell>
                        <TableCell>{etb(m.paid)}</TableCell>
                        <TableCell>
                          <MonthStatusBadge status={m.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {rental ? (
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Covers</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rental.payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No payments yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      rental.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            {format(new Date(p.paidAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{etb(Number(p.amount))}</TableCell>
                          <TableCell className="text-sm max-w-[220px]">
                            {p.coverageLabel ?? "—"}
                          </TableCell>
                          <TableCell className="capitalize">{p.method}</TableCell>
                          <TableCell>
                            {p.receiptFile ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(p.receiptFile!)}
                              >
                                <Download className="mr-1 h-3.5 w-3.5" />
                                View
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {sale ? (
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No payments yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      sale.payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            {format(new Date(p.paidAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{etb(Number(p.amount))}</TableCell>
                          <TableCell className="capitalize">{p.method}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {!rental && !sale ? (
              <p className="text-sm text-muted-foreground">
                Payment activity appears after a rent or sale agreement is
                created.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
