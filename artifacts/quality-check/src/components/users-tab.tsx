import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

interface AppUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
}

export function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = React.useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<AppUser[]>("/api/users");
      setUsers(data);
    } catch {
      toast({ title: "Error", description: "Could not fetch users.", variant: "destructive" });
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
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      toast({ title: "Role Updated", description: `User role changed to ${role}.` });
    } catch {
      toast({ title: "Error", description: "Could not update role.", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user roles. Users must sign in with Replit to appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center p-8">No users found.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {user.firstName || user.lastName
                        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                        : user.email ?? "Unknown"}
                    </p>
                    {user.email && (
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {updatingId === user.id && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    <Select
                      value={user.role}
                      onValueChange={(role) => handleRoleChange(user.id, role)}
                      disabled={updatingId === user.id}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inspector">Inspector</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
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
