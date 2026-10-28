/**
 * The overdue ("Past") column sorts by priority only — P0 first — not by due
 * date. Michael, 2026-10-28: an old P3 sat above yesterday's P0.
 *
 * No DOM environment — we grep the static HTML template for the fetch that
 * fills that column. The board renders tasks in fetch order.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf-8");

describe("Past column ordering", () => {
  const pastFetch = html.match(/due_date=lt\.\$\{from\}&order=([^`]+)`/);

  it("has an overdue fetch with an explicit order", () => {
    assert.ok(pastFetch, "overdue fetch with order= not found");
  });

  it("orders by priority first", () => {
    assert.match(pastFetch[1], /^priority\.asc/);
  });

  it("does not use due_date as a sort key", () => {
    assert.doesNotMatch(pastFetch[1], /due_date/);
  });
});
