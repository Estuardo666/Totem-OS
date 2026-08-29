import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "contracts", "openapi.baseline.json");
const currentPath = path.join(root, "contracts", "openapi.json");

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const current = JSON.parse(readFileSync(currentPath, "utf8"));
const problems = [];

function report(message) {
  problems.push(message);
}

function schemaType(schema) {
  if (!schema) return null;
  if (schema.$ref) return schema.$ref;
  if (schema.type) return Array.isArray(schema.type) ? schema.type.join("|") : schema.type;
  if (schema.oneOf) return `oneOf:${schema.oneOf.map(schemaType).join("|")}`;
  if (schema.anyOf) return `anyOf:${schema.anyOf.map(schemaType).join("|")}`;
  return null;
}

function compareSchema(oldSchema, newSchema, location) {
  if (!oldSchema || !newSchema) return;

  const oldType = schemaType(oldSchema);
  const newType = schemaType(newSchema);
  if (oldType && newType && oldType !== newType) {
    report(`${location}: schema type changed from ${oldType} to ${newType}`);
  }

  if (Array.isArray(oldSchema.enum)) {
    const newEnum = new Set(newSchema.enum ?? []);
    for (const value of oldSchema.enum) {
      if (!newEnum.has(value)) report(`${location}: enum value removed: ${JSON.stringify(value)}`);
    }
  }

  const oldRequired = new Set(oldSchema.required ?? []);
  const newRequired = new Set(newSchema.required ?? []);
  for (const property of oldRequired) {
    if (!newRequired.has(property)) continue; // Making a field optional is compatible.
  }
  for (const property of newRequired) {
    if (!oldRequired.has(property)) {
      report(`${location}: new required property added: ${property}`);
    }
  }

  const oldProperties = oldSchema.properties ?? {};
  const newProperties = newSchema.properties ?? {};
  for (const [property, oldProperty] of Object.entries(oldProperties)) {
    if (!(property in newProperties)) {
      report(`${location}: response/request property removed: ${property}`);
      continue;
    }
    compareSchema(oldProperty, newProperties[property], `${location}.${property}`);
  }

  if (oldSchema.items && newSchema.items) {
    compareSchema(oldSchema.items, newSchema.items, `${location}[]`);
  }
  if (oldSchema.oneOf && newSchema.oneOf) {
    oldSchema.oneOf.forEach((schema, index) => compareSchema(schema, newSchema.oneOf[index], `${location}.oneOf[${index}]`));
  }
  if (oldSchema.anyOf && newSchema.anyOf) {
    oldSchema.anyOf.forEach((schema, index) => compareSchema(schema, newSchema.anyOf[index], `${location}.anyOf[${index}]`));
  }
}

function compareResponses(oldOperation, newOperation, location) {
  const oldResponses = oldOperation.responses ?? {};
  const newResponses = newOperation.responses ?? {};
  for (const [status, oldResponse] of Object.entries(oldResponses)) {
    const newResponse = newResponses[status];
    if (!newResponse) {
      report(`${location}: response status removed: ${status}`);
      continue;
    }
    const oldContent = oldResponse.content ?? {};
    const newContent = newResponse.content ?? {};
    for (const [mediaType, oldMedia] of Object.entries(oldContent)) {
      const newMedia = newContent[mediaType];
      if (!newMedia) {
        report(`${location} ${status}: response media type removed: ${mediaType}`);
        continue;
      }
      compareSchema(oldMedia.schema, newMedia.schema, `${location} ${status} ${mediaType}`);
    }
  }
}

function compareOperations(oldOperation, newOperation, location) {
  if (!newOperation) {
    report(`${location}: operation removed`);
    return;
  }

  const oldSecurity = oldOperation.security ?? [];
  const newSecurity = newOperation.security ?? [];
  for (const requirement of oldSecurity) {
    const stillSupported = newSecurity.some((candidate) =>
      Object.keys(requirement).length === Object.keys(candidate).length
      && Object.keys(requirement).every((key) => JSON.stringify(requirement[key]) === JSON.stringify(candidate[key]))
    );
    if (!stillSupported) report(`${location}: security requirement became stricter or was removed`);
  }

  const oldParameters = oldOperation.parameters ?? [];
  const newParameters = newOperation.parameters ?? [];
  for (const oldParameter of oldParameters) {
    const matching = newParameters.find((parameter) => parameter.name === oldParameter.name && parameter.in === oldParameter.in);
    if (!matching) {
      report(`${location}: parameter removed: ${oldParameter.in}.${oldParameter.name}`);
      continue;
    }
    if (!oldParameter.required && matching.required) {
      report(`${location}: parameter became required: ${oldParameter.in}.${oldParameter.name}`);
    }
    compareSchema(oldParameter.schema, matching.schema, `${location} parameter ${oldParameter.name}`);
  }

  if (oldOperation.requestBody && !newOperation.requestBody) {
    report(`${location}: request body removed`);
  } else if (oldOperation.requestBody && newOperation.requestBody) {
    if (!oldOperation.requestBody.required && newOperation.requestBody.required) {
      report(`${location}: request body became required`);
    }
    const oldContent = oldOperation.requestBody.content ?? {};
    const newContent = newOperation.requestBody.content ?? {};
    for (const [mediaType, oldMedia] of Object.entries(oldContent)) {
      const newMedia = newContent[mediaType];
      if (!newMedia) {
        report(`${location}: request media type removed: ${mediaType}`);
        continue;
      }
      compareSchema(oldMedia.schema, newMedia.schema, `${location} request ${mediaType}`);
    }
  }

  compareResponses(oldOperation, newOperation, location);
}

for (const [route, oldPath] of Object.entries(baseline.paths ?? {})) {
  const newPath = current.paths?.[route];
  if (!newPath) {
    report(`path removed: ${route}`);
    continue;
  }
  for (const [method, oldOperation] of Object.entries(oldPath)) {
    if (!/^(get|post|put|patch|delete|head|options|trace)$/.test(method)) continue;
    compareOperations(oldOperation, newPath[method], `${method.toUpperCase()} ${route}`);
  }
}

for (const [name, oldSchema] of Object.entries(baseline.components?.schemas ?? {})) {
  const newSchema = current.components?.schemas?.[name];
  if (!newSchema) {
    report(`component schema removed: ${name}`);
    continue;
  }
  compareSchema(oldSchema, newSchema, `components.schemas.${name}`);
}

if (problems.length > 0) {
  console.error("Breaking OpenAPI changes detected:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log("No breaking OpenAPI changes detected.");
}
