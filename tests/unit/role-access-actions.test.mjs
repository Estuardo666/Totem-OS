import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { assertTaskChanges, clientScope, taskScope, operationalClient, directoryUser, canSubscribeToChannel, shootScope } from "../../src/lib/access-policy.ts";

const nativeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");
const taskId = "cm000000000000000000000001";
const clientId = "cm000000000000000000000002";
const shareToken = "01234567-89ab-4cde-8fab-0123456789ab";

// Execute the real actions and guards, replacing only framework/DB boundaries.
// An unexpected read or side effect throws, so a denied request cannot silently write.
function harness(role = "EDITOR") {
  let session = role ? { user: { id: "editor-1", roleCode: role, role } } : null;
  const writes = [];
  const queries = [];
  const tasks = [{ id: taskId, status: "EDITING", assignedEditorId: "editor-1", assignedCommunityId: null, clientId, postCopy: "Texto", reviewToken: "secret-review" }];
  const clients = [{ id: clientId, name: "Asignado", editorId: "editor-1", communityId: null, monthlyRate: 999, pageAccessToken: "secret-meta", vault: "secret-vault", credentials: [{ password: "secret-password" }], tasks }];
  const users = [{ id: "editor-1", name: "Editor", roleCode: "EDITOR", roleLegacy: "EDITOR", password: "secret-hash", baseSalary: 1500, bankAccountInfo: "secret-bank", image: null, specialty: null, _count: { tasksAsEditor: 5, tasksAsCommunity: 0 } }];
  function matches(row, where = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (key === "AND") return (Array.isArray(value) ? value : [value]).every((part) => matches(row, part));
      if (key === "OR") return value.some((part) => matches(row, part));
      if (key === "tasks") return row.tasks?.some((task) => matches(task, value.some));
      if (key === "client") return true;
      if (value && typeof value === "object" && "not" in value) return row[key] !== value.not;
      return row[key] === value;
    });
  }
  const db = Object.fromEntries(["contentTask", "client", "user"].map((model) => {
    const rows = model === "contentTask" ? tasks : model === "client" ? clients : users;
    return [model, {
      findFirst: async (query) => { queries.push([model, query]); return rows.find((row) => matches(row, query.where)) ?? null; },
      findUnique: async (query) => {
        queries.push([model, query]);
        const row = rows.find((row) => matches(row, query.where));
        return row && query.select ? Object.fromEntries(Object.keys(query.select).map((key) => [key, row[key]])) : row ?? null;
      },
      findMany: async (query = {}) => { queries.push([model, query]); return rows.filter((row) => matches(row, query.where)); },
      update: async (query) => {
        const row = rows.find((row) => matches(row, query.where));
        if (!row) throw new Error("Record not available");
        writes.push([model, query]); return { ...row, ...query.data };
      },
      create: async (query) => { writes.push([model, query]); return { id: taskId, ...query.data }; },
    }];
  }));
  db.clientFeedback = { findMany: async () => [] };
  const unexpected = new Proxy({}, { get: (_, name) => () => { throw new Error(`Unexpected side effect: ${String(name)}`); } });
  const mocks = {
    "@/auth": { auth: async () => session },
    "@/lib/db": { db }, "server-only": {},
    "next/cache": { revalidatePath: () => {} },
    "@/lib/pusher": { pusherServer: { trigger: async () => { writes.push(["pusher"]); } } },
    "@/schemas/user": { createUserSchema: { parse: (value) => value }, updateUserSchema: { parse: (value) => value } },
    "@/schemas/client": {},
    "@/lib/content-review": { appendSystemReviewNote: (text) => text },
    "@/lib/system-notifications": unexpected,
    "@/lib/system-push": unexpected,
    "./notification-actions": unexpected,
  };
  const cache = new Map();
  function load(filename) {
    const resolved = path.resolve(root, filename);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const compiledModule = { exports: {} }; cache.set(resolved, compiledModule);
    const output = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    function requireLocal(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith("@/")) {
        if (["@/lib/server-access", "@/lib/access-policy", "@/lib/roles", "@/schemas/content"].includes(specifier)) {
          return load(`src/${specifier.slice(2)}.ts`);
        }
        return unexpected;
      }
      if (specifier.startsWith(".")) {
        let target = path.resolve(path.dirname(resolved), specifier);
        if (!path.extname(target)) target += ".ts";
        return load(path.relative(root, target));
      }
      return nativeRequire(specifier);
    }
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: resolved })(requireLocal, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return { load, writes, queries, tasks, clients, users, db, mocks, setSession: (value) => { session = value; } };
}

test("editor solo cambia materiales y transiciones de trabajo en tareas asignadas", () => {
  const actor = { userId: "e", role: "EDITOR" };
  const task = { status: "EDITING", assignedEditorId: "e", assignedCommunityId: null };
  assert.doesNotThrow(() => assertTaskChanges(actor, task, { postCopy: "ok", status: "REVIEW_CLIENT" }));
  for (const changes of [{ status: "REVIEW_INTERNAL" }, { status: "PUBLISHED" }, { status: "CLIENT_APPROVED" }, { assignedEditorId: "other" }, { clientId: "other" }, { reviewToken: "fake" }, { clientFeedback: "fake approval" }, { dueDate: new Date() }]) {
    assert.throws(() => assertTaskChanges(actor, task, changes));
  }
  assert.throws(() => assertTaskChanges(actor, { ...task, assignedEditorId: "other" }, { postCopy: "no" }));
  assert.throws(() => assertTaskChanges({ ...actor, role: "USER" }, task, {}));
  assert.doesNotThrow(() => assertTaskChanges(actor, { ...task, status: "REVIEW_INTERNAL" }, { status: "REVIEW_CLIENT" }));
  assert.throws(() => assertTaskChanges(actor, { ...task, status: "PUBLISHED" }, { postCopy: "no" }));
});

test("proyecciones operativas nunca serializan secretos ni campos nuevos", () => {
  const secret = { id: "1", name: "Visible", password: "secret-hash", vault: "secret-vault", pageAccessToken: "secret-token", futureSecret: "secret-future", monthlyRate: 1234, bankAccountInfo: "secret-bank" };
  for (const projection of [operationalClient(secret), directoryUser(secret)]) {
    const json = JSON.stringify(projection);
    for (const value of ["secret-", "futureSecret", "1234"]) assert.equal(json.includes(value), false, json);
  }
  assert.notDeepEqual(taskScope({ userId: "e", role: "USER" }), {});
  assert.notDeepEqual(clientScope({ userId: "e", role: "EDITOR" }), {});
});

for (const role of [null, "USER", "EDITOR"]) {
  test(`${role ?? "anónimo"}: acciones administrativas denegadas sin lecturas/escrituras`, async () => {
    const h = harness(role);
    const users = h.load("src/actions/user.actions.ts");
    const content = h.load("src/actions/content-actions.ts");
    const clients = h.load("src/actions/client-actions.ts");
    const finance = h.load("src/actions/finance-actions.ts");
    const shoots = h.load("src/actions/shooting-actions.ts");
    const notifications = h.load("src/actions/notification-actions.ts");
    const push = h.load("src/actions/push-actions.ts");
    const metrics = h.load("src/actions/metrics-actions.ts");
    const calls = [
      () => users.createUser({ roleCode: "ADMIN" }), () => users.updateUser("editor-1", { roleCode: "ADMIN" }),
      () => users.registerUser({}), () => users.updateUserRate("editor-1", 1),
      () => content.createTask({}), () => content.createTasksBatch({ tasks: [{}, {}] }),
      () => content.quickPublishTask(taskId), () => content.duplicateTask(taskId),
      () => content.updateTaskClient(taskId, clientId), () => content.deleteTask(taskId),
      () => content.bulkUpdateTasks({ taskIds: [taskId, "foreign"], status: "PUBLISHED" }),
      () => clients.generateShareToken(clientId), () => clients.createClient({}), () => clients.updateClient(clientId, {}),
      () => clients.addCredential({}), () => clients.deleteCredential("credential"),
      () => clients.saveCredentialGroup({}), () => clients.deleteCredentialGroup({}),
      () => clients.getClientProfitability(clientId),
      () => finance.createInvoice({}), () => finance.registerPayment("invoice", 100),
      () => finance.getClientAccountStatus(clientId), () => finance.getTransactionById("foreign"),
      () => finance.updateTransaction("foreign", {}), () => finance.markExpenseAsReimbursed("foreign"),
      () => finance.getMonthlyFinancialSummary(), () => finance.getGlobalProfitabilityStats(),
      () => finance.getStrategicClientPlans(),
      () => shoots.createShooting({}), () => shoots.updateShooting({}),
      () => shoots.deleteShooting("foreign"), () => shoots.changeShootingStatus("foreign", "COMPLETED"),
      () => notifications.sendNotification({ userId: "foreign", message: "no" }),
      () => notifications.notifyAdmins("no"), () => notifications.sendDailyTaskDigest(),
      () => push.sendPushNotification({ title: "no", message: "no" }),
      () => push.sendPushToAll("no", "no"),
      () => metrics.updateTaskMetrics({ taskId }), () => metrics.getAgencyAnalytics(),
    ];
    for (const call of calls) assert.equal((await call()).success, false);
    assert.deepEqual(h.queries, []);
    assert.deepEqual(h.writes, []);
  });
}

test("editor: tareas ajenas, publicación y cambios de asignación se rechazan antes de escribir", async () => {
  const h = harness(); const actions = h.load("src/actions/content-actions.ts");
  for (const call of [
    () => actions.updateTaskStatus(taskId, "PUBLISHED"),
    () => actions.updateTask(taskId, { assignedEditorId: "cm000000000000000000000009" }),
    () => actions.updateTaskNotes("foreign", "no"),
    () => actions.getTaskMetrics("foreign"),
    () => actions.updateTaskStatus("foreign", "EDITING"),
  ]) assert.equal((await call()).success, false);
  assert.deepEqual(h.writes, []);
});

test("editor puede guardar notas propias, con asignación también en el filtro de escritura", async () => {
  const h = harness(); const actions = h.load("src/actions/content-actions.ts");
  assert.equal((await actions.updateTaskNotes(taskId, "Material nuevo")).success, true);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0][0], "contentTask");
  assert.deepEqual(h.writes[0][1].where.AND, [taskScope({ userId: "editor-1", role: "EDITOR" }), { status: "EDITING" }]);
});

test("editor guarda materiales propios y la respuesta no contiene el token de revisión", async () => {
  const h = harness();
  h.mocks["@/lib/pusher"].pusherServer.trigger = async () => {};
  h.mocks["@/lib/content-events"] = { publishContentRefresh: async () => {} };
  const result = await h.load("src/actions/content-actions.ts").updateTask(taskId, {
    postCopy: "Texto nuevo", scriptUrl: "https://example.test/script",
  });
  assert.equal(result.success, true);
  assert.equal(result.data.postCopy, "Texto nuevo");
  assert.equal(result.data.scriptUrl, "https://example.test/script");
  assert.equal(result.data.reviewToken, null);
  assert.equal(h.writes.length, 1);
  assert.deepEqual(Object.keys(h.writes[0][1].data).sort(), ["postCopy", "scriptUrl"]);
});

test("USER y anónimo no pueden escribir tareas y el listado anónimo falla cerrado", async () => {
  for (const role of [null, "USER"]) {
    const h = harness(role); const actions = h.load("src/actions/content-actions.ts");
    assert.equal((await actions.updateTaskStatus(taskId, "EDITING")).success, false);
    assert.equal((await actions.updateTaskNotes(taskId, "no")).success, false);
    if (!role) assert.equal((await actions.getTasks()).success, false);
    assert.deepEqual(h.writes, []);
  }
});

test("directorio del editor excluye salarios, datos bancarios, hashes y conteos ajenos", async () => {
  const h = harness(); const actions = h.load("src/actions/user.actions.ts");
  const response = await actions.getUsers();
  assert.equal(response.success, true);
  assert.deepEqual(Object.keys(response.data[0]).sort(), ["_count", "id", "image", "name", "roleCode", "roleLegacy", "specialty"]);
  assert.equal(JSON.stringify(response).includes("secret"), false);
});

test("cliente ajeno se deniega; detalle propio no retorna credenciales ni secretos", async () => {
  const h = harness(); const actions = h.load("src/actions/client-actions.ts");
  assert.equal((await actions.getClientById("foreign")).success, false);
  // Detailed relation results are projected on the server, before reaching React.
  h.clients[0].brandAssets = [];
  const result = await actions.getClientById(clientId);
  assert.equal(result.success, true);
  assert.deepEqual(result.data.credentials, []);
  assert.equal(result.data.monthlyRate, 0);
  assert.equal(JSON.stringify(result).includes("secret"), false);
  assert.deepEqual(h.writes, []);
});

test("enlaces compartidos requieren token ligado al cliente; conocer el id no autoriza", async () => {
  const h = harness(null); const guard = h.load("src/lib/server-access.ts");
  h.clients[0].shareToken = shareToken;
  await assert.rejects(guard.requireReportAccess(clientId));
  await assert.rejects(guard.requireReportAccess(clientId, ""));
  await assert.rejects(guard.requireReportAccess("foreign", shareToken));
  await guard.requireReportAccess(clientId, shareToken);
  await assert.rejects(guard.requireReportAccess({ not: "" }, shareToken));
  await assert.rejects(guard.requireTaskAccess({ not: "" }));
  await assert.rejects(guard.requireClientAccess({ not: "" }));
  const actions = h.load("src/actions/client-actions.ts");
  assert.equal((await actions.getClientByShareToken("")).success, false);
  const shared = await actions.getClientByShareToken(shareToken);
  assert.equal(shared.success, true);
  assert.equal(JSON.stringify(shared).includes("secret"), false);
  assert.deepEqual(h.queries.at(-1)[1].select, { id: true, name: true, logo: true, color: true });
  assert.deepEqual(h.writes, []);
});

test("ADMIN conserva acceso de administración y las contraseñas nuevas se guardan como hash", async () => {
  const h = harness("ADMIN"); const actions = h.load("src/actions/user.actions.ts");
  const result = await actions.createUser({ name: "Nuevo", email: "new@example.test", password: "plain-password", roleCode: "EDITOR" });
  assert.equal(result.success, true);
  assert.match(h.writes[0][1].data.password, /^\$2[aby]\$/);
  assert.equal("password" in result.data, false);
  const directory = await actions.getUsers();
  assert.equal(directory.data[0].baseSalary, 1500);
  assert.equal("password" in directory.data[0], false);
});

test("autorización del servidor usa rol vigente y deniega usuario eliminado o BD caída", async () => {
  const h = harness("ADMIN");
  h.mocks["next-auth"] = () => ({ auth: async () => ({ user: { id: "editor-1", role: "ADMIN", roleCode: "ADMIN" } }) });
  h.mocks.react = { cache: (fn) => fn };
  h.mocks["next-auth/providers/credentials"] = (config) => config;
  h.mocks["@auth/prisma-adapter"] = { PrismaAdapter: () => ({}) };
  h.mocks["./auth.config"] = { authConfig: { providers: [] } };
  const { auth } = h.load("src/auth.ts");
  assert.equal((await auth()).user.role, "EDITOR");
  h.users[0].roleCode = "UNKNOWN";
  h.users[0].roleLegacy = "ADMIN";
  assert.equal(await auth(), null);
  h.users.length = 0;
  assert.equal(await auth(), null);
  h.db.user.findUnique = async () => { throw new Error("offline"); };
  assert.equal(await auth(), null);
});

test("filtros de gastos no permiten leer finanzas ajenas ni entrar sin identidad", async () => {
  const h = harness(); const queries = [];
  h.db.expense = { findMany: async (query) => { queries.push(query); return []; } };
  const service = h.load("src/lib/finance-reporting-service.ts");
  assert.equal((await service.getExpensesStatsFromDb({ userId: "foreign", month: "2026-10" })).success, true);
  assert.equal(queries.length, 2);
  assert.equal(queries.every((query) => query.where.paidByUserId === "editor-1"), true);
  h.setSession(null);
  assert.equal((await service.getFinancialStatsFromDb()).success, false);
  assert.equal((await service.getExpensesStatsFromDb()).success, false);
  assert.equal(queries.length, 2);
});

test("notificaciones solo se marcan leídas dentro de la cuenta actual", async () => {
  const h = harness(); const changes = [];
  h.db.notification = { update: async (query) => { changes.push(query); return { id: "own" }; } };
  const actions = h.load("src/actions/notification-actions.ts");
  assert.equal((await actions.markAsRead("notification")).success, true);
  assert.deepEqual(changes[0].where, { id: "notification", userId: "editor-1" });
  h.setSession(null);
  assert.equal((await actions.markAsRead("notification")).success, false);
  assert.equal(changes.length, 1);
});

test("USER y editor reciben únicamente sus tareas, sin tokens de revisión", async () => {
  for (const role of ["USER", "EDITOR"]) {
    const h = harness(role);
    h.tasks.push({ ...h.tasks[0], id: "foreign", assignedEditorId: "other" });
    const result = await h.load("src/actions/content-actions.ts").getTasks();
    assert.equal(result.success, true);
    assert.deepEqual(result.data.map((task) => task.id), [taskId]);
    assert.equal(result.data[0].reviewToken, null);
  }
});

test("una reasignación concurrente impide escribir después de comprobar permisos", async () => {
  const h = harness();
  const originalFind = h.db.contentTask.findUnique;
  h.db.contentTask.findUnique = async (query) => {
    const result = await originalFind(query);
    h.tasks[0].assignedEditorId = "other";
    return result;
  };
  const result = await h.load("src/actions/content-actions.ts").updateTaskNotes(taskId, "no");
  assert.equal(result.success, false);
  assert.deepEqual(h.writes, []);
});

test("canales personales se autorizan exclusivamente para su propietario", async () => {
  const actor = { userId: "editor-1", role: "EDITOR" };
  assert.equal(canSubscribeToChannel(null, "private-content"), false);
  assert.equal(canSubscribeToChannel(actor, "private-user-editor-1"), true);
  assert.equal(canSubscribeToChannel(actor, "private-user-other"), false);
  assert.equal(canSubscribeToChannel(actor, "user-editor-1"), false);
  const h = harness(); const signed = [];
  h.mocks["@/lib/pusher"].pusherServer.authorizeChannel = (socket, channel) => { signed.push([socket, channel]); return { auth: "signed" }; };
  const { POST } = h.load("src/app/api/pusher/auth/route.ts");
  const request = (channel, socket = "123.456") => new Request("http://localhost/api/pusher/auth", {
    method: "POST", body: new URLSearchParams({ channel_name: channel, socket_id: socket }),
  });
  assert.equal((await POST(request("private-user-other"))).status, 403);
  assert.equal((await POST(request("private-user-editor-1", "bad"))).status, 400);
  assert.equal(signed.length, 0);
  assert.equal((await POST(request("private-user-editor-1"))).status, 200);
  assert.equal((await POST(request("private-content"))).status, 200);
  assert.equal(signed.length, 2);
  h.setSession(null);
  assert.equal((await POST(request("private-content"))).status, 401);
  assert.equal(signed.length, 2);
});

test("la señal de actualización compartida no transmite tareas ni sus identificadores", async () => {
  const h = harness(); const events = [];
  h.mocks["@/lib/pusher"].pusherServer.trigger = async (...args) => { events.push(args); };
  await h.load("src/lib/content-events.ts").publishContentRefresh();
  assert.deepEqual(events, [["private-content", "update-event", { refresh: true }]]);
  h.db.notification = { create: async ({ data }) => ({ id: "notification", ...data }) };
  await h.load("src/lib/system-notifications.ts").sendNotification({ userId: "editor-1", message: "Privado", type: "ASSIGNED" });
  assert.equal(events[1][0], "private-user-editor-1");
});


test("la consulta detallada de rodajes incorpora el alcance en la propia lectura", async () => {
  const h = harness(); const queries = [];
  h.db.shoot = { findFirst: async (query) => { queries.push(query); return null; } };
  h.mocks["@/lib/shooting-service"] = h.load("src/lib/shooting-service.ts");
  const result = await h.load("src/actions/shooting-actions.ts").getShootingById("foreign");
  assert.equal(result.success, false);
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0].where, { AND: [{ id: "foreign" }, shootScope({ userId: "editor-1", role: "EDITOR" })] });
  assert.ok(queries[0].include);
  assert.deepEqual(h.writes, []);
});

test("los servicios internos no se registran como endpoints Server Action alternativos", () => {
  for (const filename of [
    "src/lib/finance-monthly-close-service.ts", "src/lib/finance-logic.ts",
    "src/lib/finance-monthly-summary-service.ts", "src/lib/finance-emergency-fund-service.ts",
    "src/lib/finance-profit-service.ts", "src/lib/ai/ai-provider-service.ts", "src/lib/ai/ai-orchestrator.ts",
  ]) {
    const source = ts.createSourceFile(filename, fs.readFileSync(path.join(root, filename), "utf8"), ts.ScriptTarget.Latest, true);
    const hasDirective = source.statements.some((node) => ts.isExpressionStatement(node) && ts.isStringLiteral(node.expression) && node.expression.text === "use server");
    assert.equal(hasDirective, false, filename);
  }
});
