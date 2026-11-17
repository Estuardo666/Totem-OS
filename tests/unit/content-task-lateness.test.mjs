import assert from "node:assert/strict";
import test from "node:test";
import { countsTowardTeamLateness, getLatenessOwner } from "../../src/lib/content-task-lateness.ts";

test("revisión de cliente y publicadas no cuentan como atraso del equipo", () => {
  assert.equal(countsTowardTeamLateness("REVIEW_CLIENT"), false);
  assert.equal(countsTowardTeamLateness("PUBLISHED"), false);
  assert.equal(countsTowardTeamLateness("EDITING"), true);
  assert.equal(countsTowardTeamLateness("CLIENT_APPROVED"), true);
});

test("el atraso de una tarea aprobada es de la community manager", () => {
  const task = { assignedEditor: "editor", assignedCommunity: "community" };
  assert.equal(getLatenessOwner({ ...task, status: "CLIENT_APPROVED" }), "community");
  assert.equal(getLatenessOwner({ ...task, status: "APPROVED" }), "community");
  assert.equal(getLatenessOwner({ ...task, status: "EDITING" }), "editor");
});

test("si falta el responsable natural se usa el otro asignado", () => {
  assert.equal(getLatenessOwner({ status: "CLIENT_APPROVED", assignedEditor: "editor", assignedCommunity: null }), "editor");
  assert.equal(getLatenessOwner({ status: "EDITING", assignedEditor: null, assignedCommunity: "community" }), "community");
  assert.equal(getLatenessOwner({ status: "EDITING" }), null);
});
