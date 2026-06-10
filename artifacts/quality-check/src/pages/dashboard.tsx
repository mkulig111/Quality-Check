import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "@/components/users-tab";
import { SpcTab } from "@/components/spc-tab";
import { InspectionTab } from "@/components/inspection-tab";
import { ChecksheetTab } from "@/components/checksheet-tab";
import { ExportTab } from "@/components/export-tab";
import { useLocation, useSearch } from "wouter";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, firestore } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Header } from "@/components/header";
import { Loader2 } from "lucide-react";

function DashboardTabs({ initialRole }: { initialRole: string | null }) {
  const [, navigate] = useLocation();
  const [user, loading] = useAuthState(auth);
  const [role, setRole] = React.useState(initialRole);

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/");
      return;
    }

    if (user && !role) {
      const userDocRef = doc(firestore, "users", user.uid);
      getDoc(userDocRef).then((userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRole(userData.role);
        } else {
          navigate("/");
        }
      });
    }
  }, [user, loading, role, navigate]);

  if (loading || !role) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
  const search = useSearch();
  const params = new URLSearchParams(search);
  const role = params.get("role");

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="container py-8">
          <DashboardTabs initialRole={role} />
        </div>
      </main>
    </div>
  );
}
