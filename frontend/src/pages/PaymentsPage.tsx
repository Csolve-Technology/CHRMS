import { useAuth } from "@/contexts/AuthContext";
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/chrms/TablePagination";
import { api, getApiErrorMessage } from "@/services/api";
import { downloadUploadedFile } from "@/services/file-download";
import { buildPageParams, Paginated } from "@/lib/pagination";
import { propertyLabel } from "@/lib/property-label";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Download, Plus } from "lucide-react";
import { format } from "date-fns";
import { estimateRentCoverage } from "@/lib/rent-coverage";
import { formatPaymentMethod } from "@/lib/rental-labels";

type RentalPay = {
  id: string;
  amount: number | string;
  paidAt: string;
  method: string;
  receiptNo: string | null;
  receiptFile?: string | null;
  kind?: "rent" | "deposit";
  coverageLabel?: string | null;
  monthsCovered?: Array<{
    label: string;
    amountApplied: number;
    statusAfter: string;
  }>;
  rental: {
    property: { houseNumber: string; woreda?: string; kebele?: string };
    tenant: { fullName: string };
  };
};

type SalePay = {
  id: string;
  amount: number | string;
  paidAt: string;
  method: string;
  sale: {
    property: { houseNumber: string; woreda?: string; kebele?: string };
    buyer: { fullName: string };
  };
};

type RentalOption = {
  id: string;
  monthlyRent: number;
  balanceDue?: number | null;
  outstandingBalance?: number | null;
  status: string;
  agreementNumber?: string | null;
  tenant: { fullName: string };
  property: { houseNumber: string; woreda?: string; kebele?: string };
};

type SaleOption = {
  id: string;
  status: string;
  property: { houseNumber: string; woreda?: string; kebele?: string };
  buyer: { fullName: string };
};

const emptyRentalForm = {
  rentalId: "",
  amount: "",
  paidAt: format(new Date(), "yyyy-MM-dd"),
  method: "cash",
  receiptFile: null as File | null,
};

const emptySaleForm = {
  saleId: "",
  amount: "",
  paidAt: format(new Date(), "yyyy-MM-dd"),
  method: "cash",
};

export default function PaymentsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rentalPage, setRentalPage] = useState(1);
  const [salePage, setSalePage] = useState(1);
  const [rentalOpen, setRentalOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [rentalForm, setRentalForm] = useState(emptyRentalForm);
  const [saleForm, setSaleForm] = useState(emptySaleForm);

  const filterExtra = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
    }),
    [from, to],
  );

  const rentalParams = useMemo(
    () => buildPageParams({ page: rentalPage, extra: filterExtra }),
    [rentalPage, filterExtra],
  );
  const saleParams = useMemo(
    () => buildPageParams({ page: salePage, extra: filterExtra }),
    [salePage, filterExtra],
  );

  const rentalQ = useQuery({
    queryKey: ["rental-payments", rentalParams],
    enabled: hasPermission("rental_payments.read"),
    queryFn: async () => {
      const res = await api.get<Paginated<RentalPay>>(
        `/rental-payments?${rentalParams}`,
      );
      return res.data;
    },
  });

  const saleQ = useQuery({
    queryKey: ["sale-payments", saleParams],
    enabled: hasPermission("sale_payments.read"),
    queryFn: async () => {
      const res = await api.get<Paginated<SalePay>>(
        `/sale-payments?${saleParams}`,
      );
      return res.data;
    },
  });

  const rentalsQ = useQuery({
    queryKey: ["rentals-for-payment"],
    enabled: rentalOpen && hasPermission("rentals.read"),
    queryFn: async () => {
      const res = await api.get<Paginated<RentalOption>>(
        `/rentals?${buildPageParams({ page: 1, pageSize: 100 })}`,
      );
      return res.data.items.filter((r) => r.status === "active");
    },
  });

  const salesQ = useQuery({
    queryKey: ["sales-for-payment"],
    enabled: saleOpen && hasPermission("sales.read"),
    queryFn: async () => {
      const res = await api.get<Paginated<SaleOption>>(
        `/sales?${buildPageParams({ page: 1, pageSize: 100 })}`,
      );
      return res.data.items.filter((s) => s.status === "active");
    },
  });

  const createRentalPay = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("rentalId", rentalForm.rentalId);
      fd.append("amount", String(Number(rentalForm.amount)));
      fd.append("paidAt", new Date(rentalForm.paidAt).toISOString());
      fd.append("method", rentalForm.method);
      if (rentalForm.receiptFile)
        fd.append("receiptFile", rentalForm.receiptFile);
      const res = await api.post<{ coverageLabel?: string }>(
        "/rental-payments",
        fd,
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Rental payment recorded",
        description: data.coverageLabel ?? undefined,
      });
      setRentalOpen(false);
      setRentalForm(emptyRentalForm);
      qc.invalidateQueries({ queryKey: ["rental-payments"] });
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["rental"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["housing"] });
    },
    onError: (err) => {
      toast({
        title: "Could not record payment",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const createSalePay = useMutation({
    mutationFn: async () => {
      await api.post("/sale-payments", {
        saleId: saleForm.saleId,
        amount: Number(saleForm.amount),
        paidAt: new Date(saleForm.paidAt).toISOString(),
        method: saleForm.method,
      });
    },
    onSuccess: () => {
      toast({ title: "Sale payment recorded" });
      setSaleOpen(false);
      setSaleForm(emptySaleForm);
      qc.invalidateQueries({ queryKey: ["sale-payments"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale"] });
    },
    onError: (err) => {
      toast({
        title: "Could not record payment",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const rentalRows = rentalQ.data?.items ?? [];
  const saleRows = saleQ.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-blue-600" />
          Payments
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Record receipts and review rental / sale payments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Optional date range</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setRentalPage(1);
                setSalePage(1);
              }}
            />
          </div>
          <div className="flex-1">
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setRentalPage(1);
                setSalePage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs
        defaultValue={hasPermission("rental_payments.read") ? "rental" : "sale"}
      >
        <TabsList>
          <TabsTrigger
            disabled={!hasPermission("rental_payments.read")}
            value="rental"
          >
            Rental payments
          </TabsTrigger>
          <TabsTrigger
            disabled={!hasPermission("sale_payments.read")}
            value="sale"
          >
            Sale payments
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rental">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Rent receipts</CardTitle>
              <Dialog
                open={rentalOpen}
                onOpenChange={(o) => {
                  setRentalOpen(o);
                  if (!o) setRentalForm(emptyRentalForm);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={
                      !hasPermission("rental_payments.write") ||
                      !hasPermission("rentals.read")
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
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
                      if (!rentalForm.rentalId || !rentalForm.amount) return;
                      createRentalPay.mutate();
                    }}
                  >
                    <div>
                      <Label>Rental</Label>
                      <Select
                        value={rentalForm.rentalId}
                        onValueChange={(v) => {
                          const r = rentalsQ.data?.find((x) => x.id === v);
                          const suggested =
                            r?.outstandingBalance != null &&
                            r.outstandingBalance > 0
                              ? r.outstandingBalance
                              : r?.balanceDue != null && r.balanceDue > 0
                                ? r.balanceDue
                                : r?.monthlyRent;
                          setRentalForm((f) => ({
                            ...f,
                            rentalId: v,
                            amount:
                              suggested != null ? String(suggested) : f.amount,
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select active rental" />
                        </SelectTrigger>
                        <SelectContent>
                          {(rentalsQ.data ?? []).map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {propertyLabel(r.property)} · {r.tenant.fullName}
                              {r.agreementNumber
                                ? ` (${r.agreementNumber})`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (ETB)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={rentalForm.amount}
                        onChange={(e) =>
                          setRentalForm((f) => ({
                            ...f,
                            amount: e.target.value,
                          }))
                        }
                        required
                      />
                      {(() => {
                        const r = rentalsQ.data?.find(
                          (x) => x.id === rentalForm.rentalId,
                        );
                        if (!r) return null;
                        const hint = estimateRentCoverage(
                          Number(rentalForm.amount),
                          r.monthlyRent,
                          r.outstandingBalance,
                        );
                        return (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Monthly {r.monthlyRent.toLocaleString()} ETB
                            {r.outstandingBalance != null
                              ? ` · Outstanding ${r.outstandingBalance.toLocaleString()} ETB`
                              : ""}
                            . Multi-month payments allowed.
                            {hint ? (
                              <span className="block font-medium text-emerald-700 dark:text-emerald-400">
                                {hint}
                              </span>
                            ) : null}
                          </p>
                        );
                      })()}
                    </div>
                    <div>
                      <Label>Paid on</Label>
                      <Input
                        type="date"
                        value={rentalForm.paidAt}
                        onChange={(e) =>
                          setRentalForm((f) => ({
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
                        value={rentalForm.method}
                        onValueChange={(v) =>
                          setRentalForm((f) => ({ ...f, method: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank transfer</SelectItem>
                          <SelectItem value="mobile">Mobile money</SelectItem>
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
                          setRentalForm((f) => ({
                            ...f,
                            receiptFile: e.target.files?.[0] ?? null,
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createRentalPay.isPending}
                    >
                      {createRentalPay.isPending ? "Saving…" : "Save payment"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {rentalQ.error ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(rentalQ.error)}
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>House no.</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Covers</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rentalQ.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8">
                              Loading…
                            </TableCell>
                          </TableRow>
                        ) : rentalRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8">
                              No records
                            </TableCell>
                          </TableRow>
                        ) : (
                          rentalRows.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                {format(new Date(p.paidAt), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="font-medium">
                                {propertyLabel(p.rental.property, {
                                  withAddress: true,
                                })}
                              </TableCell>
                              <TableCell>{p.rental.tenant.fullName}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                ETB {Number(p.amount).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm max-w-[200px]">
                                {p.coverageLabel ?? "—"}
                              </TableCell>
                              <TableCell>
                                {formatPaymentMethod(p.method)}
                              </TableCell>
                              <TableCell>
                                {p.receiptFile ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={async () => {
                                      try {
                                        await downloadUploadedFile(
                                          p.receiptFile!,
                                        );
                                      } catch (err) {
                                        toast({
                                          title: "Download failed",
                                          description: getApiErrorMessage(err),
                                          variant: "destructive",
                                        });
                                      }
                                    }}
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
                  {rentalQ.data ? (
                    <TablePagination
                      page={rentalQ.data.page}
                      pageSize={rentalQ.data.pageSize}
                      total={rentalQ.data.total}
                      totalPages={rentalQ.data.totalPages}
                      onPageChange={setRentalPage}
                    />
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="sale">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Sale installments</CardTitle>
              <Dialog
                open={saleOpen}
                onOpenChange={(o) => {
                  setSaleOpen(o);
                  if (!o) setSaleForm(emptySaleForm);
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={
                      !hasPermission("sale_payments.write") ||
                      !hasPermission("sales.read")
                    }
                  >
                    <Plus className="h-4 w-4 mr-1" />
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
                      if (!saleForm.saleId || !saleForm.amount) return;
                      createSalePay.mutate();
                    }}
                  >
                    <div>
                      <Label>Sale</Label>
                      <Select
                        value={saleForm.saleId}
                        onValueChange={(v) =>
                          setSaleForm((f) => ({ ...f, saleId: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select active sale" />
                        </SelectTrigger>
                        <SelectContent>
                          {(salesQ.data ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {propertyLabel(s.property)} · {s.buyer.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Amount (ETB)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={saleForm.amount}
                        onChange={(e) =>
                          setSaleForm((f) => ({
                            ...f,
                            amount: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Paid on</Label>
                      <Input
                        type="date"
                        value={saleForm.paidAt}
                        onChange={(e) =>
                          setSaleForm((f) => ({
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
                        value={saleForm.method}
                        onValueChange={(v) =>
                          setSaleForm((f) => ({ ...f, method: v }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank transfer</SelectItem>
                          <SelectItem value="mobile">Mobile money</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createSalePay.isPending}
                    >
                      {createSalePay.isPending ? "Saving…" : "Save payment"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-4">
              {saleQ.error ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(saleQ.error)}
                </p>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>House no.</TableHead>
                          <TableHead>Buyer</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {saleQ.isLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              Loading…
                            </TableCell>
                          </TableRow>
                        ) : saleRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              No records
                            </TableCell>
                          </TableRow>
                        ) : (
                          saleRows.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                {format(new Date(p.paidAt), "MMM d, yyyy")}
                              </TableCell>
                              <TableCell className="font-medium">
                                {propertyLabel(p.sale.property, {
                                  withAddress: true,
                                })}
                              </TableCell>
                              <TableCell>{p.sale.buyer.fullName}</TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                ETB {Number(p.amount).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                {formatPaymentMethod(p.method)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {saleQ.data ? (
                    <TablePagination
                      page={saleQ.data.page}
                      pageSize={saleQ.data.pageSize}
                      total={saleQ.data.total}
                      totalPages={saleQ.data.totalPages}
                      onPageChange={setSalePage}
                    />
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
