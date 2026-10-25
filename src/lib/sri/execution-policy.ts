export function assertSriEnvironmentAllowed(ambiente: string, allowProduction = process.env.SRI_ALLOW_PRODUCTION === "1") {
  if (ambiente !== "1" && ambiente !== "2") throw new Error("SRI_ENVIRONMENT_INVALID");
  if (ambiente === "2" && !allowProduction) throw new Error("SRI_PRODUCTION_NOT_AUTHORIZED");
}

export function assertSriDocumentEnvironment(transport: string, document: string, accessKey: string | null) {
  assertSriEnvironmentAllowed(transport);
  if (transport !== document || !accessKey || !/^\d{49}$/.test(accessKey) || accessKey[23] !== transport) throw new Error("SRI_DOCUMENT_ENVIRONMENT_MISMATCH");
}

export function assertSriWorkerDatabase(ambiente: string, connection: string | undefined) {
  assertSriEnvironmentAllowed(ambiente);
  if (ambiente === "1") {
    const name = connection ? decodeURIComponent(new URL(connection).pathname.slice(1)) : "";
    if (name !== "totem_sri_test" && name !== "sri_local_test") throw new Error("SRI_TEST_REQUIRES_ISOLATED_DATABASE");
  }
}

export function sriEmailAllowed(ambiente: string) {
  return ambiente === "2" && process.env.SRI_ALLOW_PRODUCTION === "1" && process.env.SRI_SEND_EMAIL === "1";
}

export function resolveSriDatabaseUrl(ambiente: string | undefined, dedicatedUrl: string | undefined, applicationUrl: string | undefined) {
  const connection = dedicatedUrl ?? applicationUrl;
  if (dedicatedUrl || ambiente) assertSriWorkerDatabase(ambiente ?? "1", connection);
  return dedicatedUrl;
}
