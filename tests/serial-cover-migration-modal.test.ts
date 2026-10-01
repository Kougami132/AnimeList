import assert from "node:assert/strict";
import test from "node:test";
import { formatSerialCoverMigrationReport } from "../src/ui/serial-covers/migration-modal";

test("serial cover migration report summarizes counts and preserves detail order", () => {
  const output = formatSerialCoverMigrationReport({
    scanned: 5,
    loaded: 2,
    notFound: 1,
    failed: 1,
    skipped: 1,
    details: [{
      filePath: "AnimeList/Novel/Example.md",
      title: "Example title",
      label: "3",
      status: "loaded",
      message: "Cover loaded",
    }, {
      filePath: "AnimeList/Manga/Other.md",
      title: "Other title",
      label: "7",
      status: "not-found",
      message: "No confident match",
    }],
  });

  assert.equal(output, [
    "已扫描 5 个条目：成功获取 2，未找到 1，失败 1，跳过 1。",
    "已获取 · Example title · 3 · Cover loaded",
    "未找到 · Other title · 7 · No confident match",
  ].join("\n"));
});

test("serial cover migration report remains concise when there are no details", () => {
  assert.equal(formatSerialCoverMigrationReport({
    scanned: 0,
    loaded: 0,
    notFound: 0,
    failed: 0,
    skipped: 0,
    details: [],
  }), "已扫描 0 个条目：成功获取 0，未找到 0，失败 0，跳过 0。");
});
