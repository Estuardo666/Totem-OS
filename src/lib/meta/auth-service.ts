/**
 * Servicio de autenticación Meta Graph API
 * Implementa el flujo OAuth 2.0 para Facebook & Instagram
 * 
 * NOTA: Este archivo contiene funciones de utilidad que se llaman desde Server Actions.
 * No necesita "use server" porque estas funciones solo se ejecutan en el servidor a través
 * de las Server Actions en meta-actions.ts y las API routes.
 */

const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/callback/meta`;

if (!META_APP_ID || !META_APP_SECRET) {
  console.warn("⚠️ META_APP_ID y META_APP_SECRET deben estar configurados en .env");
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string; // Token de página (no expira mientras el token de usuario sea válido)
}

export interface MetaUserToken {
  access_token: string;
  token_type: string;
  expires_in: number; // Segundos hasta la expiración
}

/**
 * Genera la URL de autorización de Facebook OAuth 2.0
 * Permisos solicitados para gestión completa de páginas e Instagram Business
 */
export function getMetaAuthorizationUrl(): string {
  if (!META_APP_ID) {
    throw new Error("META_APP_ID no está configurado en las variables de entorno");
  }

  const scopes = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "read_insights",
  ].join(",");

  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: scopes,
    response_type: "code",
    auth_type: "rerequest", // Forzar re-autorización si los permisos fueron rechazados
  });

  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

/**
 * Intercambia el código temporal por un token de acceso de corta duración
 * Luego lo convierte automáticamente en un token de larga duración (60 días)
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error("META_APP_ID y META_APP_SECRET deben estar configurados");
  }

  // Paso 1: Intercambiar código por token de corta duración
  const tokenResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code: code,
      }).toString()
  );

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json().catch(() => ({}));
    throw new Error(
      `Error al intercambiar código por token: ${errorData.error?.message || tokenResponse.statusText}`
    );
  }

  const shortLivedToken: MetaUserToken = await tokenResponse.json();

  // Paso 2: Convertir token de corta duración a token de larga duración (60 días)
  const longLivedTokenResponse = await fetch(
    `https://graph.facebook.com/v21.0/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: shortLivedToken.access_token,
      }).toString()
  );

  if (!longLivedTokenResponse.ok) {
    const errorData = await longLivedTokenResponse.json().catch(() => ({}));
    throw new Error(
      `Error al obtener token de larga duración: ${errorData.error?.message || longLivedTokenResponse.statusText}`
    );
  }

  const longLivedToken: MetaUserToken = await longLivedTokenResponse.json();

  return longLivedToken;
}

/**
 * Obtiene información básica del usuario de Facebook
 */
export async function getFacebookUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
}> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me?` +
      new URLSearchParams({
        access_token: accessToken,
        fields: "id,name",
      }).toString()
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Error al obtener información del usuario: ${errorData.error?.message || response.statusText}`
    );
  }

  return await response.json();
}

/**
 * Obtiene todas las páginas (Fanpages) gestionadas por el usuario
 * Retorna el ID, nombre y access_token de cada página
 */
export async function getManagedPages(userAccessToken: string): Promise<MetaPage[]> {
  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?` +
      new URLSearchParams({
        access_token: userAccessToken,
        fields: "id,name,access_token",
      }).toString()
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Error al obtener páginas gestionadas: ${errorData.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Obtiene la cuenta de Instagram Business asociada a una página de Facebook
 */
export async function getInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string
): Promise<{ id: string; username: string } | null> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?` +
        new URLSearchParams({
          access_token: pageAccessToken,
          fields: "instagram_business_account{id,username}",
        }).toString()
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Si la página no tiene cuenta de Instagram Business, retornamos null
      if (errorData.error?.code === 100 || errorData.error?.code === 190) {
        return null;
      }
      throw new Error(
        `Error al obtener cuenta de Instagram: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const instagramAccount = data.instagram_business_account;

    if (!instagramAccount) {
      return null;
    }

    return {
      id: instagramAccount.id,
      username: instagramAccount.username || "",
    };
  } catch (error) {
    console.error("Error al obtener cuenta de Instagram Business:", error);
    return null;
  }
}

/**
 * Obtiene las cuentas publicitarias (Ad Accounts) del usuario
 */
export async function getAdAccounts(userAccessToken: string): Promise<Array<{
  id: string;
  name: string;
  account_id: string;
}>> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?` +
        new URLSearchParams({
          access_token: userAccessToken,
          fields: "id,name,account_id",
        }).toString()
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Si el usuario no tiene cuentas publicitarias o no tiene permisos, retornamos array vacío
      if (errorData.error?.code === 190 || errorData.error?.code === 200) {
        return [];
      }
      throw new Error(
        `Error al obtener cuentas publicitarias: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error al obtener cuentas publicitarias:", error);
    return [];
  }
}

/**
 * Verifica los permisos del token de acceso
 * Retorna un objeto con los permisos solicitados y si están activos
 */
export async function checkPermissions(accessToken: string): Promise<{
  permissions: Record<string, boolean>;
  missing: string[];
}> {
  const requiredPermissions = [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "read_insights",
  ];

  try {
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/permissions?` +
        new URLSearchParams({
          access_token: accessToken,
        }).toString()
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Error al verificar permisos: ${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const grantedPermissions = new Set<string>();

    // Meta retorna permisos con status: "granted" o "declined"
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((perm: { permission: string; status: string }) => {
        if (perm.status === "granted") {
          grantedPermissions.add(perm.permission);
        }
      });
    }

    const permissions: Record<string, boolean> = {};
    const missing: string[] = [];

    requiredPermissions.forEach((perm) => {
      const isGranted = grantedPermissions.has(perm);
      permissions[perm] = isGranted;
      if (!isGranted) {
        missing.push(perm);
      }
    });

    return { permissions, missing };
  } catch (error) {
    console.error("Error al verificar permisos:", error);
    // En caso de error, asumimos que todos los permisos faltan
    const permissions: Record<string, boolean> = {};
    requiredPermissions.forEach((perm) => {
      permissions[perm] = false;
    });
    return { permissions, missing: requiredPermissions };
  }
}

