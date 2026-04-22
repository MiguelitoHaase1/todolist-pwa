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

const html = readFileSync(new URL("../index.html", import.meta.url), "utf-8");

describe("Description editor — bigger default textarea + autogrow", () => {
  it("the description textarea min-height is bigger than pre-ship but bounded", () => {
    // Pre-1c375566 was 80px. First pass (1c375566) set 280px — too tall on
    // mobile, pushing Save/Drop below the fold. Post-86f46774 tunes it to
    // the [120, 200] window: roomy enough to read a few paragraphs without
    // crowding out the action buttons.
    const match = html.match(/textarea\s*\{[^}]*min-height\s*:\s*(\d+)px/);
    assert.ok(match, "textarea CSS rule must specify a min-height");
    const mh = parseInt(match[1], 10);
    assert.ok(
      mh >= 120 && mh <= 200,
      `textarea min-height must be in [120, 200] px (got ${mh}px)`,
    );
  });

  it("autogrow caps below 40% of viewport so action buttons stay reachable", () => {
    // 1c375566 used 0.7 * innerHeight — too generous. 86f46774 caps at
    // <= 0.4 so long content scrolls inside the textarea rather than
    // pushing buttons below the fold.
    const multipliers = [...html.matchAll(/innerHeight\s*\*\s*0?\.(\d+)/g)].map((m) =>
      parseFloat("0." + m[1]),
    );
    assert.ok(
      multipliers.length > 0,
      "autogrow block must reference innerHeight * <fraction>",
    );
    const max = Math.max(...multipliers);
    assert.ok(
      max <= 0.4,
      `autogrow cap must be <= 0.4 * innerHeight (found max ${max})`,
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
    // The fullscreen modal has nested divs, so take a 5k-char window from the
    // opening marker — this window is roomy enough to carry the textarea AND
    // the footer-level Preview/Edit toggle button.
    const start = html.indexOf('id="desc-fullscreen-modal"');
    assert.ok(start !== -1, "#desc-fullscreen-modal must render");
    const block = html.slice(start, start + 5000);
    assert.ok(
      /<textarea/.test(block),
      "the fullscreen modal must contain a textarea for editing",
    );
    assert.ok(
      /id="desc-fullscreen-toggle"/.test(block),
      "the fullscreen modal must expose a Preview/Edit toggle (#desc-fullscreen-toggle)",
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

// --- Mobile-first exit from fullscreen editor (cc087344) ---
describe("Fullscreen editor — mobile-first exit path", () => {
  it("a persistent top-right close button exists in the fullscreen modal", () => {
    const start = html.indexOf('id="desc-fullscreen-modal"');
    assert.ok(start !== -1, "#desc-fullscreen-modal must render");
    const block = html.slice(start, start + 5000);
    assert.ok(
      /id="desc-fullscreen-close-x"/.test(block),
      "a top-right close button (#desc-fullscreen-close-x) must render inside the fullscreen modal",
    );
    assert.ok(
      /aria-label=["'][^"']*close/i.test(block),
      "the close button must carry an aria-label mentioning 'close'",
    );
  });

  it("the fullscreen modal header is sticky so the close button stays visible", () => {
    // Either position: sticky or position: fixed on the modal's header
    // region — anything that keeps it on-screen while the content scrolls.
    const cssStart = html.indexOf(".desc-fullscreen-modal");
    assert.ok(cssStart !== -1, ".desc-fullscreen-modal CSS rules must exist");
    const cssBlock = html.slice(cssStart, cssStart + 4000);
    assert.ok(
      /position:\s*(sticky|fixed)/i.test(cssBlock),
      "the fullscreen modal header must use position: sticky (or fixed) so the close button stays on-screen",
    );
  });

  it("the fullscreen modal respects iOS safe-area-inset-top", () => {
    const cssStart = html.indexOf(".desc-fullscreen-modal");
    const cssBlock = html.slice(cssStart, cssStart + 4000);
    assert.ok(
      /safe-area-inset-top/.test(cssBlock),
      "the fullscreen header must pad by safe-area-inset-top so the close button clears the iOS notch",
    );
  });
});
