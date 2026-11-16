import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "@/services/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import {
  Building2,
  Users,
  FileText,
  CreditCard,
  Banknote,
  AlertTriangle,
  Home,
  KeyRound,
} from "lucide-react";
import { format } from "date-fns";
import { propertyLabel } from "@/lib/property-label";
import { formatPaymentMethod } from "@/lib/rental-labels";

type NameValue = { name: string; value: number };

type ReportsOverview = {
  generatedAt: string;
  summary: {
    total_properties: number;
    available: number;
    rented: number;
    sold: number;
    maintenance: number;
    total_revenue: number;
    outstanding_balance: number;
    total_tenants: number;
    active_tenants: number;
    inactive_tenants: number;
    total_rentals: number;
    active_rentals: number;
    ended_rentals: number;
    total_sales: number;
    active_sales: number;
    completed_sales: number;
    rental_revenue: number;
    sale_revenue: number;
    deposit_held: number;
    rent_expected_this_month: number;
    rent_paid_this_month: number;
    rent_outstanding_this_month: number;
  };
  charts: {
    properties_by_status: NameValue[];
    properties_by_type: NameValue[];
    properties_by_woreda: NameValue[];
    rentals_by_status: NameValue[];
    sales_by_status: NameValue[];
    tenants_by_status: NameValue[];
    rent_collection_this_month: NameValue[];
    monthly_revenue: {
      month: string;
      rental: number;
      sale: number;
      total: number;
    }[];
    payment_methods: { method: string; amount: number }[];
    sales_progress: NameValue[];
  };
  tables: {
    top_rental_balances: {
      id: string;
      houseNumber: string;
      woreda: string;
      kebele: string;
      tenant: string;
      monthlyRent: number;
      outstanding: number;
      monthStatus: string;
    }[];
    top_sale_balances: {
      id: string;
      houseNumber: string;
      woreda: string;
      kebele: string;
      buyer: string;
      totalPrice: number;
      paid: number;
      remaining: number;
      completionPercentage: number;
      status: string;
    }[];
    recent_rental_payments: {
      id: string;
      amount: number;
      paidAt: string;
      method: string;
      houseNumber: string;
      person: string;
    }[];
    recent_sale_payments: {
      id: string;
      amount: number;
      paidAt: string;
      method: string;
      houseNumber: string;
      person: string;
    }[];
  };
};

const STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  rented: "#3b82f6",
  sold: "#8b5cf6",
  maintenance: "#f59e0b",
  active: "#3b82f6",
  inactive: "#94a3b8",
  ended: "#64748b",
  completed: "#10b981",
  cancelled: "#ef4444",
  Paid: "#10b981",
  Partial: "#f59e0b",
  Unpaid: "#94a3b8",
  Overdue: "#ef4444",
  "Not due": "#cbd5e1",
  "In progress": "#3b82f6",
  "Fully paid": "#10b981",
};

const CHART_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

function etb(n: number | undefined | null) {
  return `ETB ${Number(n ?? 0).toLocaleString()}`;
}

function colorFor(name: string, index: number) {
  return STATUS_COLORS[name] ?? CHART_PALETTE[index % CHART_PALETTE.length];
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint ? (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState("overview");

  const reportQ = useQuery({
    queryKey: ["reports-overview"],
    queryFn: async () => {
      const res = await api.get<ReportsOverview>("/reports/overview");
      return res.data;
    },
  });

  const data = reportQ.data;
  const s = data?.summary;
  const charts = data?.charts;
  const tables = data?.tables;

  const methodChart = useMemo(
    () =>
      (charts?.payment_methods ?? []).map((row) => ({
        name: formatPaymentMethod(row.method),
        value: row.amount,
      })),
    [charts?.payment_methods],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Reports & analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Live stats from properties, tenants, rent/sale agreements, and
          payments
          {data?.generatedAt
            ? ` · Updated ${format(new Date(data.generatedAt), "MMM d, yyyy HH:mm")}`
            : ""}
        </p>
      </div>

      {reportQ.error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Could not load reports
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {getApiErrorMessage(reportQ.error)}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Properties"
          value={reportQ.isLoading ? "—" : (s?.total_properties ?? 0)}
          hint={
            s
              ? `${s.available} available · ${s.rented} rented · ${s.sold} sold`
              : undefined
          }
          icon={Building2}
        />
        <StatCard
          title="Tenants"
          value={reportQ.isLoading ? "—" : (s?.total_tenants ?? 0)}
          hint={s ? `${s.active_tenants} active` : undefined}
          icon={Users}
        />
        <StatCard
          title="Active rentals"
          value={reportQ.isLoading ? "—" : (s?.active_rentals ?? 0)}
          hint={s ? `${s.total_rentals} total agreements` : undefined}
          icon={KeyRound}
        />
        <StatCard
          title="Total revenue"
          value={reportQ.isLoading ? "—" : etb(s?.total_revenue)}
          hint={
            s
              ? `Rent ${etb(s.rental_revenue)} · Sales ${etb(s.sale_revenue)}`
              : undefined
          }
          icon={Banknote}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Rent collected this month"
          value={reportQ.isLoading ? "—" : etb(s?.rent_paid_this_month)}
          hint={
            s
              ? `Expected ${etb(s.rent_expected_this_month)} · Due ${etb(s.rent_outstanding_this_month)}`
              : undefined
          }
          icon={CreditCard}
        />
        <StatCard
          title="Outstanding balance"
          value={reportQ.isLoading ? "—" : etb(s?.outstanding_balance)}
          hint="Current rent shortfall + unpaid sale balances"
          icon={AlertTriangle}
        />
        <StatCard
          title="Sales"
          value={reportQ.isLoading ? "—" : (s?.total_sales ?? 0)}
          hint={
            s
              ? `${s.active_sales} active · ${s.completed_sales} completed`
              : undefined
          }
          icon={FileText}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="rentals">Rent & sell</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly revenue</CardTitle>
                <CardDescription>
                  Rental vs sale receipts — last 12 months
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(charts?.monthly_revenue?.length ?? 0) === 0 ? (
                  <EmptyChart label="No payment history yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={charts?.monthly_revenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v) => etb(Number(v))}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Legend />
                      <Bar
                        dataKey="rental"
                        name="Rent"
                        fill="#3b82f6"
                        stackId="a"
                      />
                      <Bar
                        dataKey="sale"
                        name="Sale"
                        fill="#10b981"
                        stackId="a"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue trend</CardTitle>
                <CardDescription>Total cash collected by month</CardDescription>
              </CardHeader>
              <CardContent>
                {(charts?.monthly_revenue?.length ?? 0) === 0 ? (
                  <EmptyChart label="No payment history yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={charts?.monthly_revenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => etb(Number(v))} />
                      <Line
                        type="monotone"
                        dataKey="total"
                        name="Total"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Property status</CardTitle>
              </CardHeader>
              <CardContent>
                {(charts?.properties_by_status?.length ?? 0) === 0 ? (
                  <EmptyChart label="No properties" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={charts?.properties_by_status}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {charts?.properties_by_status.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={colorFor(entry.name, i)}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>This month’s rent</CardTitle>
                <CardDescription>Active leases by collection status</CardDescription>
              </CardHeader>
              <CardContent>
                {(charts?.rent_collection_this_month?.length ?? 0) === 0 ? (
                  <EmptyChart label="No active rentals" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={charts?.rent_collection_this_month}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {charts?.rent_collection_this_month.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={colorFor(entry.name, i)}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment methods</CardTitle>
                <CardDescription>All recorded receipts</CardDescription>
              </CardHeader>
              <CardContent>
                {methodChart.length === 0 ? (
                  <EmptyChart label="No payments yet" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={methodChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip formatter={(v) => etb(Number(v))} />
                      <Bar dataKey="value" name="Amount" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By city</CardTitle>
                <CardDescription>Inventory distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {(charts?.properties_by_woreda?.length ?? 0) === 0 ? (
                  <EmptyChart label="No properties" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={charts?.properties_by_woreda}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name="Properties" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By type</CardTitle>
                <CardDescription>Residential vs commercial</CardDescription>
              </CardHeader>
              <CardContent>
                {(charts?.properties_by_type?.length ?? 0) === 0 ? (
                  <EmptyChart label="No properties" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={charts?.properties_by_type}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {charts?.properties_by_type.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={colorFor(entry.name, i)}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              title="Available"
              value={s?.available ?? 0}
              icon={Home}
            />
            <StatCard title="Rented" value={s?.rented ?? 0} icon={KeyRound} />
            <StatCard title="Sold" value={s?.sold ?? 0} icon={FileText} />
            <StatCard
              title="Maintenance"
              value={s?.maintenance ?? 0}
              icon={AlertTriangle}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tenants</CardTitle>
              <CardDescription>Directory status</CardDescription>
            </CardHeader>
            <CardContent>
              {(charts?.tenants_by_status?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No tenants yet</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {charts?.tenants_by_status.map((row) => (
                    <div key={row.name}>
                      <p className="text-sm text-muted-foreground capitalize">
                        {row.name}
                      </p>
                      <p className="text-xl font-semibold">{row.value}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-xl font-semibold">
                      {s?.total_tenants ?? 0}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentals" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Rental agreements</CardTitle>
              </CardHeader>
              <CardContent>
                {(charts?.rentals_by_status?.length ?? 0) === 0 ? (
                  <EmptyChart label="No rentals" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={charts?.rentals_by_status}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name="Agreements">
                        {charts?.rentals_by_status.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={colorFor(entry.name, i)}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sale agreements</CardTitle>
              </CardHeader>
              <CardContent>
                {(charts?.sales_progress?.length ?? 0) === 0 &&
                (charts?.sales_by_status?.length ?? 0) === 0 ? (
                  <EmptyChart label="No sales" />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={
                          (charts?.sales_progress?.length ?? 0) > 0
                            ? charts?.sales_progress
                            : charts?.sales_by_status
                        }
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {(
                          ((charts?.sales_progress?.length ?? 0) > 0
                            ? charts?.sales_progress
                            : charts?.sales_by_status) ?? []
                        ).map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={colorFor(entry.name, i)}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Highest rental balances</CardTitle>
              <CardDescription>
                Active leases with outstanding rent (deposits excluded)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>House no.</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Monthly</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Month</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tables?.top_rental_balances?.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground py-8"
                        >
                          No outstanding rental balances
                        </TableCell>
                      </TableRow>
                    ) : (
                      tables?.top_rental_balances.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            <Link
                              className="hover:underline"
                              to={`/housing/rental/${row.id}`}
                            >
                              {propertyLabel(row, { withAddress: true })}
                            </Link>
                          </TableCell>
                          <TableCell>{row.tenant}</TableCell>
                          <TableCell className="text-right">
                            {etb(row.monthlyRent)}
                          </TableCell>
                          <TableCell className="text-right text-amber-700">
                            {etb(row.outstanding)}
                          </TableCell>
                          <TableCell className="capitalize">
                            {row.monthStatus.replace("_", " ")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Highest sale balances</CardTitle>
              <CardDescription>Installment sales still owing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>House no.</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(tables?.top_sale_balances?.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-8"
                        >
                          No outstanding sale balances
                        </TableCell>
                      </TableRow>
                    ) : (
                      tables?.top_sale_balances.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            <Link
                              className="hover:underline"
                              to={`/housing/sale/${row.id}`}
                            >
                              {propertyLabel(row, { withAddress: true })}
                            </Link>
                          </TableCell>
                          <TableCell>{row.buyer}</TableCell>
                          <TableCell className="text-right">
                            {etb(row.totalPrice)}
                          </TableCell>
                          <TableCell className="text-right text-emerald-700">
                            {etb(row.paid)}
                          </TableCell>
                          <TableCell className="text-right text-amber-700">
                            {etb(row.remaining)}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.completionPercentage.toFixed(0)}%
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              title="Rental receipts"
              value={etb(s?.rental_revenue)}
              hint={s ? `Deposits held ${etb(s.deposit_held)}` : undefined}
              icon={CreditCard}
            />
            <StatCard
              title="Sale receipts"
              value={etb(s?.sale_revenue)}
              icon={Banknote}
            />
            <StatCard
              title="Combined"
              value={etb(s?.total_revenue)}
              icon={Building2}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent rent payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>House</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tables?.recent_rental_payments?.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground py-8"
                          >
                            No rent payments yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        tables?.recent_rental_payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {format(new Date(p.paidAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>#{p.houseNumber}</TableCell>
                            <TableCell>{p.person}</TableCell>
                            <TableCell className="text-right">
                              {etb(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent sale payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>House</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tables?.recent_sale_payments?.length ?? 0) === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-muted-foreground py-8"
                          >
                            No sale payments yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        tables?.recent_sale_payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>
                              {format(new Date(p.paidAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>#{p.houseNumber}</TableCell>
                            <TableCell>{p.person}</TableCell>
                            <TableCell className="text-right">
                              {etb(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
