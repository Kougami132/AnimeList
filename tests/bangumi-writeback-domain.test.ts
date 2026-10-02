import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mediaStatusToBangumiTypeNumber,
  mapProgressToEpStatus,
  mapScoreToBangumiRate,
  isMediaWritebackDirty,
} from "../src/domain/bangumi-sync/writeback";

describe("Bangumi writeback domain mappings", () => {
  it("maps media statuses accurately to Bangumi collection type numbers", () => {
    assert.equal(mediaStatusToBangumiTypeNumber("ongoing"), 3);
    assert.equal(mediaStatusToBangumiTypeNumber("completed"), 2);
    assert.equal(mediaStatusToBangumiTypeNumber("planned"), 1);
    assert.equal(mediaStatusToBangumiTypeNumber("dropped"), 5);

    // Aliases
    assert.equal(mediaStatusToBangumiTypeNumber("watching"), 3);
    assert.equal(mediaStatusToBangumiTypeNumber("wishlist"), 1);
    assert.equal(mediaStatusToBangumiTypeNumber("paused"), 1);
    assert.equal(mediaStatusToBangumiTypeNumber("on_hold"), 1);

    // Unknown/empty
    assert.equal(mediaStatusToBangumiTypeNumber(""), null);
    assert.equal(mediaStatusToBangumiTypeNumber("unknown_xyz"), null);
    assert.equal(mediaStatusToBangumiTypeNumber(null), null);
    assert.equal(mediaStatusToBangumiTypeNumber(undefined), null);
  });

  it("maps progress to non-negative integer ep_status", () => {
    assert.equal(mapProgressToEpStatus(0), 0);
    assert.equal(mapProgressToEpStatus(5), 5);
    assert.equal(mapProgressToEpStatus(12.7), 12);
    assert.equal(mapProgressToEpStatus("8"), 8);
    assert.equal(mapProgressToEpStatus(-3), 0);
    assert.equal(mapProgressToEpStatus(null), 0);
    assert.equal(mapProgressToEpStatus(undefined), 0);
    assert.equal(mapProgressToEpStatus("invalid"), 0);
  });

  it("maps score to 1-10 integer rate or 0 when empty/cleared (floors decimal ratings)", () => {
    assert.equal(mapScoreToBangumiRate(null), 0);
    assert.equal(mapScoreToBangumiRate(undefined), 0);
    assert.equal(mapScoreToBangumiRate(""), 0);
    assert.equal(mapScoreToBangumiRate(0), 0);
    assert.equal(mapScoreToBangumiRate(-1), 0);
    assert.equal(mapScoreToBangumiRate(1), 1);
    assert.equal(mapScoreToBangumiRate(9.5), 9);
    assert.equal(mapScoreToBangumiRate(8.5), 8);
    assert.equal(mapScoreToBangumiRate(8.4), 8);
    assert.equal(mapScoreToBangumiRate(10), 10);
    assert.equal(mapScoreToBangumiRate(12), 10);
    assert.equal(mapScoreToBangumiRate("7.5"), 7);
  });

  it("performs dirty check correctly comparing previous against next state", () => {
    const base = {
      status: "ongoing",
      progress: 5,
      score: 8,
    };

    // Identical
    assert.equal(isMediaWritebackDirty(base, { status: "ongoing", progress: 5, score: 8 }), false);

    // Status changed
    assert.equal(isMediaWritebackDirty(base, { status: "completed", progress: 5, score: 8 }), true);

    // Progress changed
    assert.equal(isMediaWritebackDirty(base, { status: "ongoing", progress: 6, score: 8 }), true);

    // Score changed
    assert.equal(isMediaWritebackDirty(base, { status: "ongoing", progress: 5, score: 9 }), true);
    assert.equal(isMediaWritebackDirty(base, { status: "ongoing", progress: 5, score: null }), true);

    // Both null score
    assert.equal(
      isMediaWritebackDirty({ status: "ongoing", progress: 5, score: null }, { status: "ongoing", progress: 5, score: null }),
      false,
    );

    // Handled undefined or missing previous values
    assert.equal(
      isMediaWritebackDirty({}, { status: "ongoing", progress: 5, score: 8 }),
      true,
    );
  });
});
