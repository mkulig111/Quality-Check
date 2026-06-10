
"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersTab } from "@/components/users-tab";
import { SpcTab } from "@/components/spc-tab";
import { InspectionTab } from "@/components/inspection-tab";
import { ChecksheetTab } from "@/components/checksheet-tab";
import { ExportTab } from "@/components/export-tab";
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "@/lib/firebase";

function DashboardTabs({ initialRole }: { initialRole: string | null }) {
  const router = useRouter();
  const [user, loading] = useAuthState(auth);
  const [role, setRole] = React.useState(initialRole);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (loading || !isClient) return;
    if (!user) {
      router.push('/');
      return;
    }

    if (user && !role) {
      const userDocRef = doc(firestore, "users", user.uid);
      getDoc(userDocRef).then(userDoc => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRole(userData.role);
          // Update URL without reloading page
          router.replace(`/dashboard?role=${userData.role}`, { scroll: false });
        } else {
            router.push('/'); // also redirect if role not found
        }
      });
    }
  }, [user, loading, role, router, isClient]);

  if (!isClient || loading || !role) {
    return <div>Loading...</div>;
  }

  const defaultTab = role === 'manager' ? "users" : "inspection";

  return (
    <Tabs defaultValue={defaultTab} className="w-full flex flex-col items-center">
      <TabsList className="w-fit">
        {role === 'manager' && <TabsTrigger value="users">Users</TabsTrigger>}
        {role === 'manager' && <TabsTrigger value="checksheet">Check Sheet</TabsTrigger>}
        {role === 'manager' && <TabsTrigger value="spc">SPC</TabsTrigger>}
        <TabsTrigger value="inspection">Inspection</TabsTrigger>
        {role === 'manager' && <TabsTrigger value="export">Export</TabsTrigger>}
      </TabsList>
      <div className="w-full mt-4">
        {role === 'manager' && (
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
        )}
        {role === 'manager' && (
          <TabsContent value="checksheet">
            <ChecksheetTab />
          </TabsContent>
        )}
        {role === 'manager' && (
          <TabsContent value="spc">
            <SpcTab />
          </TabsContent>
        )}
        <TabsContent value="inspection">
          <InspectionTab />
        </TabsContent>
        {role === 'manager' && (
          <TabsContent value="export">
            <ExportTab />
          </TabsContent>
        )}
      </div>
    </Tabs>
  )
}

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get('role');
  return <DashboardTabs initialRole={role} />;
}


export default function DashboardPage() {
  return (
    <div className="container py-8">
      <React.Suspense fallback={<div>Loading...</div>}>
        <DashboardPageContent />
      </React.Suspense>
    </div>
  );
}
