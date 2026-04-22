/**
 * Static validation tests for the fullscreen description editor in the edit
 * modal. Hypothesis 1c375566.
 *
 * When a task's description gets long, the 80px textarea is unreadable.
 * This shipment adds:
 *   - a taller default textarea with auto-grow behavior
 *   - an ⛶ Expand button next to the existing Preview button
 *   - a #desc-fullscreen-modal (modal-in-modal) with a large textarea and a
 *     Preview ↔ Edit toggle
 *   - a Save path that syncs content back into the edit modal's textarea
 *
 * No DOM environment — we grep the static HTML template.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("index.html", import.meta.url), "utf-8");

describe("Description editor — bigger default textarea + autogrow", () => {
  it("the description textarea no longer caps at 80px min-height", () => {
    // Find the textarea styling block — it lives inside a .modal textarea rule.
    // Any min-height under 200px is a regression now; we expect >=240px.
    const match = html.match(/textarea\s*\{[^}]*min-height\s*:\s*(\d+)px/);
    assert.ok(match, "textarea CSS rule must specify a min-height");
    const mh = parseInt(match[1], 10);
    assert.ok(
      mh >= 240,
      `textarea min-height must be >= 240px for readable long descriptions (got ${mh}px)`,
    );
  });

  it("the description textarea is wired for auto-grow", () => {
    // A marker class or data attribute on the textarea that the inline JS
    // reads to grow the field with content. Accept either `data-autogrow`
    // or a CSS/JS hook that mentions autogrow by name.
    assert.ok(
      /id="edit-description"[^>]*data-autogrow/.test(html) ||
        /autogrow/i.test(html),
      "the description textarea must be wired for auto-grow",
    );
  });
});

describe("Description editor — ⛶ Expand button opens a fullscreen modal", () => {
  it("an Expand button sits next to the Preview button in the edit modal", () => {
    // Both buttons live within the same `<label>Description ... </label>`
    // block; we assert both ids live near each other in the source.
    const labelMatch = html.match(/<label>\s*Description[\s\S]{0,400}<\/label>/);
    assert.ok(labelMatch, "Description <label> block must exist");
    const block = labelMatch[0];
    assert.ok(
      /id="edit-description-preview"/.test(block),
      "the existing Preview button must remain in the Description label",
    );
    assert.ok(
      /id="edit-description-expand"/.test(block),
      "a new #edit-description-expand button must render in the Description label",
    );
  });

  it("the fullscreen modal element exists in the HTML", () => {
    assert.ok(
      /id="desc-fullscreen-modal"/.test(html),
      "a #desc-fullscreen-modal container must render so the Expand button can open it",
    );
  });

  it("the fullscreen modal contains a textarea and a Preview toggle", () => {
    const modalMatch = html.match(
      /id="desc-fullscreen-modal"[\s\S]{0,4000}?<\/div>\s*<\/div>/,
    );
    assert.ok(modalMatch, "#desc-fullscreen-modal block must be parseable");
    const block = modalMatch[0];
    assert.ok(
      /<textarea/.test(block),
      "the fullscreen modal must contain a textarea for editing",
    );
    // The edit ↔ preview toggle button. We look for any button inside the
    // fullscreen modal whose label or id references "preview" or "toggle".
    assert.ok(
      /id="desc-fullscreen-toggle"/.test(block) ||
        /<button[^>]*preview/i.test(block),
      "the fullscreen modal must expose a Preview/Edit toggle button",
    );
  });

  it("the inline JS wires the Expand button to open the fullscreen modal", () => {
    assert.ok(
      /getElementById\(['"]edit-description-expand['"]\)/.test(html) ||
        /['"]edit-description-expand['"][\s\S]{0,200}addEventListener/.test(html),
      "the Expand button must be wired up in the inline JS",
    );
  });
});
