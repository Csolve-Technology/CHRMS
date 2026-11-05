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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { GpsLocationFields } from "@/components/chrms/GpsLocationFields";
import { TablePagination } from "@/components/chrms/TablePagination";
import { buildPageParams, Paginated } from "@/lib/pagination";

type PropertyRow = {
  id: string;
  code: string | null;
  location: string;
  type: string;
  category: string | null;
  status: string;
  assignee: string | null;
  woreda: string;
};

export default function PropertiesPage() {
  const { hasPermission } = useAuth();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [woreda, setWoreda] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);
  const [form, setForm] = useState({
    code: "",
    type: "residential",
    category: "kebele",
    woreda: "Chiro City",
    kebele: "",
    houseNumber: "",
    rooms: "",
    area: "",
    latitude: "",
    longitude: "",
  });

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

  const rows = data?.items ?? [];

  const woredas = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.woreda));
    return Array.from(s).sort();
  }, [rows]);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/properties", {
        code: form.code.trim() || undefined,
        type: form.type,
        category:
          form.type === "residential"
            ? form.category
            : form.category === "condominium"
              ? "condominium"
              : undefined,
        woreda: form.woreda,
        kebele: form.kebele,
        houseNumber: form.houseNumber,
        rooms: form.type === "residential" ? Number(form.rooms) : undefined,
        area: Number(form.area),
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      toast({ title: "Property created" });
      setOpen(false);
      setForm({
        code: "",
        type: "residential",
        category: "kebele",
        woreda: "Chiro City",
        kebele: "",
        houseNumber: "",
        rooms: "",
        area: "",
        latitude: "",
        longitude: "",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Failed to create property",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Home className="h-7 w-7 text-blue-600" />
            Properties
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Government-owned houses — search, filter, and open profiles
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!hasPermission("properties.write")}>
              Add property
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New property</DialogTitle>
            </DialogHeader>
            <form onSubmit={submitCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label>Code (optional)</Label>
                  <Input
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        type: v,
                        category:
                          v === "residential"
                            ? f.category === "none"
                              ? "kebele"
                              : f.category
                            : f.category === "condominium"
                              ? "condominium"
                              : "none",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, category: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {form.type === "residential" ? (
                        <>
                          <SelectItem value="saving">Saving</SelectItem>
                          <SelectItem value="kebele">Kebele</SelectItem>
                          <SelectItem value="condominium">
                            Condominium
                          </SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="none">
                            Standard commercial
                          </SelectItem>
                          <SelectItem value="condominium">
                            Condominium
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Woreda/City</Label>
                  <Input
                    value={form.woreda}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, woreda: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Kebele</Label>
                  <Input
                    value={form.kebele}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, kebele: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>House number</Label>
                  <Input
                    value={form.houseNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, houseNumber: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Area (m²)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.area}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, area: e.target.value }))
                    }
                    required
                  />
                </div>
                {form.type === "residential" ? (
                  <div className="col-span-2">
                    <Label>Rooms</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.rooms}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, rooms: e.target.value }))
                      }
                      required
                    />
                  </div>
                ) : null}
                <GpsLocationFields
                  latitude={form.latitude}
                  longitude={form.longitude}
                  onChange={(c) => setForm((f) => ({ ...f, ...c }))}
                />
              </div>
              <Button
                type="submit"
                disabled={!hasPermission("properties.write")}
                className="w-full"
              >
                Save
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>Filter by status and woreda</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search code, location..."
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
                <SelectValue placeholder="Woreda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All woredas</SelectItem>
                {woredas.map((w) => (
                  <SelectItem key={w} value={w}>
                    Woreda {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tenant / Buyer</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No properties
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.code ?? "—"}
                      </TableCell>
                      <TableCell>{row.location}</TableCell>
                      <TableCell className="capitalize">{row.type}</TableCell>
                      <TableCell className="capitalize">
                        {row.category ?? "—"}
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
                              <Link to={`/properties/${row.id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Link>
                            </DropdownMenuItem>
                            {hasPermission("properties.write") && (
                              <DropdownMenuItem asChild>
                                <Link to={`/properties/${row.id}?edit=1`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {hasPermission("properties.write") && (
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
                            )}
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
          description={`Delete property ${deleteTarget.code}? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await handleDelete(deleteTarget);
          }}
        />
      ) : null}
    </div>
  );
}
