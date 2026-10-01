import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScoreDashboardData,
  normalizeScoreDashboardScale,
  scoreDashboardPosterMetrics,
  scoreDashboardScores,
} from "../src/domain/score-dashboard/model";
import {
  planScoreDashboardMove,
  planScoreDashboardShift,
  scoreDashboardPlanNeedsClampConfirmation,
} from "../src/domain/score-dashboard/move";
import { applyScoreDashboardFrontmatter } from "../src/data/score-dashboard/score-service";
import { refreshScoreDashboardDomSummary } from "../src/ui/score-dashboard/dom-move";
import { ScoreDashboardView } from "../src/ui/score-dashboard/view";
import {
  renderScoreDashboard,
  visibleScoreDashboardPaths,
  type ScoreDashboardUiAdapters,
  type ScoreDashboardUiState,
} from "../src/ui/score-dashboard/renderer";
import {
  preserveScoreDashboardAnchorScrollTop,
  scoreDashboardScaleFromWheel,
  scoreDashboardWheelIntent,
} from "../src/domain/score-dashboard/gesture";
import type { LibraryFilters } from "../src/domain/library-filters";
import type { MediaItem, MediaType } from "../src/types";

function item(
  title: string,
  score: number | null,
  mediaType: MediaType = "anime",
  overrides: Partial<MediaItem> = {},
): MediaItem {
  return {
    title,
    originalTitle: "",
    mediaType,
    format: "",
    status: "completed",
    releaseStatus: "finished",
    progress: 0,
    total: 0,
    unit: "",
    score,
    favorite: false,
    year: "",
    genres: [],
    people: [],
    platforms: [],
    sourceUrls: [],
    cover: "",
    filePath: `${title}.md`,
    updated: 0,
    updatedLabel: "",
    startedAt: "",
    completedAt: "",
    volumeLog: [],
    ...overrides,
  };
}

describe("score dashboard model", () => {
  it("creates all 21 half-point lanes in descending order", () => {
    const scores = scoreDashboardScores();
    assert.equal(scores.length, 21);
    assert.equal(scores[0], 10);
    assert.equal(scores.at(-1), 0);
  });

  it("groups 10 alone and other integer bands with their half-point lane", () => {
    const data = buildScoreDashboardData([item("A", 10), item("B", 9.5), item("C", 9)]);
    assert.deepEqual(data.groups[0].lanes.map((lane) => lane.score), [10]);
    assert.deepEqual(data.groups[1].lanes.map((lane) => lane.score), [9.5, 9]);
    assert.equal(data.groups[1].itemCount, 2);
  });

  it("rounds legacy scores for display without changing source items", () => {
    const legacy = item("Legacy", 8.7);
    const data = buildScoreDashboardData([legacy]);
    assert.equal(data.groups.find((group) => group.major === 8)?.lanes[0].items[0], legacy);
    assert.equal(legacy.score, 8.7);
  });

  it("keeps score zero separate from unrated", () => {
    const data = buildScoreDashboardData([item("Zero", 0), item("None", null)]);
    assert.equal(data.groups.at(-1)?.lanes[1].items[0].title, "Zero");
    assert.equal(data.unrated[0].title, "None");
  });

  it("filters by media type before counting", () => {
    const data = buildScoreDashboardData([item("Anime", 9, "anime"), item("Manga", 8, "manga")], "manga");
    assert.equal(data.total, 1);
    assert.equal(data.rated, 1);
  });

  it("filters items and counts using library filters", () => {
    const matched = item("Match", 9, "anime", {
      people: ["A-1 Pictures"],
      season: "winter",
      seasonYear: 2024,
      genres: ["Action", "Sci-Fi"],
    });
    const mismatchedCompany = item("Wrong Studio", 9, "anime", {
      people: ["Kyoto Animation"],
      season: "winter",
      seasonYear: 2024,
      genres: ["Action"],
    });
    const mismatchedTag = item("Missing Tag", 9, "anime", {
      people: ["A-1 Pictures"],
      season: "winter",
      seasonYear: 2024,
      genres: ["Drama"],
    });
    const unratedMatched = item("Unrated Match", null, "anime", {
      people: ["A-1 Pictures"],
      season: "winter",
      seasonYear: 2024,
      genres: ["Action"],
    });
    const filters: LibraryFilters = {
      companies: ["A-1 Pictures"],
      quarter: "2024:winter",
      tags: ["Action"],
    };

    const data = buildScoreDashboardData(
      [matched, mismatchedCompany, mismatchedTag, unratedMatched],
      "anime",
      filters,
    );
    assert.equal(data.total, 2);
    assert.equal(data.rated, 1);
    assert.equal(data.groups.find((group) => group.major === 9)?.lanes[1].items[0].title, "Match");
    assert.equal(data.unrated[0].title, "Unrated Match");
  });

  it("clamps and snaps slider zoom values from 20 to 200 percent", () => {
    assert.equal(normalizeScoreDashboardScale(1), 20);
    assert.equal(normalizeScoreDashboardScale(20), 20);
    assert.equal(normalizeScoreDashboardScale(23), 25);
    assert.equal(normalizeScoreDashboardScale(113), 115);
    assert.equal(normalizeScoreDashboardScale(999), 200);
  });

  it("keeps continuous gesture scale when calculating poster metrics", () => {
    const metrics = scoreDashboardPosterMetrics(101.5);
    assert.equal(metrics.scale, 101.5);
    assert.ok(Math.abs(metrics.posterWidth - 73.5875) < 1e-9);
  });
});

describe("score dashboard score moves", () => {
  it("moves rated or unrated items directly to a target score", () => {
    const plan = planScoreDashboardMove([
      { filePath: "rated.md", score: 8 },
      { filePath: "unrated.md", score: null },
    ], 9.5);
    assert.deepEqual(plan.changes.map((change) => change.nextScore), [9.5, 9.5]);
    assert.equal(plan.blockedUnratedPaths.length, 0);
  });

  it("allows moving a rated item back to unrated", () => {
    const plan = planScoreDashboardMove([{ filePath: "rated.md", score: 8 }], null);
    assert.equal(plan.changes[0].nextScore, null);
  });

  it("blocks the entire shift when any selected item is unrated", () => {
    const plan = planScoreDashboardShift([
      { filePath: "rated.md", score: 8 },
      { filePath: "unrated.md", score: null },
    ], 1);
    assert.equal(plan.changes.length, 0);
    assert.deepEqual(plan.blockedUnratedPaths, ["unrated.md"]);
  });

  it("shifts by half a point and reports values that need clamping", () => {
    const up = planScoreDashboardShift([
      { filePath: "nine.md", score: 9 },
      { filePath: "ten.md", score: 10 },
    ], 1);
    assert.deepEqual(up.changes.map((change) => change.nextScore), [9.5, 10]);
    assert.deepEqual(up.clampedHighPaths, ["ten.md"]);
    assert.equal(scoreDashboardPlanNeedsClampConfirmation(up), true);

    const down = planScoreDashboardShift([{ filePath: "zero.md", score: 0 }], -1);
    assert.equal(down.changes[0].nextScore, 0);
    assert.deepEqual(down.clampedLowPaths, ["zero.md"]);
  });

  it("removes only score and update timestamps when moving to unrated", () => {
    const frontmatter: Record<string, unknown> = {
      title: "Keep me",
      score: 8,
      favorite: true,
      updated_at: "old",
      metadata_updated_at: "old",
    };
    applyScoreDashboardFrontmatter(frontmatter, null);
    assert.deepEqual(frontmatter, { title: "Keep me", favorite: true });
  });

  it("selects only currently displayed items for batch select all", () => {
    const items = [item("Anime", 8, "anime"), item("Hidden unrated", null, "anime"), item("Manga", 7, "manga")];
    assert.deepEqual(visibleScoreDashboardPaths(items, "anime", false), ["Anime.md"]);
    assert.deepEqual(visibleScoreDashboardPaths(items, "anime", true), ["Anime.md", "Hidden unrated.md"]);
  });

  it("filters visible items by library filters for batch selection", () => {
    const matched = item("Match", 8, "anime", { genres: ["Action"] });
    const mismatched = item("Other", 8, "anime", { genres: ["Comedy"] });
    const filters: LibraryFilters = {
      companies: [],
      quarter: "",
      tags: ["Action"],
    };
    assert.deepEqual(
      visibleScoreDashboardPaths([matched, mismatched], "anime", false, filters),
      ["Match.md"],
    );
  });
});

describe("score dashboard gestures", () => {
  it("leaves ordinary wheel input as native scrolling", () => {
    assert.equal(scoreDashboardWheelIntent({ ctrlKey: false }), "scroll");
  });

  it("uses ctrl-modified wheel input for pinch or ctrl-wheel zoom", () => {
    assert.equal(scoreDashboardWheelIntent({ ctrlKey: true }), "zoom");
  });

  it("accumulates smooth wheel zoom without five-percent snapping", () => {
    const zoomedIn = scoreDashboardScaleFromWheel(100, -10, 20, 200);
    const zoomedOut = scoreDashboardScaleFromWheel(100, 10, 20, 200);
    assert.ok(zoomedIn > 100 && zoomedIn < 105);
    assert.ok(zoomedOut < 100 && zoomedOut > 95);
  });

  it("clamps gesture zoom to the supported range", () => {
    assert.equal(scoreDashboardScaleFromWheel(199, -1000, 20, 200), 200);
    assert.equal(scoreDashboardScaleFromWheel(21, 1000, 20, 200), 20);
  });

  it("preserves the same visual anchor after layout reflow", () => {
    assert.equal(preserveScoreDashboardAnchorScrollTop(400, 240, 300), 460);
    assert.equal(preserveScoreDashboardAnchorScrollTop(20, 100, 40), 0);
  });
});

class MockDomNode {
  className = "";
  textContent = "";
  title = "";
  type = "";
  disabled = false;
  draggable = false;
  value = "";
  min = "";
  max = "";
  step = "";
  src = "";
  alt = "";
  loading = "";
  decoding = "";
  children: MockDomNode[] = [];
  parentElement: MockDomNode | null = null;
  dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: any) => void>>();
  readonly inlineStyles = new Map<string, string>();

  readonly classList = {
    add: (...classes: string[]) => {
      const set = new Set(this.className.split(" ").filter(Boolean));
      classes.forEach((c) => set.add(c));
      this.className = [...set].join(" ");
    },
    remove: (...classes: string[]) => {
      const set = new Set(this.className.split(" ").filter(Boolean));
      classes.forEach((c) => set.delete(c));
      this.className = [...set].join(" ");
    },
    toggle: (c: string, force?: boolean) => {
      const has = this.classList.contains(c);
      const next = force !== undefined ? force : !has;
      if (next) this.classList.add(c);
      else this.classList.remove(c);
      return next;
    },
    contains: (c: string) => this.className.split(" ").filter(Boolean).includes(c),
  };

  readonly style = {
    setProperty: (name: string, value: string) => { this.inlineStyles.set(name, value); },
    getPropertyValue: (name: string) => this.inlineStyles.get(name) ?? "",
  };

  readonly ownerDocument = {
    defaultView: {
      setTimeout: (fn: () => void) => { fn(); return 1; },
      clearTimeout: () => {},
      requestAnimationFrame: (fn: () => void) => { fn(); return 1; },
    },
    elementFromPoint: () => null,
  };

  constructor(readonly tagName: string) {}

  get isConnected(): boolean {
    return this.parentElement ? this.parentElement.isConnected : true;
  }

  append(...nodes: MockDomNode[]): void {
    nodes.forEach((node) => this.appendChild(node));
  }

  appendChild(node: MockDomNode): MockDomNode {
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes: MockDomNode[]): void {
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  click(): void {
    const list = this.listeners.get("click") ?? [];
    list.forEach((fn) => fn({ target: this, defaultPrevented: false, preventDefault() {} }));
  }

  querySelector<T = MockDomNode>(selector: string): T | null {
    const all = this.querySelectorAll<T>(selector);
    return all.length ? all[0] : null;
  }

  querySelectorAll<T = MockDomNode>(selector: string): T[] {
    if (selector.includes(",")) {
      const parts = selector.split(",").map((s) => s.trim()).filter(Boolean);
      const set = new Set<MockDomNode>();
      for (const part of parts) {
        for (const node of this.querySelectorAll<MockDomNode>(part)) {
          set.add(node);
        }
      }
      return [...set] as unknown as T[];
    }
    const tokens = selector.trim().split(/\s+/);
    if (tokens.length > 1) {
      const [first, ...rest] = tokens;
      const restSelector = rest.join(" ");
      const firstMatches = this.querySelectorAll<MockDomNode>(first);
      const results: MockDomNode[] = [];
      for (const match of firstMatches) {
        results.push(...match.querySelectorAll<MockDomNode>(restSelector));
      }
      return results as unknown as T[];
    }
    const single = tokens[0];
    const results: MockDomNode[] = [];
    const check = (node: MockDomNode) => {
      let match = true;
      let target = single;
      if (target.includes(":first-child")) {
        target = target.replace(":first-child", "");
        if (node.parentElement?.children[0] !== node) match = false;
      }
      if (target.includes(":last-child")) {
        target = target.replace(":last-child", "");
        if (node.parentElement?.children.at(-1) !== node) match = false;
      }
      if (match && target) {
        if (target.startsWith(".")) {
          const cls = target.slice(1);
          if (!node.classList.contains(cls)) match = false;
        } else if (target.startsWith("[") && target.endsWith("]")) {
          const [attr, val] = target.slice(1, -1).split("=");
          const rawAttr = attr.startsWith("data-") ? node.dataset[attr.slice(5)] : node.getAttribute(attr);
          const expectedVal = val ? val.replace(/^["']|["']$/g, "") : undefined;
          if (expectedVal !== undefined ? rawAttr !== expectedVal : rawAttr == null) match = false;
        } else if (target === "button" && node.tagName.toLowerCase() !== "button") {
          match = false;
        }
      }
      if (match) results.push(node);
      for (const child of node.children) check(child);
    };
    for (const child of this.children) check(child);
    return results as unknown as T[];
  }

  closest<T = MockDomNode>(selector: string): T | null {
    if (selector.startsWith(".")) {
      if (this.classList.contains(selector.slice(1))) return this as unknown as T;
    }
    return this.parentElement ? this.parentElement.closest<T>(selector) : null;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 100 };
  }
}

describe("score dashboard filter UI", () => {
  const originalCreateEl = globalThis.createEl;

  it("renders a filter button and opens filter modal on click, then applies filters", () => {
    Object.defineProperty(globalThis, "createEl", {
      configurable: true,
      value: (tag: string) => new MockDomNode(tag),
    });

    try {
      const container = new MockDomNode("div");
      const items = [
        item("Item 1", 9, "anime", { people: ["A-1 Pictures"], season: "winter", seasonYear: 2024, genres: ["Action"] }),
        item("Item 2", 9, "anime", { people: ["CloverWorks"], season: "spring", seasonYear: 2024, genres: ["Comedy"] }),
      ];

      let openModalCalled = false;
      let appliedState: ScoreDashboardUiState | null = null;
      let modalFilters: any = null;
      let modalOptions: any = null;
      let modalApplyCallback: ((f: any) => void) | null = null;

      const adapters: ScoreDashboardUiAdapters = {
        openFile: () => {},
        applyChanges: async () => {},
        confirmClamp: async () => true,
        showNotice: () => {},
        onStateChange: (state) => { appliedState = state; },
        openFilterModal: (filters, options, onApply) => {
          openModalCalled = true;
          modalFilters = filters;
          modalOptions = options;
          modalApplyCallback = onApply;
        },
      };

      renderScoreDashboard(
        container as unknown as HTMLElement,
        items,
        { type: "all", scale: 100, showUnrated: false },
        adapters,
      );

      const filterButton = container.querySelector<MockDomNode>("[data-action='filter']");
      assert.ok(filterButton, "Filter button should be rendered in dashboard controls");
      assert.equal(filterButton.disabled, false);
      assert.equal(filterButton.classList.contains("is-active"), false);

      // Initially both items are in the board
      const initialPosters = container.querySelectorAll<MockDomNode>(".al-score-poster");
      assert.equal(initialPosters.length, 2);

      // Click filter button
      filterButton.click();
      assert.equal(openModalCalled, true);
      assert.deepEqual(modalFilters, { companies: [], quarter: "", tags: [] });
      assert.ok(modalOptions.companies.includes("A-1 Pictures"));
      assert.ok(modalOptions.companies.includes("CloverWorks"));

      // Apply filter for A-1 Pictures
      modalApplyCallback!({ companies: ["A-1 Pictures"], quarter: "", tags: [] });

      // After applying:
      assert.equal(filterButton.classList.contains("is-active"), true);
      assert.deepEqual(appliedState?.filters, { companies: ["A-1 Pictures"], quarter: "", tags: [] });

      // Board should now only show Item 1
      const filteredPosters = container.querySelectorAll<MockDomNode>(".al-score-poster");
      assert.equal(filteredPosters.length, 1);
      assert.equal(filteredPosters[0].dataset.filePath, "Item 1.md");
    } finally {
      Object.defineProperty(globalThis, "createEl", { configurable: true, value: originalCreateEl });
    }
  });

  it("disables filter button if openFilterModal adapter is not provided", () => {
    Object.defineProperty(globalThis, "createEl", {
      configurable: true,
      value: (tag: string) => new MockDomNode(tag),
    });

    try {
      const container = new MockDomNode("div");
      const items = [item("Item 1", 9, "anime")];
      const adapters: ScoreDashboardUiAdapters = {
        openFile: () => {},
        applyChanges: async () => {},
        confirmClamp: async () => true,
        showNotice: () => {},
        onStateChange: () => {},
      };

      renderScoreDashboard(
        container as unknown as HTMLElement,
        items,
        { type: "all", scale: 100, showUnrated: false },
        adapters,
      );

      const filterButton = container.querySelector<MockDomNode>("[data-action='filter']");
      assert.ok(filterButton, "Filter button should be rendered in dashboard controls");
      assert.equal(filterButton.disabled, true);
    } finally {
      Object.defineProperty(globalThis, "createEl", { configurable: true, value: originalCreateEl });
    }
  });
});

describe("score dashboard DOM summary refresh", () => {
  it("reflects active filters when updating summary and unrated badge", () => {
    const container = new MockDomNode("div");
    const summary = new MockDomNode("div");
    summary.className = "al-score-dashboard-summary";

    const actionGroup = new MockDomNode("div");
    actionGroup.className = "al-score-dashboard-action-group";
    const unratedButton = new MockDomNode("button");
    unratedButton.className = "al-score-tool-button";
    unratedButton.dataset.action = "unrated";
    const badge = new MockDomNode("span");
    badge.className = "al-score-tool-badge";
    unratedButton.appendChild(badge);
    actionGroup.appendChild(unratedButton);

    container.appendChild(summary);
    container.appendChild(actionGroup);

    const items = [
      item("Match Rated", 9, "anime", { genres: ["Action"] }),
      item("Match Unrated", null, "anime", { genres: ["Action"] }),
      item("Other Rated", 9, "anime", { genres: ["Comedy"] }),
      item("Other Unrated", null, "anime", { genres: ["Comedy"] }),
    ];

    const filters: LibraryFilters = {
      companies: [],
      quarter: "",
      tags: ["Action"],
    };

    refreshScoreDashboardDomSummary(
      container as unknown as HTMLElement,
      items,
      "anime",
      filters,
    );

    assert.equal(badge.textContent, "1");
    assert.ok(/1[／/]2/.test(summary.textContent));
  });
});

describe("score dashboard view state persistence", () => {
  it("persists and restores library filters", async () => {
    const pluginHost: any = {
      collectMediaItems: () => [],
      openMediaFile: async () => {},
      applyScoreChanges: async () => {},
      confirmScoreClamp: async () => true,
      showNotice: () => {},
    };
    const leaf: any = {};
    const view = new ScoreDashboardView(leaf, pluginHost);
    (view as any).render = () => {};

    await view.setState({
      type: "anime",
      scale: 100,
      showUnrated: true,
      filters: {
        companies: ["Kyoto Animation"],
        quarter: "2024:winter",
        tags: ["Slice of Life"],
      },
    });

    const state = view.getState();
    assert.deepEqual(state.filters, {
      companies: ["Kyoto Animation"],
      quarter: "2024:winter",
      tags: ["Slice of Life"],
    });
  });
});
