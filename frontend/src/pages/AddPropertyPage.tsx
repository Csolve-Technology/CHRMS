import { useAuth } from "@/contexts/AuthContext";
import { GpsLocationFields } from "@/components/chrms/GpsLocationFields";
import {
  SalePaymentFields,
  salePayloadFromForm,
  type SalePaymentFormValues,
} from "@/components/chrms/SalePaymentFields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  CONDO_ROOM_TYPES,
  roomsFromCondoRoomType,
} from "@/lib/condo-options";
import { KEBELES } from "@/lib/kebeles";
import { Paginated } from "@/lib/pagination";
import { api, getApiErrorMessage } from "@/services/api";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Home,
  Loader2,
  UserRound,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

type TenantOption = { id: string; fullName: string; status: string };

const emptyProperty = {
  type: "residential",
  category: "kebele",
  woreda: "Chiro City",
  kebele: "",
  houseNumber: "",
  blockNumber: "",
  roomType: "",
  rooms: "",
  area: "",
  latitude: "",
  longitude: "",
};

const emptyTenant = {
  fullName: "",
  gender: "male",
  phone: "",
  nationalId: "",
  familySize: "1",
  status: "active",
};

const emptyRent = {
  startDate: "",
  endDate: "",
  noFixedEnd: false,
  monthlyRent: "",
  deposit: "",
};

const emptySale: SalePaymentFormValues = {
  totalPrice: "",
  paymentMode: "partial",
  initialPaid: "",
  durationMonths: "12",
  startDate: "",
};

export default function AddPropertyPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [property, setProperty] = useState(emptyProperty);
  const [tenantMode, setTenantMode] = useState<"new" | "existing" | "none">(
    "none",
  );
  const [tenant, setTenant] = useState(emptyTenant);
  const [existingTenantId, setExistingTenantId] = useState("");
  const [offerType, setOfferType] = useState<"rent" | "sale" | "none">("none");
  const [rent, setRent] = useState(emptyRent);
  const [sale, setSale] = useState(emptySale);
  const [agreementFile, setAgreementFile] = useState<File | null>(null);

  const canWriteProperty = hasPermission("properties.write");
  const canWriteTenant = hasPermission("tenants.write");
  const canWriteRent = hasPermission("rentals.write");
  const canWriteSale = hasPermission("sales.write");

  const { data: tenants } = useQuery({
    queryKey: ["tenants", "options", "add-property"],
    enabled: tenantMode === "existing",
    queryFn: async () => {
      const res = await api.get<Paginated<TenantOption>>(
        "/tenants?page=1&pageSize=200",
      );
      return res.data.items;
    },
  });

  const activeTenants = useMemo(
    () => (tenants ?? []).filter((t) => t.status === "active"),
    [tenants],
  );

  if (!canWriteProperty) {
    return <Navigate to="/properties" replace />;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property.kebele) {
      toast({
        title: "Kebele required",
        description: "Select a kebele from the list.",
        variant: "destructive",
      });
      return;
    }
    if (offerType === "rent" && !canWriteRent) {
      toast({
        title: "Missing permission",
        description: "You cannot create rental agreements.",
        variant: "destructive",
      });
      return;
    }
    if (offerType === "sale" && !canWriteSale) {
      toast({
        title: "Missing permission",
        description: "You cannot create sale agreements.",
        variant: "destructive",
      });
      return;
    }
    if (offerType !== "none" && tenantMode === "none") {
      toast({
        title: "Tenant required for agreement",
        description:
          "Register or assign a tenant/buyer before creating a rent or sale agreement, or choose Property only.",
        variant: "destructive",
      });
      return;
    }
    if (tenantMode === "new" && !canWriteTenant) {
      toast({
        title: "Missing permission",
        description: "You cannot register tenants.",
        variant: "destructive",
      });
      return;
    }
    if (tenantMode === "existing" && !existingTenantId) {
      toast({
        title: "Select a tenant",
        description: "Choose an existing tenant or register a new one.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    let propertyId: string | null = null;
    let tenantId: string | null = null;

    try {
      const isCondo = property.category === "condominium";
      const roomsFromType = isCondo
        ? roomsFromCondoRoomType(property.roomType)
        : undefined;
      const roomsValue =
        roomsFromType != null
          ? roomsFromType
          : property.type === "residential" && property.rooms.trim() !== ""
            ? Number(property.rooms)
            : undefined;

      if (isCondo && !property.blockNumber.trim()) {
        toast({
          title: "Block number required",
          description: "Enter the condominium block number.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
      if (isCondo && !property.roomType) {
        toast({
          title: "Room type required",
          description: "Select Studio, 1 Bedroom, 2 Bedroom, or 3 Bedroom.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const propertyRes = await api.post<{ id: string }>("/properties", {
        type: property.type,
        category:
          property.type === "residential"
            ? property.category
            : property.category === "condominium"
              ? "condominium"
              : undefined,
        woreda: property.woreda,
        kebele: property.kebele,
        houseNumber: property.houseNumber,
        blockNumber: isCondo ? property.blockNumber.trim() : undefined,
        roomType: isCondo ? property.roomType : undefined,
        rooms: roomsValue,
        area: Number(property.area),
        latitude: property.latitude ? Number(property.latitude) : undefined,
        longitude: property.longitude ? Number(property.longitude) : undefined,
      });
      propertyId = propertyRes.data.id;

      if (tenantMode === "existing") {
        tenantId = existingTenantId;
      } else if (tenantMode === "new") {
        const tenantRes = await api.post<{ id: string }>("/tenants", {
          fullName: tenant.fullName,
          gender: tenant.gender,
          phone: tenant.phone,
          nationalId: tenant.nationalId || undefined,
          familySize: Number(tenant.familySize),
          status: tenant.status,
        });
        tenantId = tenantRes.data.id;
      }

      if (offerType === "rent" && tenantId) {
        if (!rent.noFixedEnd && !rent.endDate) {
          toast({
            title: "End date required",
            description:
              "Select an end date or mark the agreement as Unknown / No Fixed End Date.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        const fd = new FormData();
        fd.append("propertyId", propertyId);
        fd.append("tenantId", tenantId);
        fd.append("startDate", rent.startDate);
        if (!rent.noFixedEnd && rent.endDate) fd.append("endDate", rent.endDate);
        fd.append("monthlyRent", rent.monthlyRent);
        if (agreementFile) fd.append("agreementFile", agreementFile);
        await api.post("/rentals", fd);
      }

      if (offerType === "sale" && tenantId) {
        const salePayload = salePayloadFromForm(sale);
        if (
          sale.paymentMode === "partial" &&
          salePayload.downPayment >= salePayload.totalPrice
        ) {
          toast({
            title: "Invalid initial payment",
            description:
              "For partially paid sales, the initial amount must be less than the total price.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        await api.post("/sales", {
          propertyId,
          buyerId: tenantId,
          ...salePayload,
        });
      }

      const parts = ["Property saved"];
      if (tenantId) parts.push("tenant linked");
      if (offerType === "rent") parts.push("rental agreement created");
      if (offerType === "sale") parts.push("sale agreement created");
      toast({
        title: "Registration complete",
        description: `${parts.join(", ")}.`,
      });
      navigate(`/housing/property/${propertyId}`, { replace: true });
    } catch (err) {
      toast({
        title: "Could not complete registration",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
      if (propertyId) {
        navigate(`/housing/property/${propertyId}`, { replace: true });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" asChild>
            <Link to="/properties">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to property list
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Register property
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Capture the house, optionally register or assign a tenant, then
            create a rent or sale agreement. Linked records appear on the
            property, tenant, and rent/sell lists.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Home, label: "1. Property", hint: "House details" },
          { icon: UserRound, label: "2. Tenant", hint: "Occupant or buyer" },
          { icon: FileText, label: "3. Agreement", hint: "Rent or sale" },
        ].map(({ icon: Icon, label, hint }) => (
          <div
            key={label}
            className="flex items-center gap-3 rounded-xl border bg-card/80 px-4 py-3 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="bg-muted/40">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Home className="h-5 w-5 text-primary" />
              Property
            </CardTitle>
            <CardDescription>
              Same fields as the property module — tracked by house number
              within city and kebele.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select
                value={property.type}
                onValueChange={(v) =>
                  setProperty((f) => ({
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
                value={property.category}
                onValueChange={(v) =>
                  setProperty((f) => ({
                    ...f,
                    category: v,
                    blockNumber: v === "condominium" ? f.blockNumber : "",
                    roomType: v === "condominium" ? f.roomType : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {property.type === "residential" ? (
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
              <Label>City</Label>
              <Input
                value={property.woreda}
                onChange={(e) =>
                  setProperty((f) => ({ ...f, woreda: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <Label>Kebele</Label>
              <Select
                value={property.kebele || undefined}
                onValueChange={(v) =>
                  setProperty((f) => ({ ...f, kebele: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select kebele" />
                </SelectTrigger>
                <SelectContent>
                  {KEBELES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>House number</Label>
              <Input
                value={property.houseNumber}
                onChange={(e) =>
                  setProperty((f) => ({ ...f, houseNumber: e.target.value }))
                }
                placeholder="Primary identifier for this house"
                required
              />
            </div>
            {property.category === "condominium" ? (
              <>
                <div>
                  <Label>Block number</Label>
                  <Input
                    value={property.blockNumber}
                    onChange={(e) =>
                      setProperty((f) => ({
                        ...f,
                        blockNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. Block A"
                    required
                  />
                </div>
                <div>
                  <Label>Room type</Label>
                  <Select
                    value={property.roomType || undefined}
                    onValueChange={(v) =>
                      setProperty((f) => ({
                        ...f,
                        roomType: v,
                        rooms: String(roomsFromCondoRoomType(v) ?? ""),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDO_ROOM_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <div>
              <Label>Area (m²)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={property.area}
                onChange={(e) =>
                  setProperty((f) => ({ ...f, area: e.target.value }))
                }
                required
              />
            </div>
            {property.type === "residential" &&
            property.category !== "condominium" ? (
              <div>
                <Label>Rooms (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  value={property.rooms}
                  onChange={(e) =>
                    setProperty((f) => ({ ...f, rooms: e.target.value }))
                  }
                  placeholder="Leave blank if unknown"
                />
              </div>
            ) : property.category !== "condominium" ? (
              <div />
            ) : null}
            <div className="sm:col-span-2">
              <GpsLocationFields
                latitude={property.latitude}
                longitude={property.longitude}
                onChange={(c) => setProperty((f) => ({ ...f, ...c }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="bg-muted/40">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserRound className="h-5 w-5 text-primary" />
              Tenant / Buyer
            </CardTitle>
            <CardDescription>
              Optional — register a new person, assign an existing tenant, or
              skip. A tenant/buyer is needed only when creating a rent or sale
              agreement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["new", "Register new", "Create a tenant record"],
                  ["existing", "Assign existing", "Use a tenant already in CHRMS"],
                  ["none", "Skip for now", "Property only — no occupant yet"],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTenantMode(value);
                    if (value === "none") setOfferType("none");
                  }}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    tenantMode === value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <p className="font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </button>
              ))}
            </div>

            {tenantMode === "existing" ? (
              <div>
                <Label>Existing tenant</Label>
                <Select
                  value={existingTenantId}
                  onValueChange={setExistingTenantId}
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
            ) : null}

            {tenantMode === "new" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Full name</Label>
                  <Input
                    value={tenant.fullName}
                    onChange={(e) =>
                      setTenant((f) => ({ ...f, fullName: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={tenant.gender}
                    onValueChange={(v) =>
                      setTenant((f) => ({ ...f, gender: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={tenant.phone}
                    onChange={(e) =>
                      setTenant((f) => ({ ...f, phone: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>National ID</Label>
                  <Input
                    value={tenant.nationalId}
                    onChange={(e) =>
                      setTenant((f) => ({ ...f, nationalId: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Family size</Label>
                  <Input
                    type="number"
                    min={0}
                    value={tenant.familySize}
                    onChange={(e) =>
                      setTenant((f) => ({ ...f, familySize: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            ) : null}

            {tenantMode === "none" ? (
              <p className="text-sm text-muted-foreground">
                No tenant will be created. Rent and sale agreements stay
                unavailable until you register or assign someone.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="bg-muted/40">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Agreement
            </CardTitle>
            <CardDescription>
              Offer the house for rent or sale using the existing agreement
              fields, or skip and leave the property available.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["rent", "Rent", "Create rental agreement"],
                  ["sale", "Sale", "Create installment sale"],
                  ["none", "Property only", "No agreement yet"],
                ] as const
              ).map(([value, title, desc]) => {
                const needsTenant = value !== "none" && tenantMode === "none";
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={needsTenant}
                    onClick={() => setOfferType(value)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      offerType === value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : needsTenant
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {needsTenant
                        ? "Choose a tenant/buyer first"
                        : desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <Separator />

            {offerType === "rent" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={rent.startDate}
                    onChange={(e) =>
                      setRent((f) => ({ ...f, startDate: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End date</Label>
                  <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">
                        Unknown / No Fixed End Date
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Leave the lease open-ended
                      </p>
                    </div>
                    <Switch
                      checked={rent.noFixedEnd}
                      onCheckedChange={(checked) =>
                        setRent((f) => ({
                          ...f,
                          noFixedEnd: checked,
                          endDate: checked ? "" : f.endDate,
                        }))
                      }
                    />
                  </div>
                  {!rent.noFixedEnd ? (
                    <Input
                      type="date"
                      value={rent.endDate}
                      onChange={(e) =>
                        setRent((f) => ({ ...f, endDate: e.target.value }))
                      }
                      required
                    />
                  ) : null}
                </div>
                <div>
                  <Label>Monthly rent (ETB)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rent.monthlyRent}
                    onChange={(e) =>
                      setRent((f) => ({ ...f, monthlyRent: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Agreement file</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) =>
                      setAgreementFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>
            ) : null}

            {offerType === "sale" ? (
              <SalePaymentFields value={sale} onChange={setSale} />
            ) : null}

            {offerType === "none" ? (
              <p className="text-sm text-muted-foreground">
                The property will be saved as available. You can create a rent or
                sale agreement later from the rent/sell lists.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-4 shadow-sm">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            <p>
              Preview:{" "}
              <span className="font-medium text-foreground">
                {property.houseNumber
                  ? propertyLabel(property)
                  : "House number pending"}
              </span>
              {tenantMode !== "none" ? " · Tenant" : ""}
              {offerType === "rent"
                ? " · Rental agreement"
                : offerType === "sale"
                  ? " · Sale agreement"
                  : " · Property only"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" asChild disabled={saving}>
              <Link to="/properties">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save registration"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
