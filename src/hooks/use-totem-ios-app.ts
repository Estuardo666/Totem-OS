"use client";

import { useEffect, useState } from "react";
import { isTotemIOSAppUserAgent } from "@/lib/totem-ios-client";

export function useTotemIOSApp(): boolean {
  const [isTotemIOSApp, setIsTotemIOSApp] = useState(false);

  useEffect(() => {
    setIsTotemIOSApp(isTotemIOSAppUserAgent());
  }, []);

  return isTotemIOSApp;
}
