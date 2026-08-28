"use client";

import { useSyncExternalStore } from "react";
import {
  TOTEM_SHELL_MARKER_ATTRIBUTE,
  TOTEM_SHELL_MARKER_FLAG,
} from "@/lib/totem-shell-contract";

/**
 * `true` solo dentro de la app nativa `TotemOS-iOS`, que marca el documento con
 * un `WKUserScript` antes de renderizar. Safari, la PWA y el escritorio siempre
 * devuelven `false` y conservan los componentes web.
 */
export function isNativeShellDocument(): boolean {
  if (typeof document === "undefined") return false;
  const scope = window as unknown as Record<string, unknown>;
  if (scope[TOTEM_SHELL_MARKER_FLAG] === true) {
    return true;
  }
  return document.documentElement.getAttribute(TOTEM_SHELL_MARKER_ATTRIBUTE) === "1";
}

const subscribe = () => () => {};

export function useNativeShell(): boolean {
  return useSyncExternalStore(subscribe, isNativeShellDocument, () => false);
}
