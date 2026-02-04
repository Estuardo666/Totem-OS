import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/auth";

const f = createUploadthing();

// Middleware para autenticar al usuario antes de permitir subidas
const authMiddleware = async () => {
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
  brandLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      console.log("Brand logo upload complete para usuario:", metadata.userId);
      console.log("Archivo:", file.url);
      return { uploadedBy: metadata.userId };
    }),
  favicon: f({ image: { maxFileSize: "2MB", maxFileCount: 1 } })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      console.log("Favicon upload complete para usuario:", metadata.userId);
      console.log("Archivo:", file.url);
      return { uploadedBy: metadata.userId };
    }),
  loginBackground: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      console.log("Login background upload complete para usuario:", metadata.userId);
      console.log("Archivo:", file.url);
      return { uploadedBy: metadata.userId };
    }),
  audioUploader: f({
    "audio/webm": { maxFileSize: "16MB", maxFileCount: 1 },
    "audio/mpeg": { maxFileSize: "16MB", maxFileCount: 1 },
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      console.log("Audio upload complete para usuario:", metadata.userId);
      console.log("Archivo:", file.url);
      return { uploadedBy: metadata.userId };
    }),
  brandAsset: f({ 
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
    "text/plain": { maxFileSize: "16MB", maxFileCount: 10 },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 10 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxFileSize: "16MB", maxFileCount: 10 }
  })
    .middleware(authMiddleware)
    .onUploadComplete(({ metadata, file }) => {
      console.log("Brand asset upload complete para usuario:", metadata.userId);
      console.log("Archivo:", file.url);
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
