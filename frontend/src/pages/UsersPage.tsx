import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmActionDialog } from "@/components/chrms/ConfirmActionDialog";
import { TablePagination } from "@/components/chrms/TablePagination";
import { useAuth } from "@/contexts/AuthContext";
import { api, getApiErrorMessage } from "@/services/api";
import { buildPageParams, Paginated } from "@/lib/pagination";
import { toast } from "@/hooks/use-toast";
import {
  UserPlus,
  Shield,
  Search,
  MoreHorizontal,
  Trash2,
  Edit,
  Users as UsersIcon,
  Crown,
  User,
} from "lucide-react";
import { format } from "date-fns";

type ChrmsUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "HOUSING_OFFICER";
  createdAt: string;
  updatedAt: string;
};

type RoleOverview = {
  role: string;
  label: string;
  permissions: string[];
};

const ROLE_LABEL: Record<ChrmsUser["role"], string> = {
  ADMIN: "Administrator",
  HOUSING_OFFICER: "Housing Officer",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export default function UsersPage() {
  const { user: currentUser, authMode } = useAuth();
  const localIdentity = authMode === "local";
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ChrmsUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChrmsUser | null>(null);

  const [createForm, setCreateForm] = useState({
    email: "",
    fullName: "",
    password: "",
    role: "HOUSING_OFFICER" as ChrmsUser["role"],
  });

  const [editForm, setEditForm] = useState({
    email: "",
    fullName: "",
    role: "HOUSING_OFFICER" as ChrmsUser["role"],
    password: "",
  });

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const usersParams = useMemo(
    () =>
      buildPageParams({
        page,
        extra: {
          q: debouncedQ || undefined,
          role: roleFilter !== "all" ? roleFilter : undefined,
        },
      }),
    [page, debouncedQ, roleFilter],
  );

  const { data: usersPage, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["users", usersParams],
    queryFn: async () => {
      const res = await api.get<Paginated<ChrmsUser>>(`/users?${usersParams}`);
      return res.data;
    },
  });

  const users = usersPage?.items ?? [];

  const { data: rolesOverview = [], isLoading: rolesLoading } = useQuery({
    queryKey: ["users", "roles-overview"],
    queryFn: async () => {
      const res = await api.get<RoleOverview[]>("/users/roles/overview");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!localIdentity) {
        throw new Error("Manage accounts, roles and passwords in Chiro Auth.");
      }
      await api.post("/users", {
        email: createForm.email.trim(),
        fullName: createForm.fullName.trim(),
        password: createForm.password,
        role: createForm.role,
      });
    },
    onSuccess: () => {
      toast({ title: "User created" });
      qc.invalidateQueries({ queryKey: ["users"] });
      setAddOpen(false);
      setCreateForm({
        email: "",
        fullName: "",
        password: "",
        role: "HOUSING_OFFICER",
      });
    },
    onError: (err) => {
      toast({
        title: "Failed to create user",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const body: {
        email?: string;
        fullName?: string;
        role?: ChrmsUser["role"];
        password?: string;
      } = {
        fullName: editForm.fullName.trim(),
      };
      if (localIdentity) {
        body.email = editForm.email.trim();
        body.role = editForm.role;
        if (editForm.password.trim()) body.password = editForm.password;
      }
      await api.patch(`/users/${editing.id}`, body);
    },
    onSuccess: () => {
      toast({ title: "User updated" });
      qc.invalidateQueries({ queryKey: ["users"] });
      setEditOpen(false);
      setEditing(null);
      setEditForm({ email: "", fullName: "", role: "HOUSING_OFFICER", password: "" });
    },
    onError: (err) => {
      toast({
        title: "Failed to update user",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!localIdentity) {
        throw new Error("Manage accounts, roles and passwords in Chiro Auth.");
      }
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      toast({ title: "User deleted" });
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast({
        title: "Failed to delete user",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
      setDeleteTarget(null);
    },
  });

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === "ADMIN").length;
    const officers = users.filter((u) => u.role === "HOUSING_OFFICER").length;
    return {
      total: usersPage?.total ?? users.length,
      admins,
      officers,
    };
  }, [users, usersPage?.total]);

  const openEdit = (u: ChrmsUser) => {
    setEditing(u);
    setEditForm({
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      password: "",
    });
    setEditOpen(true);
  };

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!localIdentity) {
      toast({
        title: "Managed in Chiro Auth",
        description: "Create users and assign ADMIN / HOUSING_OFFICER roles in Chiro Auth.",
        variant: "destructive",
      });
      return;
    }
    if (
      !createForm.email.trim() ||
      !createForm.fullName.trim() ||
      createForm.password.length < 8
    ) {
      toast({
        title: "Check form",
        description: "Email, full name, and password (min 8 characters) are required.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.fullName.trim()) {
      toast({
        title: "Check form",
        description: "Full name is required.",
        variant: "destructive",
      });
      return;
    }
    if (localIdentity && !editForm.email.trim()) {
      toast({
        title: "Check form",
        description: "Email and full name are required.",
        variant: "destructive",
      });
      return;
    }
    if (localIdentity && editForm.password && editForm.password.length < 8) {
      toast({
        title: "Invalid password",
        description: "New password must be at least 8 characters, or leave blank.",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate();
  };

  const getRoleIcon = (role: ChrmsUser["role"]) => {
    if (role === "ADMIN")
      return <Crown className="h-4 w-4 text-amber-500" />;
    return <User className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User management</h1>
          <p className="text-muted-foreground">
            {localIdentity
              ? "Create and manage CHRMS accounts. Roles are fixed (Administrator, Housing Officer)."
              : "Directory of CHRMS profiles. Create accounts and assign roles in Chiro Auth."}
          </p>
        </div>
        {localIdentity ? (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add user</DialogTitle>
                <DialogDescription>
                  New users sign in with email and the password you set here.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitCreate} className="space-y-4">
                <div>
                  <Label>Full name</Label>
                  <Input
                    value={createForm.fullName}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, fullName: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={createForm.role}
                    onValueChange={(v) =>
                      setCreateForm((f) => ({
                        ...f,
                        role: v as ChrmsUser["role"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOUSING_OFFICER">Housing Officer</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Saving…" : "Create user"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <Button asChild variant="outline">
            <a
              href="https://auth.chirocity.gov.et"
              target="_blank"
              rel="noreferrer"
            >
              <Shield className="mr-2 h-4 w-4" />
              Open Chiro Auth
            </a>
          </Button>
        )}
      </div>

      {!localIdentity ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            AUTH_MODE is keycloak, so passwords, email, roles, create, and delete are managed in{" "}
            <a
              className="underline underline-offset-2 text-foreground"
              href="https://auth.chirocity.gov.et"
              target="_blank"
              rel="noreferrer"
            >
              Chiro Auth
            </a>
            . Assign client roles <code className="text-xs">ADMIN</code> or{" "}
            <code className="text-xs">HOUSING_OFFICER</code> on <code className="text-xs">chrms-api</code>.
            Profiles appear here after the first successful sign-in.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Housing officers</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.officers}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Accounts</CardTitle>
                  <CardDescription>All users who can sign in to CHRMS</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 w-64 max-w-full"
                    />
                  </div>
                  <Select
                    value={roleFilter}
                    onValueChange={(v) => {
                      setRoleFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                      <SelectItem value="HOUSING_OFFICER">Housing Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {usersError ? (
                <p className="text-destructive text-sm">{getApiErrorMessage(usersError)}</p>
              ) : usersLoading ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p>
              ) : users.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No users match</p>
              ) : (
                <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {initials(u.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{u.fullName}</div>
                                <div className="text-sm text-muted-foreground">{u.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getRoleIcon(u.role)}
                              <Badge variant="outline">{ROLE_LABEL[u.role]}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(u.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  {localIdentity ? "Edit" : "Edit display name"}
                                </DropdownMenuItem>
                                {localIdentity ? (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    disabled={u.id === currentUser?.id}
                                    onClick={() => setDeleteTarget(u)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {usersPage ? (
                  <TablePagination
                    page={usersPage.page}
                    pageSize={usersPage.pageSize}
                    total={usersPage.total}
                    totalPages={usersPage.totalPages}
                    onPageChange={setPage}
                  />
                ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Roles & permissions</CardTitle>
              <CardDescription>
                CHRMS uses two built-in roles. Permissions are enforced by the API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <p className="text-muted-foreground text-sm">Loading…</p>
              ) : (
                <div className="space-y-6">
                  {rolesOverview.map((row) => (
                    <div
                      key={row.role}
                      className="rounded-lg border p-4 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        {row.role === "ADMIN" ? (
                          <Crown className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Shield className="h-5 w-5 text-muted-foreground" />
                        )}
                        <h3 className="font-semibold text-lg">{row.label}</h3>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {row.role}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {row.permissions.map((p) => (
                          <Badge key={p} variant="outline" className="text-xs font-normal">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              {localIdentity
                ? "Update profile, role, or set a new password."
                : "Update the display name stored in CHRMS. Email, role, and password are managed in Chiro Auth."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <Label>Full name</Label>
              <Input
                value={editForm.fullName}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, fullName: e.target.value }))
                }
                required
              />
            </div>
            {localIdentity ? (
              <>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, email: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={editForm.password}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, password: e.target.value }))
                    }
                    placeholder="Leave blank to keep current password"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(v) =>
                      setEditForm((f) => ({ ...f, role: v as ChrmsUser["role"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOUSING_OFFICER">Housing Officer</SelectItem>
                      <SelectItem value="ADMIN">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div>
                <Label>Email</Label>
                <Input type="email" value={editForm.email} disabled />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
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
          title="Delete user"
          description={`Remove ${deleteTarget.fullName} (${deleteTarget.email})? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteMutation.mutateAsync(deleteTarget.id);
          }}
        />
      ) : null}
    </div>
  );
}
