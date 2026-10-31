/**
 * Snooze and next on the board (hypotheses e63cae98, 3930fe40), 2026-10-31.
 *
 * Michael wanted both buttons on THIS board, not on the brew's backlog cards.
 * Snooze greys a card in place until 05:00 Copenhagen next morning; tap again
 * to lift it. Next marks exactly ONE card and stays until he changes it.
 *
 * No DOM environment. The pure helpers sit between markers in the inline
 * script, so we pull that block out and run it.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf-8");

function helpers() {
  const start = html.indexOf("// --- card state ---");
  const end = html.indexOf("// --- end card state ---");
  assert.ok(start !== -1 && end > start, "card state block not found");
  return new Function(`${html.slice(start, end)}; return { snoozeUntil, isSnoozed, cardStateClass };`)();
}

describe("snoozeUntil — next 05:00 in Copenhagen", () => {
  it("an evening snooze in winter wears off at 05:00 CET", () => {
    assert.equal(helpers().snoozeUntil(new Date("2026-11-10T19:00:00Z")), "2026-11-11T04:00:00.000Z");
  });
  it("an evening snooze in summer wears off at 05:00 CEST", () => {
    assert.equal(helpers().snoozeUntil(new Date("2026-07-01T19:00:00Z")), "2026-07-02T03:00:00.000Z");
  });
  it("a snooze after midnight wears off the same morning", () => {
    assert.equal(helpers().snoozeUntil(new Date("2026-11-11T00:30:00Z")), "2026-11-11T04:00:00.000Z");
  });
  it("handles the night the clocks go back", () => {
    assert.equal(helpers().snoozeUntil(new Date("2026-10-24T20:00:00Z")), "2026-10-25T04:00:00.000Z");
  });
});

describe("card state", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("a running snooze greys the card", () => {
    assert.equal(helpers().cardStateClass({ snoozed_until: "2026-11-11T04:00:00Z" }, now), " is-snoozed");
  });
  it("an expired snooze does nothing, no cron needed", () => {
    assert.equal(helpers().cardStateClass({ snoozed_until: "2026-11-10T04:00:00Z" }, now), "");
  });
  it("the next card is never greyed", () => {
    assert.equal(helpers().cardStateClass({ is_next: true, snoozed_until: "2026-11-11T04:00:00Z" }, now), " is-next");
  });
  it("a plain card gets no class", () => {
    assert.equal(helpers().cardStateClass({}, now), "");
  });
});

describe("board wiring", () => {
  it("each card has a snooze and a next button", () => {
    assert.match(html, /class="action-btn snooze-btn"/);
    assert.match(html, /class="action-btn next-btn"/);
  });
  it("the card carries its state class", () => {
    assert.match(html, /class="task-card\$\{cardStateClass\(task, new Date\(\)\)\}"/);
  });
  it("moves the next mark with one RPC call", () => {
    assert.match(html, /rest\/v1\/rpc\/set_next_task/);
  });
  it("puts the next card at the top of its column", () => {
    assert.match(html, /colTasks\.sort\(\(a, b\) => \(b\.is_next === true\) - \(a\.is_next === true\)\)/);
  });
  it("styles both states", () => {
    assert.match(html, /\.task-card\.is-snoozed\s*\{[^}]*opacity/);
    assert.match(html, /\.task-card\.is-next\s*\{[^}]*var\(--coral\)/);
  });
});
