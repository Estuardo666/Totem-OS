import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/auth";

const f = createUploadthing();

// Middleware para autenticar al usuario antes de permitir subidas
const authMiddleware = async (req: any) => {
  const session = await auth();
  
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return { userId: session.user.id };
};

// Definición del router
export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      console.log("Upload complete para usuario:", metadata.userId);
      console.log("Archivo:", file.url);
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
