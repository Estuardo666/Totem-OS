import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import {
  API_CONTRACT_VERSION,
  apiContractRegistry,
  generatedSchemaEntries,
} from "../src/contracts/api-contracts.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openApiPath = path.join(root, "contracts", "openapi.json");
const generatedTsPath = path.join(root, "src", "generated", "api-client.ts");
const generatedSwiftPath = path.join(
  root,
  "ios",
  "TotemOS",
  "TotemOSKit",
  "GeneratedAPIClient.swift",
);

function cloneWithoutSchemaMarker(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(cloneWithoutSchemaMarker);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$schema")
      .map(([key, child]) => [key, cloneWithoutSchemaMarker(child)]),
  );
}

function schemaDefinitions() {
  const schemas = {};
  for (const [name, schema] of generatedSchemaEntries) {
    const generated = zodToJsonSchema(schema, {
      name,
      target: "jsonSchema7",
    });
    for (const [definitionName, definition] of Object.entries(generated.definitions ?? {})) {
      schemas[definitionName] = cloneWithoutSchemaMarker(definition);
    }
  }
  return schemas;
}

function schemaRef(name) {
  return { $ref: `#/components/schemas/${name}` };
}

function normalizeKnownReferences(schemas) {
  const problem = schemas.ApiProblem;
  if (problem?.properties?.errors?.items) {
    problem.properties.errors.items = schemaRef("APIProblemIssue");
  }

  const meta = schemas.KernelEchoMeta;
  if (meta?.properties?.pagination) {
    meta.properties.pagination = schemaRef("KernelEchoPagination");
  }

  const getResponse = schemas.KernelEchoGetResponse;
  if (getResponse?.properties?.data?.items) {
    getResponse.properties.data.items = schemaRef("KernelItem");
  }
  if (getResponse?.properties?.meta) {
    getResponse.properties.meta = schemaRef("KernelEchoMeta");
  }

  const postResponse = schemas.KernelEchoPostResponse;
  if (postResponse?.properties?.data) {
    postResponse.properties.data = schemaRef("KernelEchoPostData");
  }
  if (postResponse?.properties?.meta) {
    postResponse.properties.meta = schemaRef("KernelEchoPostMeta");
  }

  const shellData = schemas.ShellBootstrapData;
  if (shellData?.properties) {
    shellData.properties.user = schemaRef("ShellBootstrapUser");
    shellData.properties.preferences = schemaRef("ShellBootstrapPreferences");
    shellData.properties.brand = schemaRef("ShellBootstrapBrand");
    shellData.properties.counters = schemaRef("ShellBootstrapCounters");
    if (shellData.properties.notifications?.items) {
      shellData.properties.notifications.items = schemaRef("ShellBootstrapNotification");
    }
  }

  const shellResponse = schemas.ShellBootstrapResponse;
  if (shellResponse?.properties) {
    shellResponse.properties.data = schemaRef("ShellBootstrapData");
    shellResponse.properties.meta = schemaRef("ShellBootstrapMeta");
  }
}

function queryParameters(schemaName, schemas) {
  const query = schemas[schemaName] ?? {};
  const required = new Set(query.required ?? []);
  return Object.entries(query.properties ?? {}).map(([name, value]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: value,
  }));
}

function buildOpenApi() {
  const schemas = schemaDefinitions();
  normalizeKnownReferences(schemas);
  const paths = {};

  for (const contract of apiContractRegistry) {
    const operation = {
      operationId: contract.operationId,
      summary: contract.summary,
      description: contract.description,
      tags: [contract.tag],
      security: contract.method === "post"
        ? [{ authjsSession: [], csrfToken: [] }]
        : [{ authjsSession: [] }],
      ...(contract.querySchemaName ? { parameters: queryParameters(contract.querySchemaName, schemas) } : {}),
      ...(contract.bodySchema
        ? {
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: schemaRef(contract.bodySchemaName),
                },
              },
            },
          }
        : {}),
      responses: Object.fromEntries(
        contract.responses.map((response) => [
          String(response.status),
          {
            description: response.description,
            content: {
              "application/json": {
                schema: schemaRef(response.schemaName),
              },
              ...(response.schemaName === "ApiProblem"
                ? {
                    "application/problem+json": {
                      schema: schemaRef("ApiProblem"),
                    },
                  }
                : {}),
            },
          },
        ]),
      ),
      "x-required-capability": contract.requiredCapability,
    };

    paths[contract.path] ??= {};
    paths[contract.path][contract.method] = operation;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Totem OS API",
      version: API_CONTRACT_VERSION,
      description: "Versioned REST contract shared by the Next.js API, React and Swift clients.",
    },
    jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
    servers: [{ url: "/", description: "Current Totem OS host" }],
    paths,
    components: {
      schemas,
      securitySchemes: {
        authjsSession: {
          type: "apiKey",
          in: "cookie",
          name: "authjs.session-token",
          description: "Auth.js session cookie. The secure production cookie uses the __Secure- prefix.",
        },
        csrfToken: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
          description: "Required for mutating requests together with the CSRF cookie.",
        },
      },
    },
  };
}

function refName(value) {
  return value.split("/").at(-1);
}

function tsType(schema) {
  if (!schema) return "unknown";
  if (schema.$ref) return refName(schema.$ref);
  if (schema.enum) return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  if (schema.oneOf) return schema.oneOf.map(tsType).join(" | ");
  if (schema.anyOf) return schema.anyOf.map(tsType).join(" | ");
  if (Array.isArray(schema.type)) {
    return schema.type.map((type) => type === "null" ? "null" : tsType({ type })).join(" | ");
  }
  if (schema.type === "array") return `Array<${tsType(schema.items)}>`;
  if (schema.type === "object") {
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(schema.properties ?? {});
    if (properties.length === 0) return "Record<string, unknown>";
    return `{ ${properties.map(([name, value]) => `${name}${required.has(name) ? "" : "?"}: ${tsType(value)}`).join("; ")} }`;
  }
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "string") return "string";
  return "unknown";
}

function renderTypeScript(openapi) {
  const schemas = openapi.components.schemas;
  const types = Object.entries(schemas)
    .map(([name, schema]) => `export type ${name} = ${tsType(schema)};`)
    .join("\n");

  return `// AUTO-GENERATED by scripts/generate-api-contracts.mjs. Do not edit manually.
// Source: contracts/openapi.json (OpenAPI ${openapi.openapi}).

${types}

export interface TotemApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  credentials?: RequestCredentials;
  csrfToken?: string;
}

export class TotemApiError extends Error {
  readonly status: number;
  readonly problem: ApiProblem | null;

  constructor(status: number, problem: ApiProblem | null) {
    super(problem?.detail ?? \`Totem API request failed with status \${status}.\`);
    this.name = "TotemApiError";
    this.status = status;
    this.problem = problem;
  }
}

export class TotemApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly credentials: RequestCredentials;
  private readonly csrfToken?: string;

  constructor(options: TotemApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.credentials = options.credentials ?? "include";
    this.csrfToken = options.csrfToken;
  }

  async kernelEchoList(params: KernelEchoQuery = {}): Promise<KernelEchoGetResponse> {
    const url = new URL(\`\${this.baseUrl}/api/v1/_kernel/echo\`, globalThis.location?.origin ?? "http://localhost");
    if (params.cursor) url.searchParams.set("cursor", params.cursor);
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    return this.request<KernelEchoGetResponse>(url, "GET");
  }

  async kernelEcho(input: KernelEchoBody): Promise<KernelEchoPostResponse> {
    return this.request<KernelEchoPostResponse>(
      new URL(\`\${this.baseUrl}/api/v1/_kernel/echo\`, globalThis.location?.origin ?? "http://localhost"),
      "POST",
      input,
    );
  }

  async shellBootstrap(): Promise<ShellBootstrapResponse> {
    return this.request<ShellBootstrapResponse>(
      new URL(\`\${this.baseUrl}/api/v1/shell/bootstrap\`, globalThis.location?.origin ?? "http://localhost"),
      "GET",
    );
  }

  private async request<T>(url: URL, method: "GET" | "POST", body?: unknown): Promise<T> {
    const headers = new Headers({ "accept": "application/json" });
    if (body !== undefined) headers.set("content-type", "application/json");
    if (method !== "GET" && this.csrfToken) headers.set("x-csrf-token", this.csrfToken);
    const response = await this.fetchImpl(url, {
      method,
      headers,
      credentials: this.credentials,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      let problem: ApiProblem | null = null;
      try { problem = (await response.json()) as ApiProblem; } catch { /* preserve status */ }
      throw new TotemApiError(response.status, problem);
    }
    return (await response.json()) as T;
  }
}
`;
}

function renderSwift() {
  return `// AUTO-GENERATED by scripts/generate-api-contracts.mjs. Do not edit manually.
// Source: contracts/openapi.json (OpenAPI 3.1.0).

import Foundation

public enum APIProblemPathPart: Codable, Equatable {
    case key(String)
    case index(Int)

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            self = .key(value)
        } else {
            self = .index(try container.decode(Int.self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .key(let value): try container.encode(value)
        case .index(let value): try container.encode(value)
        }
    }
}

public struct APIProblemIssue: Codable, Equatable {
    public let path: [APIProblemPathPart]
    public let code: String
    public let message: String
}

public struct APIProblem: Codable, Equatable, Error {
    public let type: String
    public let title: String
    public let status: Int
    public let detail: String
    public let instance: String
    public let code: String
    public let requestId: String
    public let retryAfter: Int?
    public let errors: [APIProblemIssue]?
}

public struct KernelItem: Codable, Equatable {
    public let id: String
    public let label: String
}

public struct KernelEchoQuery: Codable, Equatable {
    public let cursor: String?
    public let limit: Int?

    public init(cursor: String? = nil, limit: Int? = nil) {
        self.cursor = cursor
        self.limit = limit
    }
}

public struct KernelEchoBody: Codable, Equatable {
    public let message: String

    public init(message: String) {
        self.message = message
    }
}

public struct KernelEchoCursor: Codable, Equatable {
    public let version: Int
    public let offset: Int
}

public struct KernelEchoPagination: Codable, Equatable {
    public let limit: Int
    public let hasMore: Bool
    public let nextCursor: String?
}

public struct KernelEchoMeta: Codable, Equatable {
    public let requestId: String
    public let pagination: KernelEchoPagination
}

public struct KernelEchoGetResponse: Codable, Equatable {
    public let data: [KernelItem]
    public let meta: KernelEchoMeta
}

public struct KernelEchoPostData: Codable, Equatable {
    public let echo: String
}

public struct KernelEchoPostMeta: Codable, Equatable {
    public let requestId: String
}

public struct KernelEchoPostResponse: Codable, Equatable {
    public let data: KernelEchoPostData
    public let meta: KernelEchoPostMeta
}

public struct ShellBootstrapUser: Codable, Equatable {
    public let id: String
    public let name: String
    public let email: String?
    public let role: String
    public let roleLabel: String
    public let avatarUrl: String?
    public let initials: String
}

public struct ShellBootstrapPreferences: Codable, Equatable {
    public let theme: String
    public let accentColor: String
}

public struct ShellBootstrapBrand: Codable, Equatable {
    public let logoLight: String?
    public let logoDark: String?
}

public struct ShellBootstrapCounters: Codable, Equatable {
    public let pendingTasks: Int
    public let unreadNotifications: Int
}

public struct ShellBootstrapNotification: Codable, Equatable {
    public let id: String
    public let message: String
    public let createdAt: String
    public let authorName: String?
    public let avatarUrl: String?
    public let read: Bool
}

public struct ShellBootstrapData: Codable, Equatable {
    public let user: ShellBootstrapUser
    public let capabilities: [String]
    public let preferences: ShellBootstrapPreferences
    public let brand: ShellBootstrapBrand
    public let counters: ShellBootstrapCounters
    public let notifications: [ShellBootstrapNotification]
}

public struct ShellBootstrapMeta: Codable, Equatable {
    public let requestId: String
}

public struct ShellBootstrapResponse: Codable, Equatable {
    public let data: ShellBootstrapData
    public let meta: ShellBootstrapMeta
}

public enum TotemAPIError: Error {
    case invalidURL
    case http(status: Int, problem: APIProblem?)
    case decoding(Error)
}

public final class TotemAPIClient {
    private let baseURL: URL
    private let session: URLSession
    private let csrfToken: String?
    private let additionalHeaders: [String: String]

    public init(
        baseURL: URL,
        session: URLSession = .shared,
        csrfToken: String? = nil,
        additionalHeaders: [String: String] = [:]
    ) {
        self.baseURL = baseURL
        self.session = session
        self.csrfToken = csrfToken
        self.additionalHeaders = additionalHeaders
    }

    public func kernelEchoList(query: KernelEchoQuery = KernelEchoQuery()) async throws -> KernelEchoGetResponse {
        var components = URLComponents(url: baseURL.appendingPathComponent("api/v1/_kernel/echo"), resolvingAgainstBaseURL: false)
        var items: [URLQueryItem] = []
        if let cursor = query.cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        if let limit = query.limit { items.append(URLQueryItem(name: "limit", value: String(limit))) }
        components?.queryItems = items.isEmpty ? nil : items
        guard let url = components?.url else { throw TotemAPIError.invalidURL }
        return try await request(url: url, method: "GET", body: nil, as: KernelEchoGetResponse.self)
    }

    public func kernelEcho(_ body: KernelEchoBody) async throws -> KernelEchoPostResponse {
        let url = baseURL.appendingPathComponent("api/v1/_kernel/echo")
        let encodedBody = try JSONEncoder().encode(body)
        return try await request(url: url, method: "POST", body: encodedBody, as: KernelEchoPostResponse.self)
    }

    public func shellBootstrap() async throws -> ShellBootstrapResponse {
        let url = baseURL.appendingPathComponent("api/v1/shell/bootstrap")
        return try await request(url: url, method: "GET", body: nil, as: ShellBootstrapResponse.self)
    }

    private func request<T: Decodable>(url: URL, method: String, body: Data?, as type: T.Type) async throws -> T {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "accept")
        for (name, value) in additionalHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "content-type")
            if let csrfToken { request.setValue(csrfToken, forHTTPHeaderField: "x-csrf-token") }
        }
        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw TotemAPIError.http(status: 0, problem: nil)
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let problem = try? JSONDecoder().decode(APIProblem.self, from: data)
            throw TotemAPIError.http(status: httpResponse.statusCode, problem: problem)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw TotemAPIError.decoding(error)
        }
    }
}
`;
}

const openapi = buildOpenApi();
mkdirSync(path.dirname(openApiPath), { recursive: true });
mkdirSync(path.dirname(generatedTsPath), { recursive: true });
mkdirSync(path.dirname(generatedSwiftPath), { recursive: true });
writeFileSync(openApiPath, `${JSON.stringify(openapi, null, 2)}\n`);
writeFileSync(generatedTsPath, renderTypeScript(openapi));
writeFileSync(generatedSwiftPath, renderSwift());
console.log(`Generated OpenAPI and clients for ${apiContractRegistry.length} operations.`);
