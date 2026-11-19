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
import { buildSalePaymentSchedule } from "@/lib/sale-schedule";
import { format } from "date-fns";
import React, { useMemo } from "react";

function etb(n: number) {
  return `ETB ${n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export type SalePaymentFormValues = {
  totalPrice: string;
  paymentMode: "full" | "partial";
  initialPaid: string;
  durationMonths: string;
  startDate: string;
};

type SalePaymentFieldsProps = {
  value: SalePaymentFormValues;
  onChange: (next: SalePaymentFormValues) => void;
  /** Extra class for the outer grid */
  className?: string;
};

export function SalePaymentFields({
  value,
  onChange,
  className,
}: SalePaymentFieldsProps) {
  const total = Number(value.totalPrice) || 0;
  const initial =
    value.paymentMode === "full"
      ? total
      : Number(value.initialPaid) || 0;
  const months =
    value.paymentMode === "full" ? 0 : Number(value.durationMonths) || 0;

  const plan = useMemo(
    () =>
      buildSalePaymentSchedule({
        totalPrice: total,
        downPayment: initial,
        durationMonths: months,
        startDate: value.startDate || undefined,
      }),
    [total, initial, months, value.startDate],
  );

  return (
    <div className={className ?? "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
      <div>
        <Label>Total price (ETB)</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={value.totalPrice}
          onChange={(e) =>
            onChange({ ...value, totalPrice: e.target.value })
          }
          required
        />
      </div>
      <div>
        <Label>Payment status</Label>
        <Select
          value={value.paymentMode}
          onValueChange={(v) => {
            const mode = v as "full" | "partial";
            onChange({
              ...value,
              paymentMode: mode,
              initialPaid:
                mode === "full"
                  ? value.totalPrice
                  : value.initialPaid,
              durationMonths: mode === "full" ? "0" : value.durationMonths || "12",
            });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Fully Paid</SelectItem>
            <SelectItem value="partial">Partially Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.paymentMode === "partial" ? (
        <>
          <div>
            <Label>Initial paid amount (ETB)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={value.initialPaid}
              onChange={(e) =>
                onChange({ ...value, initialPaid: e.target.value })
              }
              required
            />
          </div>
          <div>
            <Label>Months to pay remaining</Label>
            <Input
              type="number"
              min={1}
              value={value.durationMonths}
              onChange={(e) =>
                onChange({ ...value, durationMonths: e.target.value })
              }
              required
            />
          </div>
        </>
      ) : null}

      <div>
        <Label>Start date</Label>
        <Input
          type="date"
          value={value.startDate}
          onChange={(e) =>
            onChange({ ...value, startDate: e.target.value })
          }
          required
        />
      </div>

      {total > 0 ? (
        <div
          className={
            value.paymentMode === "partial"
              ? "sm:col-span-2 space-y-3 rounded-md border bg-muted/40 px-3 py-3"
              : "rounded-md border bg-muted/40 px-3 py-3"
          }
        >
          {value.paymentMode === "full" ? (
            <p className="text-sm font-medium">
              Fully paid — remaining balance {etb(0)}
            </p>
          ) : (
            <>
              <div className="grid gap-1 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Remaining: </span>
                  <span className="font-medium">
                    {etb(plan.remainingBalance)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Monthly: </span>
                  <span className="font-medium">
                    {etb(plan.monthlyPayment)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Installments: </span>
                  <span className="font-medium">{plan.schedule.length}</span>
                </p>
              </div>
              {plan.schedule.length > 0 ? (
                <div className="max-h-48 overflow-auto rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Due date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plan.schedule.map((row) => (
                        <TableRow key={row.installment}>
                          <TableCell>{row.installment}</TableCell>
                          <TableCell>
                            {format(new Date(row.dueDate), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            {etb(row.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Map form values to API create payload fields. */
export function salePayloadFromForm(value: SalePaymentFormValues) {
  const totalPrice = Number(value.totalPrice);
  if (value.paymentMode === "full") {
    return {
      totalPrice,
      downPayment: totalPrice,
      durationMonths: 0,
      startDate: value.startDate,
    };
  }
  return {
    totalPrice,
    downPayment: Number(value.initialPaid),
    durationMonths: Number(value.durationMonths),
    startDate: value.startDate,
  };
}
