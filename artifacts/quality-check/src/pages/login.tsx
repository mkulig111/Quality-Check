import * as React from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QualityCheckIcon } from "@/components/quality-check-icon";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, isLoading, login } = useAuth();

  React.useEffect(() => {
    if (!isLoading && user) {
      navigate("/dashboard");
    }
  }, [user, isLoading, navigate]);

  if (isLoading || user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading, please wait...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <QualityCheckIcon className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold">Quality Check</CardTitle>
          </div>
          <CardDescription>
            Sign in to access your quality control dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={login} className="w-full" size="lg">
            Sign in with Replit
          </Button>
        </CardContent>
        <CardFooter className="flex-col text-center text-xs">
          <p className="w-full text-muted-foreground">
            © {new Date().getFullYear()} Quality Check Inc. All rights
            reserved.
          </p>
          <p className="w-full text-muted-foreground">Made by Mateusz Kulig.</p>
        </CardFooter>
      </Card>
    </main>
  );
}
