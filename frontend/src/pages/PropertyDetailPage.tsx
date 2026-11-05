import { useAuth } from "@/contexts/AuthContext";
import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/chrms/StatusBadge";
import { PaymentSummaryCard } from "@/components/chrms/PaymentSummaryCard";
import { GpsLocationFields } from "@/components/chrms/GpsLocationFields";
import { api, getApiErrorMessage } from "@/services/api";
import { ArrowLeft, Pencil, ExternalLink } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

type DetailResponse = {
  property: {
    id: string;
    code: string | null;
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
};

const emptyForm = {
  code: "",
  type: "residential",
  category: "kebele",
  woreda: "",
  kebele: "",
  houseNumber: "",
  rooms: "",
  area: "",
  status: "available",
  latitude: "",
  longitude: "",
};

export default function PropertyDetailPage() {
  const { hasPermission } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, error } = useQuery({
    queryKey: ["property", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await api.get<DetailResponse>(`/properties/${id}`);
      return res.data;
    },
  });

  const fillForm = (p: DetailResponse["property"]) => {
    setForm({
      code: p.code ?? "",
      type: p.type,
      category: p.category ?? (p.type === "commercial" ? "none" : "kebele"),
      woreda: p.woreda,
      kebele: p.kebele,
      houseNumber: p.houseNumber,
      rooms: p.rooms != null ? String(p.rooms) : "",
      area: String(p.area),
      status: p.status,
      latitude: p.latitude != null ? String(p.latitude) : "",
      longitude: p.longitude != null ? String(p.longitude) : "",
    });
  };

  useEffect(() => {
    if (searchParams.get("edit") === "1" && data?.property) {
      fillForm(data.property);
      setEditOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, data, setSearchParams]);

  const openEdit = () => {
    if (!data?.property) return;
    fillForm(data.property);
    setEditOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await api.put(`/properties/${id}`, {
        code: form.code.trim() || null,
        type: form.type,
        category:
          form.type === "residential"
            ? form.category
            : form.category === "condominium"
              ? "condominium"
              : null,
        woreda: form.woreda,
        kebele: form.kebele,
        houseNumber: form.houseNumber,
        rooms: form.type === "residential" ? Number(form.rooms) : null,
        area: Number(form.area),
        status: form.status,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      });
      toast({ title: "Property updated" });
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["property", id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    } catch (err) {
      toast({
        title: "Update failed",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading property…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-destructive">
        {error ? getApiErrorMessage(error) : "Not found"}
      </p>
    );
  }

  const { property, tenant, sale, paymentSummary } = data;
  const mapsUrl =
    property.latitude != null && property.longitude != null
      ? `https://www.google.com/maps?q=${property.latitude},${property.longitude}`
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link to="/properties">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {property.code ?? property.houseNumber}
        </h1>
        <StatusBadge status={property.status} />
        <Button size="sm" variant="outline" onClick={openEdit}>
          <Pencil className="h-4 w-4 mr-1" />
          Edit
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Property info</CardTitle>
            <CardDescription>Registered asset details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="capitalize">{property.type}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span>{" "}
              <span className="capitalize">{property.category ?? "—"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Location:</span> Woreda{" "}
              {property.woreda}, Kebele {property.kebele}, #
              {property.houseNumber}
            </p>
            {property.type === "residential" ? (
              <p>
                <span className="text-muted-foreground">Rooms:</span>{" "}
                {property.rooms ?? "—"}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Area:</span>{" "}
              {property.area} m²
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">GPS:</span>{" "}
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
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Maps
                </a>
              ) : null}
            </p>
          </CardContent>
        </Card>

        {sale ? (
          <PaymentSummaryCard
            title="Sale installments"
            description={`Buyer: ${sale.buyer.fullName}`}
            total={sale.totalPrice}
            paid={sale.totalPaid}
            remaining={sale.remaining}
            completionPercentage={sale.completionPercentage}
          />
        ) : paymentSummary.context === "rental" && tenant ? (
          <Card>
            <CardHeader>
              <CardTitle>Rental collections</CardTitle>
              <CardDescription>
                Recorded payments for active lease
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                <span className="text-muted-foreground">Monthly rent:</span> ETB{" "}
                {tenant.rental.monthlyRent.toLocaleString()}
              </p>
              <p className="text-sm mt-2">
                <span className="text-muted-foreground">Total recorded:</span>{" "}
                ETB {paymentSummary.paid.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Payment summary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No active sale or rental payment summary.
            </CardContent>
          </Card>
        )}
      </div>

      {tenant ? (
        <Card>
          <CardHeader>
            <CardTitle>Tenant</CardTitle>
            <CardDescription>Current occupant (rented)</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{tenant.fullName}</p>
            <p>{tenant.phone}</p>
            {tenant.address ? <p>{tenant.address}</p> : null}
            {tenant.nationalId ? <p>National ID: {tenant.nationalId}</p> : null}
            {tenant.rental.agreementNumber ? (
              <p>Agreement: {tenant.rental.agreementNumber}</p>
            ) : null}
            <p>Rent ETB {tenant.rental.monthlyRent.toLocaleString()}</p>
            <StatusBadge status={tenant.rental.status} />
          </CardContent>
        </Card>
      ) : null}

      {sale ? (
        <Card>
          <CardHeader>
            <CardTitle>Sale</CardTitle>
            <CardDescription>Installment contract</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{sale.buyer.fullName}</p>
            <p>{sale.buyer.phone}</p>
            <p>
              Down ETB {sale.downPayment.toLocaleString()} ·{" "}
              {sale.durationMonths} months plan
            </p>
            <StatusBadge status={sale.status} />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit property</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Code (optional)</Label>
              <Input
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="Auto-kept if empty"
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
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {form.type === "residential" ? (
                    <>
                      <SelectItem value="saving">Saving</SelectItem>
                      <SelectItem value="kebele">Kebele</SelectItem>
                      <SelectItem value="condominium">Condominium</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="none">Standard commercial</SelectItem>
                      <SelectItem value="condominium">Condominium</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Woreda</Label>
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
                step="0.01"
                min={0}
                value={form.area}
                onChange={(e) =>
                  setForm((f) => ({ ...f, area: e.target.value }))
                }
                required
              />
            </div>
            {form.type === "residential" ? (
              <div>
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
            <div className={form.type === "residential" ? "" : "col-span-2"}>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="rented">Rented</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <GpsLocationFields
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(c) => setForm((f) => ({ ...f, ...c }))}
            />
            <div className="col-span-2">
              <Button
                type="submit"
                disabled={!hasPermission("properties.write")}
                className="w-full"
              >
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
