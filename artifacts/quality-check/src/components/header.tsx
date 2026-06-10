import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Home } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { QualityCheckIcon } from "./quality-check-icon";

export function Header() {
  const { logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <div className="flex gap-6 md:gap-10">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <QualityCheckIcon className="h-6 w-6 text-primary" />
            <span className="inline-block font-bold">Quality Check</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <Button variant="outline" onClick={() => navigate("/")}>
            <Home className="mr-2 h-4 w-4" />
            Main Menu
          </Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </div>
    </header>
  );
}
