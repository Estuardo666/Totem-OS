import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const swSource = fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
function worker() {
  const listeners = {}, notifications = [], opened = [];
  const self = {
    location: { origin: "https://totem.test" },
    registration: { showNotification: async (...args) => { notifications.push(args); } },
    clients: { matchAll: async () => [], openWindow: async (url) => { opened.push(url); } },
    addEventListener: (type, handler) => { listeners[type] = handler; },
  };
  vm.runInNewContext(swSource, { self, URL });
  async function dispatch(type, value) {
    let promise;
    listeners[type]({ ...value, waitUntil: (work) => { promise = work; } });
    await promise;
  }
  return { notifications, opened, dispatch };
}

test("VAPID payload displays its title/body even without OneSignal or an open client", async () => {
  const h = worker();
  await h.dispatch("push", { data: { json: () => ({ title: "Tarea", body: "Asignada", url: "/content" }) } });
  assert.equal(h.notifications.length, 1);
  assert.equal(h.notifications[0][0], "Tarea");
  assert.equal(h.notifications[0][1].body, "Asignada");
  assert.equal(h.notifications[0][1].data.url, "https://totem.test/content");
});

test("malformed and empty push messages still produce a visible fallback", async () => {
  const h = worker();
  await h.dispatch("push", { data: { json: () => { throw new Error("invalid JSON"); } } });
  await h.dispatch("push", {});
  assert.equal(h.notifications.length, 2);
  assert.equal(h.notifications[0][0], "Totem OS");
});

test("notification click opens only a same-origin destination", async () => {
  const h = worker();
  await h.dispatch("notificationclick", { notification: { close() {}, data: { url: "https://evil.test" } } });
  assert.equal(h.opened[0], "https://totem.test/");
});

test("existing subscription using another VAPID key is replaced before server registration", async () => {
  const writes = [];
  const fresh = { endpoint: "https://push.test/new", getKey: () => new Uint8Array([1, 2]).buffer };
  const registration = { pushManager: {
    getSubscription: async () => ({ endpoint: "https://push.test/old", options: { applicationServerKey: new Uint8Array([9]).buffer }, unsubscribe: async () => { writes.push("unsubscribe"); } }),
    subscribe: async () => { writes.push("subscribe"); return fresh; },
  } };
  const exports = {};
  const source = fs.readFileSync(new URL("../../src/components/providers/web-push-provider.tsx", import.meta.url), "utf8")
    .replace("function subscribeAndRegister", "export function subscribeAndRegister");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, {
    exports, require: () => ({}), process: { env: { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "AQI" } },
    navigator: { serviceWorker: { register: async () => registration, ready: Promise.resolve(registration) } },
    Notification: { permission: "granted" }, Uint8Array, atob, btoa,
    console: { log() {}, error() {} },
    fetch: async (_url, options) => { writes.push(options.method); return { ok: true }; },
  });
  assert.deepEqual(await Promise.all([exports.subscribeAndRegister(), exports.subscribeAndRegister()]), [true, true]);
  assert.deepEqual(writes, ["unsubscribe", "DELETE", "subscribe", "POST"]);
});
