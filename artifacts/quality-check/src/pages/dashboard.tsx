import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "@/components/users-tab";
import { SpcTab } from "@/components/spc-tab";
import { InspectionTab } from "@/components/inspection-tab";
import { ChecksheetTab } from "@/components/checksheet-tab";
import { ExportTab } from "@/components/export-tab";
import { useLocation } from "wouter";
import { Header } from "@/components/header";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function DashboardTabs() {
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const role = user.role ?? "inspector";
  const defaultTab = role === "manager" ? "users" : "inspection";

  return (
    <Tabs defaultValue={defaultTab} className="w-full flex flex-col items-center">
      <TabsList className="w-fit">
        {role === "manager" && (
          <TabsTrigger value="users">Users</TabsTrigger>
        )}
        {role === "manager" && (
          <TabsTrigger value="checksheet">Check Sheet</TabsTrigger>
        )}
        {role === "manager" && (
          <TabsTrigger value="spc">SPC</TabsTrigger>
        )}
        <TabsTrigger value="inspection">Inspection</TabsTrigger>
        {role === "manager" && (
          <TabsTrigger value="export">Export</TabsTrigger>
        )}
      </TabsList>
      <div className="w-full mt-4">
        {role === "manager" && (
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        )}
        {role === "manager" && (
          <TabsContent value="checksheet">
            <ChecksheetTab />
          </TabsContent>
        )}
        {role === "manager" && (
          <TabsContent value="spc">
            <SpcTab />
          </TabsContent>
        )}
        <TabsContent value="inspection">
          <InspectionTab />
        </TabsContent>
        {role === "manager" && (
          <TabsContent value="export">
            <ExportTab />
          </TabsContent>
        )}
      </div>
    </Tabs>
  );
}

export default function DashboardPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          <DashboardTabs />
        </div>
      </main>
    </div>
  );
}
