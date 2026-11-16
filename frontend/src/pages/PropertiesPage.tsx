import { useAuth } from "@/contexts/AuthContext";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { StatusBadge } from "@/components/chrms/StatusBadge";
import { ConfirmActionDialog } from "@/components/chrms/ConfirmActionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, getApiErrorMessage } from "@/services/api";
import {
  Search,
  Home,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TablePagination } from "@/components/chrms/TablePagination";
import { buildPageParams, Paginated } from "@/lib/pagination";
import { propertyLabel } from "@/lib/property-label";

type PropertyRow = {
  id: string;
  houseNumber: string;
  woreda: string;
  kebele: string;
  type: string;
  category: string | null;
  status: string;
  assignee: string | null;
  rooms: number | null;
};

export default function PropertiesPage() {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [woreda, setWoreda] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const queryParams = useMemo(
    () =>
      buildPageParams({
        page,
        extra: {
          q: debouncedQ || undefined,
          status: status !== "all" ? status : undefined,
          woreda: woreda !== "all" ? woreda : undefined,
        },
      }),
    [page, debouncedQ, status, woreda],
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["properties", queryParams],
    queryFn: async () => {
      const res = await api.get<Paginated<PropertyRow>>(
        `/properties?${queryParams}`,
      );
      return res.data;
    },
  });

  const allWoredasQ = useQuery({
    queryKey: ["properties-woredas"],
    queryFn: async () => {
      const res = await api.get<Paginated<PropertyRow>>(
        `/properties?${buildPageParams({ page: 1, pageSize: 100 })}`,
      );
      return Array.from(new Set(res.data.items.map((p) => p.woreda))).sort();
    },
  });

  const rows = data?.items ?? [];
  const woredas = allWoredasQ.data ?? [];

  const handleDelete = async (row: PropertyRow) => {
    try {
      setDeletingId(row.id);
      await api.delete(`/properties/${row.id}`);
      toast({ title: "Property deleted" });
      refetch();
    } catch (err) {
      toast({
        title: "Failed to delete property",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Home className="h-7 w-7 text-primary" />
            Properties
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Government-owned houses by city, kebele, and house number
          </p>
        </div>
        {hasPermission("properties.write") ? (
          <Button asChild>
            <Link to="/properties/new">
              <Plus className="mr-2 h-4 w-4" />
              Add property
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Filter by status and city</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search house number, city, kebele…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="rented">Rented</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={woreda}
              onValueChange={(v) => {
                setWoreda(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="City" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All cities</SelectItem>
                {woredas.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>House no.</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Kebele</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Occupant</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      No properties
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {propertyLabel(row)}
                      </TableCell>
                      <TableCell>{row.woreda}</TableCell>
                      <TableCell>{row.kebele}</TableCell>
                      <TableCell className="capitalize">
                        {row.type}
                        {row.category ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {row.category}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>{row.assignee ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={deletingId === row.id}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to={`/housing/property/${row.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            {hasPermission("properties.write") ? (
                              <DropdownMenuItem asChild>
                                <Link to={`/housing/property/${row.id}`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Open record
                                </Link>
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            {hasPermission("properties.write") ? (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                disabled={deletingId === row.id}
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setDeleteTarget(row);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data ? (
            <TablePagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </CardContent>
      </Card>

      {deleteTarget ? (
        <ConfirmActionDialog
          open
          onOpenChange={(o) => {
            if (!o) setDeleteTarget(null);
          }}
          title="Delete property"
          description={`Delete property ${propertyLabel(deleteTarget, { withAddress: true })}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await handleDelete(deleteTarget);
          }}
        />
      ) : null}
    </div>
  );
}
