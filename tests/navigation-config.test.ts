import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { UserRole } from "../app/lib/auth";
import { getQuickActions, getSidebarNav } from "../app/lib/navigation";

const ROLES: UserRole[] = ["privat", "brf", "entreprenor"];

function flatten<T>(values: T[][]): T[] {
  return values.reduce<T[]>((acc, current) => [...acc, ...current], []);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function collectPageRoutesFromAppDir(appDir: string): Set<string> {
  const routes = new Set<string>();

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        return;
      }
      if (!entry.isFile() || entry.name !== "page.tsx") return;

      const rel = path.relative(appDir, full).replace(/\\/g, "/");
      const segmentPath = rel.replace(/\/page\.tsx$/, "");
      const normalized = segmentPath
        .split("/")
        .filter((segment) => segment.length > 0)
        .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
        .join("/");

      const route = normalized.length > 0 ? `/${normalized}` : "/";
      routes.add(route);
    });
  };

  walk(appDir);
  return routes;
}

describe("navigation config", () => {
  it("has no duplicate hrefs per role and includes required core sections", () => {
    for (const role of ROLES) {
      const groups = getSidebarNav(role);
      const groupIds = groups.map((group) => group.id);
      expect(groupIds).toEqual(unique(groupIds));

      const hrefs = flatten(groups.map((group) => group.items.map((item) => item.href)));
      expect(hrefs).toEqual(unique(hrefs));

      const requiredGroups = [
        "overview",
        "project",
        "requests",
        "documents",
        "files",
        "messages",
        "account",
      ];
      requiredGroups.forEach((required) => {
        expect(groupIds).toContain(required);
      });

      const filesGroup = groups.find((group) => group.id === "files");
      expect(filesGroup).toBeDefined();
      expect(filesGroup?.items).toHaveLength(1);
      expect(filesGroup?.items[0]?.href.includes("/filer")).toBe(true);

      const projectHrefs = groups
        .find((group) => group.id === "project")
        ?.items.map((item) => item.href) ?? [];
      if (role === "brf") {
        expect(projectHrefs).toContain("/dashboard/brf/planering");
      }
      if (role === "privat") {
        expect(projectHrefs).toContain("/dashboard/privat/planering");
      }
    }
  });

  it("points only to existing page routes (best-effort integrity check)", () => {
    const appDir = path.resolve(process.cwd(), "app");
    const existingRoutes = collectPageRoutesFromAppDir(appDir);

    for (const role of ROLES) {
      const sidebarHrefs = flatten(
        getSidebarNav(role).map((group) => group.items.map((item) => item.href))
      );
      const quickActionHrefs = getQuickActions(role).map((action) => action.href);
      const allHrefs = [...sidebarHrefs, ...quickActionHrefs];

      allHrefs.forEach((href) => {
        const clean = href.split("?")[0] || href;
        expect(existingRoutes.has(clean)).toBe(true);
      });
    }
  });
});
