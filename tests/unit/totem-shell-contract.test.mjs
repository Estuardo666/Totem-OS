import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShellSnapshot,
  filterShellNavigation,
  buildShellTabs,
  isValidShellRoute,
  parseShellCommand,
  TOTEM_SHELL_CONTRACT_VERSION,
} from "../../src/lib/totem-shell-contract.ts";

const baseInput = {
  route: "/finance/transactions",
  theme: "dark",
  accentColor: "#cba6f7",
  user: { name: "Ana Pérez", role: "ADMIN", image: "https://cdn.example.com/a.png" },
  logoLight: "/logo-light.png",
  logoDark: "javascript:alert(1)",
  taskCount: 4,
  unreadNotificationCount: 2,
  notifications: [
    {
      id: "clx123abc",
      message: "Nueva factura",
      createdAt: "2026-08-28T12:00:00.000Z",
      read: false,
      authorName: "Totem",
      avatarUrl: "/avatars/1.png",
    },
  ],
};

test("el snapshot expone la versión, la ruta y los datos saneados", () => {
  const snapshot = buildShellSnapshot(baseInput);

  assert.equal(snapshot.version, TOTEM_SHELL_CONTRACT_VERSION);
  assert.equal(snapshot.route, "/finance/transactions");
  assert.equal(snapshot.theme, "dark");
  assert.equal(snapshot.accentColor, "#CBA6F7");
  assert.equal(snapshot.user.roleLabel, "Administrador");
  assert.equal(snapshot.user.initials, "AP");
  assert.equal(snapshot.logoLight, "/logo-light.png");
  // Un esquema no https se descarta en lugar de llegar a Swift.
  assert.equal(snapshot.logoDark, null);
  assert.equal(snapshot.notifications.length, 1);
});

test("la navegación se filtra por permisos antes de publicarse", () => {
  const adminRoutes = filterShellNavigation("ADMIN").map((item) => item.route);
  const userNav = filterShellNavigation("USER");
  const userRoutes = userNav.map((item) => item.route);

  assert.ok(adminRoutes.includes("/admin/users"));
  assert.ok(!userRoutes.includes("/admin/users"));
  assert.ok(!userRoutes.includes("/admin/files"));

  const userFinance = userNav.find((item) => item.route === "/finance");
  const userFinanceChildren = userFinance.children.map((child) => child.route);
  assert.deepEqual(userFinanceChildren, ["/finance/personal", "/finance/transactions"]);

  const anonymous = filterShellNavigation(null).map((item) => item.route);
  assert.ok(!anonymous.includes("/admin/users"));
});

test("la barra inferior mantiene el orden acordado", () => {
  assert.deepEqual(
    buildShellTabs("USER").map((tab) => tab.label),
    ["Inicio", "Tareas", "Finanzas", "Clientes"]
  );
  assert.equal(buildShellTabs("USER")[2].route, "/finance/personal");
  assert.equal(buildShellTabs("ADMIN")[2].route, "/finance");
});

test("las rutas externas o con salto de directorio se rechazan", () => {
  assert.ok(isValidShellRoute("/"));
  assert.ok(isValidShellRoute("/finance/transactions"));
  assert.ok(!isValidShellRoute("//evil.example.com"));
  assert.ok(!isValidShellRoute("https://evil.example.com"));
  assert.ok(!isValidShellRoute("/finance/../admin"));
  assert.ok(!isValidShellRoute("/finance/"));
  assert.ok(!isValidShellRoute(42));
});

test("los contadores se recortan y las notificaciones se limitan a cinco", () => {
  const snapshot = buildShellSnapshot({
    ...baseInput,
    taskCount: 100_000,
    unreadNotificationCount: -3,
    notifications: Array.from({ length: 9 }, (_, index) => ({
      id: `notif${index}`,
      message: "x".repeat(400),
      createdAt: "2026-08-28T12:00:00.000Z",
    })),
  });

  assert.equal(snapshot.taskCount, 999);
  assert.equal(snapshot.unreadNotificationCount, 0);
  assert.equal(snapshot.notifications.length, 5);
  assert.equal(snapshot.notifications[0].message.length, 280);
});

test("solo se aceptan comandos conocidos con rutas permitidas", () => {
  const snapshot = buildShellSnapshot(baseInput);

  assert.deepEqual(
    parseShellCommand({ type: "navigate", route: "/clients" }, snapshot),
    { type: "navigate", route: "/clients" }
  );
  assert.deepEqual(
    parseShellCommand(JSON.stringify({ type: "openTransaction", tab: "expense" }), snapshot),
    { type: "openTransaction", tab: "expense" }
  );
  assert.deepEqual(
    parseShellCommand({ type: "openTransaction" }, snapshot),
    { type: "openTransaction", tab: "income" }
  );
  assert.equal(parseShellCommand({ type: "openTransaction", tab: "otro" }, snapshot), null);
  assert.deepEqual(
    parseShellCommand({ type: "markNotificationRead", notificationId: "clx123abc" }, snapshot),
    { type: "markNotificationRead", notificationId: "clx123abc" }
  );

  assert.equal(parseShellCommand({ type: "navigate", route: "/ruta/desconocida" }, snapshot), null);
  assert.equal(parseShellCommand({ type: "navigate", route: "https://evil.example.com" }, snapshot), null);
  assert.equal(parseShellCommand({ type: "setTheme", variant: "neon" }, snapshot), null);
  assert.equal(parseShellCommand({ type: "markNotificationRead", notificationId: "otra" }, snapshot), null);
  assert.equal(parseShellCommand({ type: "eval", code: "alert(1)" }, snapshot), null);
  assert.equal(parseShellCommand("no-json", snapshot), null);
  assert.equal(parseShellCommand(null, snapshot), null);
});

test("el color primario inválido usa un respaldo seguro", () => {
  assert.equal(buildShellSnapshot({ ...baseInput, accentColor: "red" }).accentColor, "#3B82F6");
});

test("un usuario sin permisos no puede navegar a rutas de administración del menú", () => {
  const snapshot = buildShellSnapshot({ ...baseInput, user: { name: "Bea", role: "USER" } });

  assert.equal(parseShellCommand({ type: "navigate", route: "/admin/users" }, snapshot), null);
  assert.equal(parseShellCommand({ type: "navigate", route: "/finance/alerts" }, snapshot), null);
  assert.deepEqual(
    parseShellCommand({ type: "navigate", route: "/finance/transactions" }, snapshot),
    { type: "navigate", route: "/finance/transactions" }
  );
  assert.equal(parseShellCommand({ type: "openTransaction", tab: "income" }, snapshot), null);
  assert.deepEqual(
    parseShellCommand({ type: "openTransaction", tab: "expense" }, snapshot),
    { type: "openTransaction", tab: "expense" }
  );
});
