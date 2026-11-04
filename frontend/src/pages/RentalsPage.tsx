import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/chrms/ConfirmActionDialog";
import { PaymentProgressBar } from "@/components/chrms/PaymentProgressBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, getApiErrorMessage } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import { TablePagination } from "@/components/chrms/TablePagination";
import { buildPageParams, Paginated } from "@/lib/pagination";
import {
  FileText,
  AlertTriangle,
  Trash2,
  Pencil,
  Plus,
  Eye,
  MoreHorizontal,
  Banknote,
  Home,
} from "lucide-react";
import { format } from "date-fns";
import {
  formatMonthRentStatus,
  rentalStatusHelp,
  type MonthRentStatus,
} from "@/lib/rental-labels";

type RentalRow = {
  id: string;
  status: string;
  agreementNumber?: string | null;
  agreementFile?: string | null;
  monthlyRent: number;
  deposit: number | null;
  overdue: boolean;
  paymentStatus?: MonthRentStatus | null;
  paidThisMonth?: number | null;
  balanceDue?: number | null;
  totalExpected?: number;
  totalPaid?: number;
  outstandingBalance?: number;
  monthsPaid?: number;
  monthsUnpaid?: number;
  monthsOverdue?: number;
  monthsExpected?: number;
  tenant: { id: string; fullName: string };
  property: { id: string; code: string | null };
  startDate: string;
  endDate?: string | null;
};

type SaleRow = {
  id: string;
  property: { id: string; code: string | null };
  buyer: { id: string; fullName: string };
  totalPrice: number;
  totalPaid: number;
  remaining: number;
  completionPercentage: number;
  status: string;
  startDate: string;
  durationMonths: number;
};

type TenantOption = { id: string; fullName: string; status: string };
type PropertyOption = { id: string; code: string | null; status: string };

const emptyRentForm = {
  propertyId: "",
  tenantId: "",
  startDate: "",
  endDate: "",
  monthlyRent: "",
  deposit: "",
  status: "active",
};

const emptySaleForm = {
  propertyId: "",
  buyerId: "",
  totalPrice: "",
  downPayment: "",
  durationMonths: "",
  startDate: "",
};

function RentPaymentBadge({
  leaseStatus,
  paymentStatus,
  balanceDue,
  monthsOverdue,
}: {
  leaseStatus: string;
  paymentStatus?: MonthRentStatus | null;
  balanceDue?: number | null;
  monthsOverdue?: number;
}) {
  if (leaseStatus !== "active") {
    return (
      <Badge variant="outline" className="capitalize font-normal">
        {leaseStatus}
      </Badge>
    );
  }
  if ((monthsOverdue ?? 0) > 0 || paymentStatus === "overdue") {
    return (
      <div className="space-y-0.5">
        <Badge variant="destructive" className="gap-1 font-normal">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </Badge>
        {(monthsOverdue ?? 0) > 0 ? (
          <p className="text-xs text-destructive">{monthsOverdue} mo.</p>
        ) : balanceDue != null && balanceDue > 0 ? (
          <p className="text-xs text-destructive">
            ETB {balanceDue.toLocaleString()}
          </p>
        ) : null}
      </div>
    );
  }
  switch (paymentStatus) {
    case "paid":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600 font-normal">
          Current
        </Badge>
      );
    case "partial":
      return (
        <div className="space-y-0.5">
          <Badge className="bg-amber-500 hover:bg-amber-500 font-normal">
            Partial
          </Badge>
          <p className="text-xs text-muted-foreground">
            ETB {(balanceDue ?? 0).toLocaleString()} due
          </p>
        </div>
      );
    case "unpaid":
      return (
        <Badge variant="secondary" className="font-normal">
          Unpaid
        </Badge>
      );
    case "not_due":
      return (
        <Badge variant="outline" className="font-normal">
          Not due yet
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="font-normal">
          {formatMonthRentStatus(paymentStatus)}
        </Badge>
      );
  }
}

function etb(n: number | undefined | null) {
  return `ETB ${Number(n ?? 0).toLocaleString()}`;
}

/** Inclusive calendar months from start through end (or start month only if open). */
function estimateLeaseMonths(startDate: string, endDate: string): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : start;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  return Math.max(1, months);
}

export default function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "sales" ? "sales" : "rentals";
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "sales") next.set("tab", "sales");
    else next.delete("tab");
    setSearchParams(next, { replace: true });
  };

  const [rentPage, setRentPage] = useState(1);
  const [salePage, setSalePage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RentalRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [txType, setTxType] = useState<"rent" | "sale">("rent");
  const [editing, setEditing] = useState<RentalRow | null>(null);
  const [rentForm, setRentForm] = useState(emptyRentForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);

  const rentParams = buildPageParams({ page: rentPage });
  const saleParams = buildPageParams({ page: salePage });

  const {
    data: rentData,
    isLoading: rentLoading,
    error: rentError,
    refetch: refetchRentals,
  } = useQuery({
    queryKey: ["rentals", rentParams],
    queryFn: async () => {
      const res = await api.get<Paginated<RentalRow>>(`/rentals?${rentParams}`);
      return res.data;
    },
  });

  const {
    data: saleData,
    isLoading: saleLoading,
    error: saleError,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ["sales", saleParams],
    queryFn: async () => {
      const res = await api.get<Paginated<SaleRow>>(`/sales?${saleParams}`);
      return res.data;
    },
  });

  const { data: tenantOptions } = useQuery({
    queryKey: ["tenants", "options"],
    queryFn: async () => {
      const res = await api.get<Paginated<TenantOption>>(
        "/tenants?page=1&pageSize=100",
      );
      return res.data.items;
    },
  });
  const { data: propertyOptions, refetch: refetchProperties } = useQuery({
    queryKey: ["properties", "options"],
    queryFn: async () => {
      const res = await api.get<Paginated<PropertyOption>>(
        "/properties?page=1&pageSize=100",
      );
      return res.data.items;
    },
  });

  const rows = rentData?.items ?? [];
  const sales = saleData?.items ?? [];
  const availableProperties = useMemo(
    () => (propertyOptions ?? []).filter((p) => p.status === "available"),
    [propertyOptions],
  );
  const activeTenants = useMemo(
    () => (tenantOptions ?? []).filter((t) => t.status === "active"),
    [tenantOptions],
  );

  const resetForms = () => {
    setRentForm(emptyRentForm);
    setSaleForm(emptySaleForm);
    setAgreementFile(null);
    setTxType(tab === "sales" ? "sale" : "rent");
  };

  const buildRentFormData = (includeIds: boolean) => {
    const fd = new FormData();
    if (includeIds) {
      fd.append("propertyId", rentForm.propertyId);
      fd.append("tenantId", rentForm.tenantId);
    }
    fd.append("startDate", rentForm.startDate);
    if (rentForm.endDate) fd.append("endDate", rentForm.endDate);
    fd.append("monthlyRent", rentForm.monthlyRent);
    if (rentForm.deposit) fd.append("deposit", rentForm.deposit);
    if (!includeIds) fd.append("status", rentForm.status);
    if (agreementFile) fd.append("agreementFile", agreementFile);
    return fd;
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (txType === "rent") {
        await api.post("/rentals", buildRentFormData(true));
        toast({ title: "Rental created" });
        setTab("rentals");
        refetchRentals();
      } else {
        await api.post("/sales", {
          propertyId: saleForm.propertyId,
          buyerId: saleForm.buyerId,
          totalPrice: Number(saleForm.totalPrice),
          downPayment: Number(saleForm.downPayment),
          durationMonths: Number(saleForm.durationMonths),
          startDate: saleForm.startDate,
        });
        toast({ title: "Sale created" });
        setTab("sales");
        refetchSales();
      }
      setCreating(false);
      resetForms();
      refetchProperties();
    } catch (err) {
      toast({
        title: txType === "rent" ? "Failed to create rental" : "Failed to create sale",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const startEdit = (r: RentalRow) => {
    setEditing(r);
    setAgreementFile(null);
    setRentForm({
      propertyId: r.property.id,
      tenantId: r.tenant.id,
      startDate: r.startDate.slice(0, 10),
      endDate: r.endDate ? r.endDate.slice(0, 10) : "",
      monthlyRent: String(r.monthlyRent),
      deposit: r.deposit ? String(r.deposit) : "",
      status: r.status,
    });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.put(`/rentals/${editing.id}`, buildRentFormData(false));
      toast({ title: "Rental updated" });
      setEditing(null);
      resetForms();
      refetchRentals();
    } catch (err) {
      toast({
        title: "Failed to update rental",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (rental: RentalRow) => {
    try {
      setDeletingId(rental.id);
      await api.delete(`/rentals/${rental.id}`);
      toast({ title: "Rental deleted" });
      refetchRentals();
      refetchProperties();
    } catch (err) {
      toast({
        title: "Failed to delete rental",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Home className="h-7 w-7 text-blue-600" />
            Rent / Sell
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage rental agreements and property sales from one place
          </p>
        </div>
        <Dialog
          open={creating}
          onOpenChange={(o) => {
            setCreating(o);
            if (o) {
              setTxType(tab === "sales" ? "sale" : "rent");
            } else {
              resetForms();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New rent or sale</DialogTitle>
              <DialogDescription>
                Choose the transaction type, then complete the matching fields.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitCreate} className="space-y-4">
              <div>
                <Label>Transaction type</Label>
                <Select
                  value={txType}
                  onValueChange={(v) => setTxType(v as "rent" | "sale")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rent">For rent</SelectItem>
                    <SelectItem value="sale">For sale</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {txType === "rent"
                    ? "Lease terms, tenants, monthly rent, and outstanding balances."
                    : "Buyer, selling price, installments, and sale progress."}
                </p>
              </div>

              {txType === "rent" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Property</Label>
                    <Select
                      value={rentForm.propertyId}
                      onValueChange={(v) =>
                        setRentForm((f) => ({ ...f, propertyId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProperties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code ?? p.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Tenant</Label>
                    <Select
                      value={rentForm.tenantId}
                      onValueChange={(v) =>
                        setRentForm((f) => ({ ...f, tenantId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Agreement number is generated automatically (e.g. RA-2026-0001).
                  </div>
                  <div className="col-span-2">
                    <Label>Agreement file</Label>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      onChange={(e) =>
                        setAgreementFile(e.target.files?.[0] ?? null)
                      }
                    />
                  </div>
                  <div>
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={rentForm.startDate}
                      onChange={(e) =>
                        setRentForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={rentForm.endDate}
                      onChange={(e) =>
                        setRentForm((f) => ({ ...f, endDate: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Monthly rent</Label>
                    <Input
                      type="number"
                      min={0}
                      value={rentForm.monthlyRent}
                      onChange={(e) =>
                        setRentForm((f) => ({
                          ...f,
                          monthlyRent: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Security deposit</Label>
                    <Input
                      type="number"
                      min={0}
                      max={rentForm.monthlyRent || undefined}
                      value={rentForm.deposit}
                      onChange={(e) =>
                        setRentForm((f) => ({ ...f, deposit: e.target.value }))
                      }
                    />
                  </div>
                  {rentForm.startDate && rentForm.monthlyRent ? (
                    <div className="col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <p className="font-medium">
                        Total expected rent:{" "}
                        {etb(
                          Number(rentForm.monthlyRent) *
                            estimateLeaseMonths(
                              rentForm.startDate,
                              rentForm.endDate,
                            ),
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {etb(Number(rentForm.monthlyRent))} ×{" "}
                        {estimateLeaseMonths(
                          rentForm.startDate,
                          rentForm.endDate,
                        )}{" "}
                        month
                        {estimateLeaseMonths(
                          rentForm.startDate,
                          rentForm.endDate,
                        ) === 1
                          ? ""
                          : "s"}
                        {rentForm.endDate
                          ? ""
                          : " (set an end date for the full contract total)"}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Property</Label>
                    <Select
                      value={saleForm.propertyId}
                      onValueChange={(v) =>
                        setSaleForm((f) => ({ ...f, propertyId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableProperties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.code ?? p.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Buyer</Label>
                    <Select
                      value={saleForm.buyerId}
                      onValueChange={(v) =>
                        setSaleForm((f) => ({ ...f, buyerId: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select buyer (tenant record)" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeTenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Total price</Label>
                    <Input
                      type="number"
                      min={0}
                      value={saleForm.totalPrice}
                      onChange={(e) =>
                        setSaleForm((f) => ({
                          ...f,
                          totalPrice: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Down payment</Label>
                    <Input
                      type="number"
                      min={0}
                      value={saleForm.downPayment}
                      onChange={(e) =>
                        setSaleForm((f) => ({
                          ...f,
                          downPayment: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Duration (months)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={saleForm.durationMonths}
                      onChange={(e) =>
                        setSaleForm((f) => ({
                          ...f,
                          durationMonths: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={saleForm.startDate}
                      onChange={(e) =>
                        setSaleForm((f) => ({
                          ...f,
                          startDate: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full">
                {txType === "rent" ? "Create rental" : "Create sale"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="rentals" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Rentals
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5">
            <Banknote className="h-4 w-4" />
            Sales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rentals" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Rental agreements</CardTitle>
              <CardDescription>
                Totals and month counts are calculated from recorded rental
                payments (deposits excluded).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rentError ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(rentError)}
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Agreement</TableHead>
                          <TableHead>Property</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Start</TableHead>
                          <TableHead>End</TableHead>
                          <TableHead className="text-right">Monthly</TableHead>
                          <TableHead className="text-right">
                            Total expected
                          </TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead>Paid / unpaid</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rentLoading ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-10">
                              Loading…
                            </TableCell>
                          </TableRow>
                        ) : rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-10">
                              No rentals yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((r) => (
                            <TableRow key={r.id} className="align-top">
                              <TableCell className="font-medium whitespace-nowrap">
                                {r.agreementNumber ?? "—"}
                              </TableCell>
                              <TableCell>{r.property.code ?? "—"}</TableCell>
                              <TableCell>{r.tenant.fullName}</TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {format(new Date(r.startDate), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {r.endDate
                                  ? format(new Date(r.endDate), "MMM d, yyyy")
                                  : "Open"}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {etb(r.monthlyRent)}
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <div>{etb(r.totalExpected)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {etb(r.monthlyRent)} × {r.monthsExpected ?? 0}{" "}
                                  mo.
                                </div>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <div className="text-emerald-700 dark:text-emerald-400">
                                  {etb(r.totalPaid)}
                                </div>
                                {(r.outstandingBalance ?? 0) > 0 ? (
                                  <div className="text-xs text-amber-700 dark:text-amber-400">
                                    Due {etb(r.outstandingBalance)}
                                  </div>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-sm">
                                <div className="space-y-0.5">
                                  <p>
                                    <span className="text-emerald-700">
                                      {r.monthsPaid ?? 0} paid
                                    </span>
                                    {" · "}
                                    <span className="text-muted-foreground">
                                      {r.monthsUnpaid ?? 0} unpaid
                                    </span>
                                  </p>
                                  {(r.monthsOverdue ?? 0) > 0 ? (
                                    <p className="text-destructive text-xs">
                                      {r.monthsOverdue} overdue
                                    </p>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell>
                                <RentPaymentBadge
                                  leaseStatus={r.status}
                                  paymentStatus={r.paymentStatus}
                                  balanceDue={r.balanceDue}
                                  monthsOverdue={r.monthsOverdue}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      disabled={deletingId === r.id}
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Open menu</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link to={`/rentals/${r.id}`}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        startEdit(r);
                                      }}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      disabled={deletingId === r.id}
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        setDeleteTarget(r);
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {rentData ? (
                    <TablePagination
                      page={rentData.page}
                      pageSize={rentData.pageSize}
                      total={rentData.total}
                      totalPages={rentData.totalPages}
                      onPageChange={setRentPage}
                    />
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Property sales</CardTitle>
              <CardDescription>
                Installment sales synced with sale payment records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {saleError ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(saleError)}
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead>Property</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Term</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Remaining</TableHead>
                          <TableHead className="min-w-[140px]">Progress</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleLoading ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-10">
                              Loading…
                            </TableCell>
                          </TableRow>
                        ) : sales.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center py-10">
                              No sales yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          sales.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">
                                {s.property.code ?? "—"}
                              </TableCell>
                              <TableCell>{s.buyer.fullName}</TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {format(new Date(s.startDate), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell>{s.durationMonths} mo.</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                {etb(s.totalPrice)}
                              </TableCell>
                              <TableCell className="text-right text-emerald-700 whitespace-nowrap">
                                {etb(s.totalPaid)}
                              </TableCell>
                              <TableCell className="text-right text-amber-700 whitespace-nowrap">
                                {etb(s.remaining)}
                              </TableCell>
                              <TableCell>
                                <PaymentProgressBar
                                  value={s.completionPercentage}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {s.completionPercentage.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className="capitalize font-normal"
                                >
                                  {s.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="outline" size="sm" asChild>
                                  <Link to={`/sales/${s.id}`}>
                                    <Eye className="h-4 w-4 mr-1" />
                                    View
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {saleData ? (
                    <TablePagination
                      page={saleData.page}
                      pageSize={saleData.pageSize}
                      total={saleData.total}
                      totalPages={saleData.totalPages}
                      onPageChange={setSalePage}
                    />
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            resetForms();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit rental</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEdit} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Property</Label>
              <Input value={editing?.property.code ?? ""} disabled />
            </div>
            <div className="col-span-2">
              <Label>Tenant</Label>
              <Input value={editing?.tenant.fullName ?? ""} disabled />
            </div>
            <div className="col-span-2">
              <Label>Agreement number</Label>
              <Input value={editing?.agreementNumber ?? ""} disabled />
            </div>
            <div className="col-span-2">
              <Label>Agreement file</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setAgreementFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label>Start date</Label>
              <Input
                type="date"
                value={rentForm.startDate}
                onChange={(e) =>
                  setRentForm((f) => ({ ...f, startDate: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>End date</Label>
              <Input
                type="date"
                value={rentForm.endDate}
                onChange={(e) =>
                  setRentForm((f) => ({ ...f, endDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Monthly rent</Label>
              <Input
                type="number"
                min={0}
                value={rentForm.monthlyRent}
                onChange={(e) =>
                  setRentForm((f) => ({ ...f, monthlyRent: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Security deposit</Label>
              <Input
                type="number"
                min={0}
                max={rentForm.monthlyRent || undefined}
                value={rentForm.deposit}
                onChange={(e) =>
                  setRentForm((f) => ({ ...f, deposit: e.target.value }))
                }
              />
            </div>
            {rentForm.startDate && rentForm.monthlyRent ? (
              <div className="col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">
                  Total expected rent:{" "}
                  {etb(
                    Number(rentForm.monthlyRent) *
                      estimateLeaseMonths(rentForm.startDate, rentForm.endDate),
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {etb(Number(rentForm.monthlyRent))} ×{" "}
                  {estimateLeaseMonths(rentForm.startDate, rentForm.endDate)}{" "}
                  months
                </p>
              </div>
            ) : null}
            <div className="col-span-2">
              <Label>Status</Label>
              <Select
                value={rentForm.status}
                onValueChange={(v) =>
                  setRentForm((f) => ({ ...f, status: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — ongoing lease</SelectItem>
                  <SelectItem value="completed">Completed — lease ended</SelectItem>
                  <SelectItem value="cancelled">Cancelled — voided early</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {rentalStatusHelp(rentForm.status)}
              </p>
            </div>
            <div className="col-span-2">
              <Button type="submit" className="w-full">
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {deleteTarget ? (
        <ConfirmActionDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null);
          }}
          title="Delete rental"
          description={`Delete rental ${deleteTarget.agreementNumber ?? deleteTarget.id}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await handleDelete(deleteTarget);
          }}
        />
      ) : null}
    </div>
  );
}
