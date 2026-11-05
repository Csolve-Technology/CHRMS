import { useAuth } from "@/contexts/AuthContext";
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PaymentProgressBar } from "@/components/chrms/PaymentProgressBar";
import { api, getApiErrorMessage } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus } from "lucide-react";
import { format } from "date-fns";

type SalePayment = {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
};

type SaleDetail = {
  id: string;
  status: string;
  startDate: string;
  durationMonths: number;
  downPayment: number;
  totalPrice: number;
  totalPaid: number;
  installmentsPaid: number;
  remaining: number;
  outstandingBalance: number;
  completionPercentage: number;
  isCompleted: boolean;
  property: {
    id: string;
    code: string | null;
    woreda: string;
    kebele: string;
    houseNumber: string;
  };
  buyer: {
    id: string;
    fullName: string;
    phone?: string;
  };
  payments: SalePayment[];
};

function etb(n: number) {
  return `ETB ${n.toLocaleString()}`;
}

function methodLabel(method: string) {
  switch (method) {
    case "cash":
      return "Cash";
    case "bank":
      return "Bank transfer";
    case "mobile":
      return "Mobile money";
    default:
      return method;
  }
}

export default function SaleDetailPage() {
  const { hasPermission } = useAuth();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    paidAt: format(new Date(), "yyyy-MM-dd"),
    method: "bank",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<SaleDetail>(`/sales/${id}`);
      return res.data;
    },
  });

  const createPay = useMutation({
    mutationFn: async () => {
      await api.post("/sale-payments", {
        saleId: id,
        amount: Number(form.amount),
        paidAt: new Date(form.paidAt).toISOString(),
        method: form.method,
      });
    },
    onSuccess: () => {
      toast({ title: "Sale payment recorded" });
      setOpen(false);
      setForm({
        amount: "",
        paidAt: format(new Date(), "yyyy-MM-dd"),
        method: "bank",
      });
      qc.invalidateQueries({ queryKey: ["sale", id] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale-payments"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (err) => {
      toast({
        title: "Could not record payment",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">Loading sale…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-destructive">
        {error ? getApiErrorMessage(error) : "Not found"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/rentals?tab=sales">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Sale · {data.property.code}</h1>
        <Badge variant="outline" className="capitalize font-normal">
          {data.status}
        </Badge>
        {data.isCompleted ? (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 font-normal">
            Fully paid
          </Badge>
        ) : (
          <Badge variant="secondary" className="font-normal">
            {data.completionPercentage.toFixed(1)}% paid
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Selling price</CardDescription>
            <CardTitle className="text-xl">{etb(data.totalPrice)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Down payment (agreed)</CardDescription>
            <CardTitle className="text-xl">{etb(data.downPayment)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total received</CardDescription>
            <CardTitle className="text-xl text-emerald-700 dark:text-emerald-400">
              {etb(data.totalPaid)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Installments beyond down payment: {etb(data.installmentsPaid)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding balance</CardDescription>
            <CardTitle className="text-xl text-amber-700 dark:text-amber-400">
              {etb(data.outstandingBalance)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment progress</CardTitle>
          <CardDescription>
            {data.durationMonths} month installment plan from{" "}
            {format(new Date(data.startDate), "MMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <PaymentProgressBar value={data.completionPercentage} />
          <p className="text-sm text-muted-foreground">
            {data.completionPercentage.toFixed(1)}% of selling price received
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Property</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">
              <Link
                to={`/properties/${data.property.id}`}
                className="text-primary hover:underline"
              >
                {data.property.code}
              </Link>
            </p>
            <p>
              Woreda/City {data.property.woreda}, Kebele {data.property.kebele},
              #{data.property.houseNumber}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Buyer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">
              <Link
                to={`/tenants/${data.buyer.id}`}
                className="text-primary hover:underline"
              >
                {data.buyer.fullName}
              </Link>
            </p>
            {data.buyer.phone ? <p>{data.buyer.phone}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>
              Down payment and installment receipts — synced with the Payments
              module
            </CardDescription>
          </div>
          {!data.isCompleted ? (
            <Dialog
              open={open}
              onOpenChange={(o) => {
                setOpen(o);
                if (o) {
                  setForm((f) => ({
                    ...f,
                    amount:
                      f.amount ||
                      String(
                        data.outstandingBalance > 0
                          ? data.outstandingBalance
                          : data.downPayment || "",
                      ),
                  }));
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  disabled={!hasPermission("sale_payments.write")}
                  size="sm"
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
                    createPay.mutate();
                  }}
                >
                  <div>
                    <Label>Amount (ETB)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.amount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, amount: e.target.value }))
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Outstanding: {etb(data.outstandingBalance)}
                    </p>
                  </div>
                  <div>
                    <Label>Paid on</Label>
                    <Input
                      type="date"
                      value={form.paidAt}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paidAt: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Method</Label>
                    <Select
                      value={form.method}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, method: v }))
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
                    disabled={createPay.isPending}
                  >
                    {createPay.isPending ? "Saving…" : "Save payment"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payments recorded
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p, index) => {
                    const chronologicalIndex = data.payments.length - 1 - index;
                    const isDown =
                      chronologicalIndex === 0 &&
                      Math.abs(p.amount - data.downPayment) < 0.01;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          {format(new Date(p.paidAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {etb(p.amount)}
                        </TableCell>
                        <TableCell>{methodLabel(p.method)}</TableCell>
                        <TableCell>
                          {isDown ? (
                            <Badge variant="outline" className="font-normal">
                              Down payment
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Installment
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
