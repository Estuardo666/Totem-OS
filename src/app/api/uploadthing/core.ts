import { auth } from "@/auth";
import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  // Primer endpoint (Brand Kit)
  brandAsset: f({
    image: { maxFileSize: "4MB", maxFileCount: 10 },
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
  })
    .middleware(async () => {
      // Verificar que el usuario esté autenticado
      const session = await auth();

      if (!session?.user?.id) {
        throw new Error("No autorizado");
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // El archivo se ha subido exitosamente
      // La metadata contiene el userId
      console.log("Upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
    }),

  // Segundo endpoint (Tareas)
  coverImage: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      // Verificar que el usuario esté autenticado
      const session = await auth();

      if (!session?.user?.id) {
        throw new Error("No autorizado");
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Retornar la URL del archivo subido
      console.log("Cover image upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Tercer endpoint (Notas de Voz - Totem Voice)
  audioUploader: f({
    audio: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      // Verificar que el usuario esté autenticado
      const session = await auth();

      if (!session?.user?.id) {
        throw new Error("No autorizado");
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Retornar la URL del archivo subido
      console.log("Audio upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Cuarto endpoint (Documentos - Guiones)
  documentUploader: f({
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
    blob: { maxFileSize: "8MB", maxFileCount: 1 }, // Para .doc y .docx
  })
    .middleware(async () => {
      // Verificar que el usuario esté autenticado
      const session = await auth();

      if (!session?.user?.id) {
        throw new Error("No autorizado");
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Retornar la URL del archivo subido
      console.log("Document upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Quinto endpoint (Logos de Marca - Solo Administradores)
  brandLogo: f({
    image: { maxFileSize: "2MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      // Verificar que el usuario esté autenticado y sea ADMIN
      const session = await auth();

      if (!session?.user?.id) {
        throw new Error("No autorizado");
      }

      if (session.user.role !== "ADMIN") {
        throw new Error("Solo los administradores pueden subir logos de marca");
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Retornar la URL del archivo subido
      console.log("Brand logo upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),

  // Sexto endpoint (Background del Login - Solo Administradores)
  loginBackground: f({
    image: { maxFileSize: "5MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      // Verificar que el usuario esté autenticado y sea ADMIN
      const session = await auth();

      if (!session?.user?.id) {
        throw new Error("No autorizado");
      }

      if (session.user.role !== "ADMIN") {
        throw new Error("Solo los administradores pueden subir el background del login");
      }

      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // Retornar la URL del archivo subido
      console.log("Login background upload complete for userId:", metadata.userId);
      console.log("file url", file.url);
      return { uploadedBy: metadata.userId, url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;


