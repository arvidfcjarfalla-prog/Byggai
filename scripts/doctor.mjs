import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

function ok(msg) {
  console.log("✅", msg);
}
function warn(msg) {
  console.log("⚠️", msg);
}
function bad(msg) {
  console.log("❌", msg);
}

function containsCssSelectors(text) {
  if (!text) return false;
  // väldigt enkel heuristik: "html," "body {" "@keyframes" osv
  return /(^|\n)\s*(html|body)\s*[,{\n]|@keyframes|{[^}]*}/m.test(text);
}

function run() {
  console.log("\n— Byggplattformen Doctor —\n");

  // 1) globals.css
  const globalsPathCandidates = ["app/globals.css", "app/global.css"];
  const globalsFound = globalsPathCandidates.find((p) => read(p) !== null);

  if (!globalsFound) {
    bad("Hittar varken app/globals.css eller app/global.css");
  } else {
    ok(`Hittade ${globalsFound}`);
    const css = read(globalsFound);

    if (!css.includes("@tailwind base;") || !css.includes("@tailwind utilities;")) {
      warn(`${globalsFound} saknar @tailwind-rader (base/components/utilities).`);
    } else {
      ok(`${globalsFound} har @tailwind-rader.`);
    }

    // @import måste ligga först om det används
    const importIndex = css.indexOf("@import");
    if (importIndex !== -1) {
      const before = css.slice(0, importIndex).trim();
      if (before.length > 0 && !before.startsWith("@charset") && !before.startsWith("@layer")) {
        warn(
          `${globalsFound} har @import som inte ligger först. Flytta @import längst upp (eller använd next/font).`
        );
      }
    }
  }

  // 2) postcss config
  const postcss = read("postcss.config.mjs") ?? read("postcss.config.js");
  if (!postcss) {
    bad("Hittar ingen postcss.config.(mjs/js).");
  } else {
    ok("Hittade PostCSS config.");
    if (containsCssSelectors(postcss)) {
      bad("Din postcss.config innehåller CSS (t.ex. html/body). Det ska vara ren JS-konfig.");
    } else {
      ok("PostCSS config ser ut att vara JS (inte CSS).");
    }
    if (postcss.includes("tailwindcss") && !postcss.includes("@tailwindcss/postcss")) {
      warn(
        "PostCSS verkar använda tailwindcss direkt. Med ny Tailwind behöver du '@tailwindcss/postcss' i plugins."
      );
    }
  }

  // 3) tailwind config
  const tailwind = read("tailwind.config.mjs") ?? read("tailwind.config.js");
  if (!tailwind) {
    bad("Hittar ingen tailwind.config.(mjs/js).");
  } else {
    ok("Hittade Tailwind config.");
    if (containsCssSelectors(tailwind)) {
      bad("Din tailwind.config innehåller CSS (t.ex. html/body). Det ska vara ren JS-konfig.");
    } else {
      ok("Tailwind config ser ut att vara JS (inte CSS).");
    }
  }

  // 4) package.json check
  const pkgRaw = read("package.json");
  if (!pkgRaw) {
    bad("Hittar inte package.json i projektroten.");
  } else {
    ok("Hittade package.json.");
    const pkg = JSON.parse(pkgRaw);

    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

    const hasTailwind = !!deps["tailwindcss"];
    const hasAutoprefixer = !!deps["autoprefixer"];
    const hasPostcss = !!deps["postcss"];
    const hasNewTailwindPostcss = !!deps["@tailwindcss/postcss"];

    if (!hasTailwind) bad("tailwindcss saknas i package.json.");
    else ok("tailwindcss finns.");

    if (!hasPostcss) bad("postcss saknas i package.json.");
    else ok("postcss finns.");

    if (!hasAutoprefixer) bad("autoprefixer saknas i package.json.");
    else ok("autoprefixer finns.");

    if (!hasNewTailwindPostcss) {
      warn("@tailwindcss/postcss saknas. Om du får fel om PostCSS-plugin behöver du installera den.");
    } else {
      ok("@tailwindcss/postcss finns.");
    }
  }

  console.log("\nKlart.\n");
}

run();
