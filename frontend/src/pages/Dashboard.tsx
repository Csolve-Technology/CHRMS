import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, getApiErrorMessage } from "@/services/api";
import {
  Building2,
  Home,
  KeyRound,
  Banknote,
  Wallet,
  AlertCircle,
  Users,
  FileText,
  Wrench,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

type NameValue = { name: string; value: number };

type Summary = {
  total_properties: number;
  available: number;
  rented: number;
  sold: number;
  maintenance: number;
  total_revenue: number;
  rental_revenue: number;
  sale_revenue: number;
  outstanding_balance: number;
  outstanding_rent: number;
  outstanding_sales: number;
  rent_expected_this_month: number;
  rent_paid_this_month: number;
  total_tenants: number;
  active_tenants: number;
  active_rentals: number;
  active_sales: number;
  properties_by_status: NameValue[];
  properties_by_category: NameValue[];
  properties_by_kebele: NameValue[];
};

type Trends = {
  monthly_revenue: {
    month: string;
    rental: number;
    sale: number;
    total: number;
  }[];
  payment_trends: {
    month: string;
    total: number;
    rental?: number;
    sale?: number;
  }[];
};

const STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  rented: "#3b82f6",
  sold: "#8b5cf6",
  maintenance: "#f59e0b",
};

const CATEGORY_COLORS: Record<string, string> = {
  saving: "#0ea5e9",
  kebele: "#14b8a6",
  condominium: "#6366f1",
  uncategorized: "#94a3b8",
};

const KEBELE_PALETTE = [
  "#2563eb",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
  "#84cc16",
];

function etb(n: number | undefined | null) {
  return `ETB ${Number(n ?? 0).toLocaleString()}`;
}

function labelName(name: string) {
  if (name === "uncategorized") return "Uncategorized";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "slate" | "blue" | "emerald" | "amber" | "violet" | "cyan" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/40",
    blue: "border-blue-200/80 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30",
    emerald:
      "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30",
    amber:
      "border-amber-200/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
    violet:
      "border-violet-200/80 bg-violet-50/70 dark:border-violet-900 dark:bg-violet-950/30",
    cyan: "border-cyan-200/80 bg-cyan-50/70 dark:border-cyan-900 dark:bg-cyan-950/30",
    rose: "border-rose-200/80 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/30",
  };
  const iconTone: Record<string, string> = {
    slate: "text-slate-500",
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    violet: "text-violet-600 dark:text-violet-400",
    cyan: "text-cyan-600 dark:text-cyan-400",
    rose: "text-rose-600 dark:text-rose-400",
  };

  return (
    <Card className={`shadow-sm ${tones[tone]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconTone[tone]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const summaryQ = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const res = await api.get<Summary>("/dashboard/summary");
      return res.data;
    },
  });

  const trendsQ = useQuery({
    queryKey: ["dashboard-trends"],
    queryFn: async () => {
      const res = await api.get<Trends>("/dashboard/trends");
      return res.data;
    },
  });

  const s = summaryQ.data;
  const err = summaryQ.error || trendsQ.error;

  const categoryData = useMemo(
    () =>
      (s?.properties_by_category ?? []).map((row) => ({
        ...row,
        name: labelName(row.name),
        raw: row.name,
      })),
    [s?.properties_by_category],
  );

  const statusData = useMemo(
    () =>
      (s?.properties_by_status ?? []).map((row) => ({
        ...row,
        name: labelName(row.name),
        raw: row.name,
      })),
    [s?.properties_by_status],
  );

  const kebeleData = s?.properties_by_kebele ?? [];

  const collectionRate =
    s && s.rent_expected_this_month > 0
      ? Math.round(
          (s.rent_paid_this_month / s.rent_expected_this_month) * 100,
        )
      : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-500 p-6 text-white shadow-sm">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-20 h-40 w-40 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="relative">
          <h1 className="text-2xl font-bold mb-1">
            {getGreeting()}, {user?.name}!
          </h1>
          <p className="text-blue-50/90 text-sm sm:text-base">
            Live housing portfolio from properties, tenants, rentals, and
            payments
          </p>
        </div>
      </div>

      {err ? (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base">Could not load dashboard</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {getApiErrorMessage(err)}. Ensure the API is running and{" "}
            <code className="text-xs bg-muted px-1 rounded">VITE_API_URL</code>{" "}
            is set.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Properties"
          value={summaryQ.isLoading ? "—" : (s?.total_properties ?? 0)}
          hint={
            s
              ? `${s.available} available · ${s.rented} rented · ${s.sold} sold`
              : undefined
          }
          icon={Building2}
          tone="blue"
        />
        <StatCard
          title="Active tenants"
          value={summaryQ.isLoading ? "—" : (s?.active_tenants ?? 0)}
          hint={s ? `${s.total_tenants} in directory` : undefined}
          icon={Users}
          tone="cyan"
        />
        <StatCard
          title="Active rentals"
          value={summaryQ.isLoading ? "—" : (s?.active_rentals ?? 0)}
          hint={s ? `${s.active_sales} active sales` : undefined}
          icon={KeyRound}
          tone="emerald"
        />
        <StatCard
          title="Total revenue"
          value={summaryQ.isLoading ? "—" : etb(s?.total_revenue)}
          hint={
            s
              ? `Rent ${etb(s.rental_revenue)} · Sales ${etb(s.sale_revenue)}`
              : undefined
          }
          icon={Wallet}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Available"
          value={summaryQ.isLoading ? "—" : (s?.available ?? 0)}
          icon={Home}
          tone="emerald"
        />
        <StatCard
          title="Maintenance"
          value={summaryQ.isLoading ? "—" : (s?.maintenance ?? 0)}
          icon={Wrench}
          tone="amber"
        />
        <StatCard
          title="Rent this month"
          value={summaryQ.isLoading ? "—" : etb(s?.rent_paid_this_month)}
          hint={
            s
              ? `Expected ${etb(s.rent_expected_this_month)}${
                  collectionRate != null ? ` · ${collectionRate}% collected` : ""
                }`
              : undefined
          }
          icon={Banknote}
          tone="blue"
        />
        <StatCard
          title="Outstanding"
          value={summaryQ.isLoading ? "—" : etb(s?.outstanding_balance)}
          hint={
            s
              ? `Rent ${etb(s.outstanding_rent)} · Sales ${etb(s.outstanding_sales)}`
              : undefined
          }
          icon={AlertCircle}
          tone="rose"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-emerald-200/60 shadow-sm dark:border-emerald-900/50">
          <CardHeader>
            <CardTitle>Houses by category</CardTitle>
            <CardDescription>Saving, kebele, and condominium</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {summaryQ.isLoading ? (
              <EmptyChart label="Loading chart…" />
            ) : categoryData.length === 0 ? (
              <EmptyChart label="No property categories yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {categoryData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={
                          CATEGORY_COLORS[entry.raw] ??
                          KEBELE_PALETTE[i % KEBELE_PALETTE.length]
                        }
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

        <Card className="border-blue-200/60 shadow-sm dark:border-blue-900/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Houses by kebele</CardTitle>
            <CardDescription>Inventory count per kebele</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {summaryQ.isLoading ? (
              <EmptyChart label="Loading chart…" />
            ) : kebeleData.length === 0 ? (
              <EmptyChart label="No kebele data yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kebeleData} margin={{ bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-28}
                    textAnchor="end"
                    height={70}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Houses" radius={[6, 6, 0, 0]}>
                    {kebeleData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={KEBELE_PALETTE[i % KEBELE_PALETTE.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-violet-200/60 shadow-sm dark:border-violet-900/50">
          <CardHeader>
            <CardTitle>Status mix</CardTitle>
            <CardDescription>Available, rented, sold, maintenance</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {summaryQ.isLoading ? (
              <EmptyChart label="Loading chart…" />
            ) : statusData.length === 0 ? (
              <EmptyChart label="No properties yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={
                          STATUS_COLORS[entry.raw] ??
                          KEBELE_PALETTE[i % KEBELE_PALETTE.length]
                        }
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

        <Card className="border-sky-200/60 shadow-sm dark:border-sky-900/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Monthly revenue</CardTitle>
            <CardDescription>
              Rental vs sale receipts — last 12 months
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {trendsQ.isLoading ? (
              <EmptyChart label="Loading chart…" />
            ) : (trendsQ.data?.monthly_revenue?.length ?? 0) === 0 ? (
              <EmptyChart label="No payment history yet" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendsQ.data?.monthly_revenue ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => etb(Number(v))} />
                  <Legend />
                  <Bar
                    dataKey="rental"
                    fill="#2563eb"
                    name="Rental"
                    radius={[4, 4, 0, 0]}
                    stackId="rev"
                  />
                  <Bar
                    dataKey="sale"
                    fill="#06b6d4"
                    name="Sale"
                    radius={[4, 4, 0, 0]}
                    stackId="rev"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-indigo-200/60 shadow-sm dark:border-indigo-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" />
            Payment trends
          </CardTitle>
          <CardDescription>Total collections per month</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {trendsQ.isLoading ? (
            <EmptyChart label="Loading chart…" />
          ) : (trendsQ.data?.payment_trends?.length ?? 0) === 0 ? (
            <EmptyChart label="No payment history yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsQ.data?.payment_trends ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => etb(Number(v))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  name="Total"
                />
                <Line
                  type="monotone"
                  dataKey="rental"
                  stroke="#2563eb"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Rental"
                />
                <Line
                  type="monotone"
                  dataKey="sale"
                  stroke="#06b6d4"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Sale"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
