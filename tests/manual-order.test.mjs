/**
 * Manual card order on the board (hypothesis 93a3635f), 2026-11-16.
 *
 * Michael: sorting by P level alone is not enough. He wants to drag a card up
 * or down inside a day and have it stay there, without changing its P level,
 * and change P from the board. Asked where a card should land when dragged to
 * another day: "start by putting it at its P-level".
 *
 * One rule covers every case: a card with a hand-set sort_order keeps its
 * place; a card without one (new, moved to another day, or re-prioritised)
 * slots in right after the last card whose priority is equal or higher.
 *
 * No DOM environment. The pure helpers sit between markers in the inline
 * script, so we pull that block out and run it; the wiring is checked by
 * reading the template.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf-8");

function helpers() {
  const start = html.indexOf("// --- card order ---");
  const end = html.indexOf("// --- end card order ---");
  assert.ok(start !== -1 && end > start, "card order block not found");
  return new Function(
    `${html.slice(start, end)}; return { orderColumn, dropIndex, reorderPatch, cyclePriority };`
  )();
}

const t = (id, priority, extra = {}) => ({
  id,
  priority,
  created_at: `2026-11-0${extra.day ?? 1}T00:00:00Z`,
  sort_order: null,
  ...extra,
});
const ids = (list) => list.map((x) => x.id);

describe("orderColumn", () => {
  it("with nothing placed by hand, sorts by priority then age (today's order)", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([t("c", 2), t("b", 1, { day: 2 }), t("a", 1, { day: 1 }), t("d", 0)]);
    assert.deepEqual(ids(out), ["d", "a", "b", "c"]);
  });

  it("keeps a hand-placed P3 above P1 cards", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([
      t("p1a", 1, { sort_order: 2000 }),
      t("p3", 3, { sort_order: 1000 }),
      t("p1b", 1, { sort_order: 3000 }),
    ]);
    assert.deepEqual(ids(out), ["p3", "p1a", "p1b"]);
  });

  it("slots an unplaced card after the last card of equal or higher priority", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([
      t("p3", 3, { sort_order: 1000 }),
      t("p1", 1, { sort_order: 2000 }),
      t("p4", 4, { sort_order: 3000 }),
      t("new-p2", 2),
    ]);
    assert.deepEqual(ids(out), ["p3", "p1", "new-p2", "p4"]);
  });

  it("puts an unplaced P0 at the top when nothing outranks it", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([t("p2", 2, { sort_order: 1000 }), t("p0", 0)]);
    assert.deepEqual(ids(out), ["p0", "p2"]);
  });

  it("keeps unplaced cards of the same priority oldest first", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([
      t("placed", 1, { sort_order: 1000 }),
      t("newer", 2, { day: 3 }),
      t("older", 2, { day: 1 }),
    ]);
    assert.deepEqual(ids(out), ["placed", "older", "newer"]);
  });

  it("treats a missing priority as P3", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([t("p4", 4), t("none", undefined), t("p2", 2)]);
    assert.deepEqual(ids(out), ["p2", "none", "p4"]);
  });

  it("still leads with the next card", () => {
    const { orderColumn } = helpers();
    const out = orderColumn([
      t("first", 1, { sort_order: 1000 }),
      t("starred", 4, { sort_order: 2000, is_next: true }),
    ]);
    assert.deepEqual(ids(out), ["starred", "first"]);
  });

  it("does not mutate its input", () => {
    const { orderColumn } = helpers();
    const input = [t("b", 2), t("a", 1)];
    orderColumn(input);
    assert.deepEqual(ids(input), ["b", "a"]);
  });
});

describe("dropIndex — where the pointer lands among the other cards", () => {
  it("counts the card midpoints above the pointer", () => {
    const { dropIndex } = helpers();
    assert.equal(dropIndex([100, 200, 300], 50), 0);
    assert.equal(dropIndex([100, 200, 300], 150), 1);
    assert.equal(dropIndex([100, 200, 300], 999), 3);
    assert.equal(dropIndex([], 10), 0);
  });
});

describe("reorderPatch — a drop inside the same column", () => {
  const col = [t("a", 1, { sort_order: 1000 }), t("b", 1, { sort_order: 2000 }), t("c", 3, { sort_order: 3000 })];

  it("moves the card to the drop index and renumbers the column", () => {
    const { reorderPatch } = helpers();
    const { order, patches } = reorderPatch(col, "c", 0);
    assert.deepEqual(order, ["c", "a", "b"]);
    assert.deepEqual(patches, [
      { id: "c", sort_order: 1000 },
      { id: "a", sort_order: 2000 },
      { id: "b", sort_order: 3000 },
    ]);
  });

  it("only patches cards whose number changed", () => {
    const { reorderPatch } = helpers();
    const { order, patches } = reorderPatch(col, "c", 1);
    assert.deepEqual(order, ["a", "c", "b"]);
    assert.deepEqual(patches, [
      { id: "c", sort_order: 2000 },
      { id: "b", sort_order: 3000 },
    ]);
  });

  it("gives unplaced cards a number so the whole day is pinned", () => {
    const { reorderPatch } = helpers();
    const { patches } = reorderPatch([t("x", 2), t("y", 2)], "y", 0);
    assert.deepEqual(patches, [
      { id: "y", sort_order: 1000 },
      { id: "x", sort_order: 2000 },
    ]);
  });

  it("is a no-op when the card is dropped where it already is", () => {
    const { reorderPatch } = helpers();
    assert.deepEqual(reorderPatch(col, "b", 1).patches, []);
  });

  it("clamps an index past the end to the bottom", () => {
    const { reorderPatch } = helpers();
    assert.deepEqual(reorderPatch(col, "a", 99).order, ["b", "c", "a"]);
  });
});

describe("cyclePriority — tapping the P pill", () => {
  it("steps P0 → P4 and wraps to P0", () => {
    const { cyclePriority } = helpers();
    assert.deepEqual([0, 1, 2, 3, 4].map(cyclePriority), [1, 2, 3, 4, 0]);
  });
  it("treats a missing priority as P3", () => {
    const { cyclePriority } = helpers();
    assert.equal(cyclePriority(undefined), 4);
    assert.equal(cyclePriority(null), 4);
  });
});

describe("wiring", () => {
  it("buildBoard orders each column with orderColumn", () => {
    assert.match(html, /orderColumn\(\s*tasks\.filter/);
  });

  it("the P pill is a tappable button carrying the task id", () => {
    assert.match(html, /<button[^>]*class="priority-pill pill-p\$\{p\}"[^>]*data-id="\$\{task\.id\}"/);
  });

  it("every move to another date clears sort_order so the card re-slots by P", () => {
    // drag drop, the inline date input and the edit sheet all go through moveToDate
    assert.match(html, /function moveToDate\([^)]*\)[\s\S]{0,800}sort_order: null/);
    assert.ok((html.match(/moveToDate\(/g) || []).length >= 3, "moveToDate is not shared by the move paths");
  });

  it("a priority change from the edit sheet clears sort_order too", () => {
    assert.match(html, /newPriority !== task\.priority\)[\s\S]{0,300}updates\.sort_order = null/);
  });

  it("has a touch path: long-press starts the drag and touchmove blocks scrolling", () => {
    assert.match(html, /addEventListener\('touchstart'/);
    assert.match(html, /addEventListener\('touchmove'[\s\S]{0,200}preventDefault\(\)[\s\S]{0,80}passive: false/);
    assert.match(html, /LONG_PRESS_MS/);
  });
});
