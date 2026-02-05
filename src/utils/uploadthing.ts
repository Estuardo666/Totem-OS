import { generateUploadButton, generateUploadDropzone } from "@uploadthing/react";
import { createElement } from "react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

const RawUploadButton = generateUploadButton<OurFileRouter>();

export const UploadButton = ({ appearance, content, ...props }: any) => {
  const defaultAppearance = {
    button: "px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 text-sm font-medium shadow-sm",
    allowedContent: "text-xs text-muted-foreground",
  } as const;

  const defaultContent = {
    button: ({ ready }: { ready: boolean }) => (ready ? "Subir archivo" : "Preparando..."),
    allowedContent: "Archivo (máx. 4MB)",
  } as const;

  const mergedAppearance = { ...defaultAppearance, ...(appearance ?? {}) };
  const mergedContent = { ...defaultContent, ...(content ?? {}) };

  return createElement(RawUploadButton as any, { ...props, appearance: mergedAppearance, content: mergedContent });
};

export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
