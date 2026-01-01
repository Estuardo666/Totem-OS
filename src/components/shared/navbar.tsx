"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { NotificationBell } from "./notification-bell";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-4 md:hidden">
      <div className="flex items-center">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menú</span>
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className="w-[85vw] max-w-[400px] p-0 bg-white/95 dark:bg-background/95 backdrop-blur-xl border-r-0 rounded-r-3xl"
          >
            <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
            <Sidebar 
              className="w-full h-full m-0 border-none shadow-none bg-transparent rounded-none"
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <Link href="/" className="ml-4 text-lg font-bold">
          Totem OS
        </Link>
      </div>
      <NotificationBell side="bottom" align="end" />
    </div>
  );
}

