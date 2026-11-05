import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { api, getApiErrorMessage } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Paginated } from "@/lib/pagination";

type Account = {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  role: string;
  isActive: boolean;
};
type Role = { role: string; label: string; permissions: string[] };
const emptyForm = {
  email: "",
  fullName: "",
  password: "",
  roles: [] as string[],
};

function RolesSelect({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: string[];
  value: string[];
  onChange: (roles: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer">
        Roles: {value.join(", ") || "None selected"}
      </summary>
      <fieldset
        disabled={disabled}
        aria-label="Assigned roles"
        className="max-h-52 space-y-2 overflow-auto pt-3"
      >
        {[...new Set([...options, ...value])].sort().map((name) => (
          <label key={name} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.includes(name)}
              disabled={!options.includes(name)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, name]
                    : value.filter((role) => role !== name),
                )
              }
            />
            {name}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

export default function UsersPage() {
  const { hasPermission, authMode, user } = useAuth();
  const qc = useQueryClient();
  const canUsers = hasPermission("users.read"),
    canWrite = hasPermission("users.write"),
    canRoles = hasPermission("roles.read"),
    canRolesWrite = hasPermission("roles.write");
  const [tab, setTab] = useState(canUsers ? "users" : "roles");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [grants, setGrants] = useState<string[]>([]);
  const [roleError, setRoleError] = useState("");
  const users = useQuery({
    queryKey: ["users", page, search],
    enabled: canUsers,
    queryFn: async () =>
      (
        await api.get<Paginated<Account>>("/users", {
          params: { page, pageSize: 10, q: search },
        })
      ).data,
  });
  const roles = useQuery({
    queryKey: ["roles"],
    enabled: canRoles,
    queryFn: async () => (await api.get<Role[]>("/users/roles/overview")).data,
  });
  const choices = useQuery({
    queryKey: ["assignable-roles"],
    enabled: canWrite,
    queryFn: async () =>
      (await api.get<Role[]>("/users/assignable-roles")).data,
  });
  const catalog = useQuery({
    queryKey: ["permission-catalog"],
    enabled: canRoles,
    queryFn: async () => (await api.get<string[]>("/users/roles/catalog")).data,
  });
  const save = useMutation({
    mutationFn: async () => {
      if (editing)
        return api.patch(`/users/${editing.id}`, {
          fullName: form.fullName,
          roles: form.roles,
          ...(authMode === "local"
            ? {
                email: form.email,
                ...(form.password ? { password: form.password } : {}),
              }
            : {}),
        });
      return api.post("/users", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      setForm(emptyForm);
      toast({
        title: "User saved",
        description: editing
          ? "Role changes take effect after the affected user signs out and signs in again."
          : "The user must change the temporary password at first sign-in.",
      });
    },
    onError: (e) => setError(getApiErrorMessage(e)),
  });
  const disable = useMutation({
    mutationFn: (account: Account) =>
      api.patch(`/users/${account.id}`, { isActive: !account.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e) =>
      toast({
        title: "Unable to change access",
        description: getApiErrorMessage(e),
        variant: "destructive",
      }),
  });
  const sync = useMutation({
    mutationFn: () => api.post("/users/roles/sync"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["assignable-roles"] });
      toast({
        title: "Roles imported",
        description: "New roles have no permissions until you grant them.",
      });
    },
    onError: (e) =>
      toast({
        title: "Unable to import roles",
        description: getApiErrorMessage(e),
        variant: "destructive",
      }),
  });
  const saveRole = useMutation({
    mutationFn: () =>
      selectedRole
        ? api.patch(`/users/roles/${encodeURIComponent(selectedRole)}`, {
            permissions: grants,
          })
        : api.post("/users/roles", { name: roleName, permissions: grants }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      qc.invalidateQueries({ queryKey: ["assignable-roles"] });
      setRoleOpen(false);
      toast({
        title: "Role permissions saved",
        description:
          "API checks use these permissions immediately. Refresh your session to update menus.",
      });
    },
    onError: (e) => setRoleError(getApiErrorMessage(e)),
  });
  const edit = (account: Account | null) => {
    setEditing(account);
    setForm(
      account
        ? {
            email: account.email,
            fullName: account.fullName,
            password: "",
            roles: [...account.roles],
          }
        : { ...emptyForm, roles: [] },
    );
    setError("");
    setOpen(true);
  };
  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Users, roles and permissions</h1>
        <p className="text-muted-foreground">
          Manage CHRMS access. Shared Chiro Auth credentials remain on the
          server.
        </p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canUsers && <TabsTrigger value="users">Users</TabsTrigger>}
          {canRoles && (
            <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  aria-label="Search users"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search users"
                />
                {canWrite && (
                  <Button onClick={() => edit(null)}>Create user</Button>
                )}
              </div>
              {users.isLoading && <p>Loading users...</p>}
              {users.error && (
                <p role="alert" className="text-destructive">
                  {getApiErrorMessage(users.error)}
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Roles</th>
                      <th>Access</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data?.items.map((account) => (
                      <tr key={account.id} className="border-t">
                        <td className="py-3">{account.fullName}</td>
                        <td>{account.email}</td>
                        <td>{account.roles.join(", ") || "No roles"}</td>
                        <td>{account.isActive ? "Active" : "Disabled"}</td>
                        <td className="space-x-2">
                          {canWrite && (
                            <>
                              <Button
                                variant="outline"
                                onClick={() => edit(account)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                disabled={
                                  disable.isPending || account.id === user?.id
                                }
                                onClick={() => disable.mutate(account)}
                              >
                                {account.isActive ? "Disable" : "Enable"}
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span>Page {page}</span>
                <Button
                  variant="outline"
                  disabled={!users.data || page * 10 >= users.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Roles & permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canRolesWrite && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setSelectedRole(null);
                      setRoleName("");
                      setGrants([]);
                      setRoleError("");
                      setRoleOpen(true);
                    }}
                  >
                    Create role
                  </Button>
                  {authMode === "keycloak" && (
                    <Button
                      variant="outline"
                      disabled={sync.isPending}
                      onClick={() => sync.mutate()}
                    >
                      Load Chiro Auth roles
                    </Button>
                  )}
                </div>
              )}
              {roles.error && (
                <p role="alert">{getApiErrorMessage(roles.error)}</p>
              )}
              {roles.isLoading && <p>Loading roles...</p>}
              {roles.data?.map((role) => (
                <div key={role.role} className="space-y-2 rounded border p-4">
                  <div className="flex justify-between">
                    <strong>{role.role}</strong>
                    {canRolesWrite && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedRole(role.role);
                          setRoleName(role.role);
                          setGrants([...role.permissions]);
                          setRoleError("");
                          setRoleOpen(true);
                        }}
                      >
                        Edit permissions
                      </Button>
                    )}
                  </div>
                  <p className="break-words text-sm text-muted-foreground">
                    {role.permissions.join(", ") || "No permissions granted"}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Create user"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (!editing && !form.roles.length) {
                setError("Select at least one role.");
                return;
              }
              save.mutate();
            }}
          >
            <div>
              <Label htmlFor="account-name">Full name *</Label>
              <Input
                id="account-name"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="account-email">Email *</Label>
              <Input
                id="account-email"
                type="email"
                required
                disabled={!!editing && authMode === "keycloak"}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {(!editing || authMode === "local") && (
              <div>
                <Label htmlFor="account-password">
                  {editing
                    ? "New password (optional)"
                    : "Initial temporary password *"}
                </Label>
                <Input
                  id="account-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required={!editing}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Avoid common or entirely numeric passwords. New Chiro Auth
                  accounts must change this password at first sign-in.
                </p>
              </div>
            )}
            <RolesSelect
              options={choices.data?.map((role) => role.role) ?? []}
              value={form.roles}
              onChange={(roles) => setForm({ ...form, roles })}
              disabled={save.isPending}
            />
            <p className="text-sm text-muted-foreground">
              Only roles within your grant permissions are available. Inherited
              group roles must be changed in Chiro Auth. Disabling access here
              affects only CHRMS.
            </p>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={save.isPending || choices.isLoading}
            >
              {save.isPending ? "Saving..." : "Save user"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedRole ? "Edit role permissions" : "Create role"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveRole.mutate();
            }}
          >
            <div>
              <Label htmlFor="role-name">Role name *</Label>
              <Input
                id="role-name"
                required
                disabled={!!selectedRole}
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
              />
            </div>
            <fieldset className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              <legend className="mb-2">Permissions</legend>
              {catalog.data?.map((permission) => (
                <label
                  key={permission}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={grants.includes(permission)}
                    disabled={!hasPermission(permission)}
                    onChange={(e) =>
                      setGrants(
                        e.target.checked
                          ? [...grants, permission]
                          : grants.filter((value) => value !== permission),
                      )
                    }
                  />
                  {permission}
                </label>
              ))}
            </fieldset>
            {roleError && (
              <p role="alert" className="text-destructive">
                {roleError}
              </p>
            )}
            <Button type="submit" disabled={saveRole.isPending}>
              Save role
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
