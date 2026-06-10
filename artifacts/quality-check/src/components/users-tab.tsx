import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Eye, EyeOff, Loader2, Plus, Trash2, UserPlus } from "lucide-react";

interface AppUser {
  id: string;
  username: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
}

interface CreateUserForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "inspector" | "manager";
}

const emptyForm: CreateUserForm = {
  username: "",
  password: "",
  firstName: "",
  lastName: "",
  role: "inspector",
};

export function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<CreateUserForm>(emptyForm);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<AppUser[]>("/api/users");
      setUsers(data);
    } catch {
      toast({
        title: "Error",
        description: "Could not fetch users.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (userId: string, role: string) => {
    setUpdatingId(userId);
    try {
      await api.patch(`/api/users/${userId}/role`, { role });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role } : u)),
      );
      toast({ title: "Role Updated", description: `Role changed to ${role}.` });
    } catch {
      toast({
        title: "Error",
        description: "Could not update role.",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (userId: string, displayName: string) => {
    if (!confirm(`Delete user "${displayName}"? This cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      await api.delete(`/api/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast({ title: "User deleted" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message ?? "Could not delete user.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) return;
    setIsCreating(true);
    try {
      const newUser = await api.post<AppUser>("/api/users", {
        username: form.username.trim(),
        password: form.password,
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        role: form.role,
      });
      setUsers((prev) => [...prev, newUser]);
      setForm(emptyForm);
      setDialogOpen(false);
      toast({
        title: "User created",
        description: `"${form.username}" can now sign in.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message ?? "Could not create user.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const displayName = (u: AppUser) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.username ||
    u.email ||
    "Unknown";

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Manage accounts. Create users with a username and password.
            </CardDescription>
          </div>
          <Dialog
            open={dialogOpen}
            onOpenChange={(o) => {
              setDialogOpen(o);
              if (!o) setForm(emptyForm);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create new user</DialogTitle>
                <DialogDescription>
                  The user will sign in with the username and password you set
                  here.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="cu-first">First name</Label>
                    <Input
                      id="cu-first"
                      value={form.firstName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, firstName: e.target.value }))
                      }
                      placeholder="Jan"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cu-last">Last name</Label>
                    <Input
                      id="cu-last"
                      value={form.lastName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, lastName: e.target.value }))
                      }
                      placeholder="Kowalski"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cu-username">
                    Username <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="cu-username"
                    value={form.username}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="jan.kowalski"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cu-password">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="cu-password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cu-role">Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        role: v as "inspector" | "manager",
                      }))
                    }
                  >
                    <SelectTrigger id="cu-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inspector">Inspector</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center p-8">
              No users yet. Use "Add User" to create the first account.
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{displayName(user)}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{user.username ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {updatingId === user.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <Select
                      value={user.role}
                      onValueChange={(role) =>
                        handleRoleChange(user.id, role)
                      }
                      disabled={updatingId === user.id}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inspector">Inspector</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={deletingId === user.id}
                      onClick={() =>
                        handleDelete(user.id, displayName(user))
                      }
                    >
                      {deletingId === user.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
