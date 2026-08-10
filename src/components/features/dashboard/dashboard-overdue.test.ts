import assert from "node:assert/strict";
import test from "node:test";
import {
  isOverdueBy24Hours,
  isOverdueEditingTask,
  isOverduePublicationTask,
} from "./dashboard-overdue";

const now = new Date("2026-08-10T18:00:00.000Z");

test("applies the 24-hour grace period exactly", () => {
  assert.equal(isOverdueBy24Hours({ dueDate: "2026-08-09T18:00:01.000Z", status: "EDITING" }, now), false);
  assert.equal(isOverdueBy24Hours({ dueDate: "2026-08-09T18:00:00.000Z", status: "EDITING" }, now), true);
  assert.equal(isOverdueBy24Hours({ dueDate: null, status: "EDITING" }, now), false);
});

test("only editing tasks count as overdue editing", () => {
  const dueDate = "2026-08-09T17:59:59.000Z";

  assert.equal(isOverdueEditingTask({ dueDate, status: "EDITING" }, now), true);
  assert.equal(isOverdueEditingTask({ dueDate, status: "REVIEW_CLIENT" }, now), false);
});

test("only approved and unpublished statuses count as overdue publication", () => {
  const dueDate = "2026-08-09T17:59:59.000Z";

  assert.equal(isOverduePublicationTask({ dueDate, status: "CLIENT_APPROVED" }, now), true);
  assert.equal(isOverduePublicationTask({ dueDate, status: "APPROVED" }, now), true);
  assert.equal(isOverduePublicationTask({ dueDate, status: "PUBLISHED" }, now), false);
  assert.equal(isOverduePublicationTask({ dueDate, status: "EDITING" }, now), false);
});
