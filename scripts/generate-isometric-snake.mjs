import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const DAYS_PER_WEEK = 7;
const WEEKS = 53;
const CELL_WIDTH = 12;
const CELL_HEIGHT = 6;
const CUBE_HEIGHT = 4;
const MARGIN_X = 104;
const MARGIN_Y = 36;

const outputPath = process.argv[2] ?? "dist/isometric-contribution-snake.svg";
const username = process.env.GITHUB_USERNAME ?? process.env.GITHUB_REPOSITORY_OWNER ?? "Pranav-s79";

const formatDate = (date) => date.toISOString().slice(0, 10);

function contributionDateRange() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (WEEKS * DAYS_PER_WEEK - 1));
  return { start, end };
}

async function fetchContributionLevels(start, end) {
  const url = new URL(`https://github.com/users/${encodeURIComponent(username)}/contributions`);
  url.searchParams.set("from", formatDate(start));
  url.searchParams.set("to", formatDate(end));

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html",
        "User-Agent": "isometric-contribution-snake",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const markup = await response.text();
    const levels = new Map();
    for (const tag of markup.matchAll(/<(?:rect|td)\b[^>]*>/g)) {
      const date = tag[0].match(/\bdata-date="(\d{4}-\d{2}-\d{2})"/);
      const level = tag[0].match(/\bdata-level="(\d)"/);
      if (date && level) levels.set(date[1], Number(level[1]));
    }

    if (levels.size === 0) throw new Error("No contribution cells found in GitHub response");
    return levels;
  } catch (error) {
    console.warn(`Could not fetch contribution data (${error.message}); generating an empty calendar.`);
    return new Map();
  }
}

function point(x, y) {
  return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
}

function cube({ x, y, level, className = "cell", style = "" }) {
  const height = level === 0 ? 1 : level * CUBE_HEIGHT + 2;
  const top = [
    point(x, y - CELL_HEIGHT),
    point(x + CELL_WIDTH, y),
    point(x, y + CELL_HEIGHT),
    point(x - CELL_WIDTH, y),
  ].join(" ");
  const right = [
    point(x + CELL_WIDTH, y),
    point(x, y + CELL_HEIGHT),
    point(x, y + CELL_HEIGHT + height),
    point(x + CELL_WIDTH, y + height),
  ].join(" ");
  const left = [
    point(x - CELL_WIDTH, y),
    point(x, y + CELL_HEIGHT),
    point(x, y + CELL_HEIGHT + height),
    point(x - CELL_WIDTH, y + height),
  ].join(" ");

  return `<g class="${className} level-${level}"${style ? ` style="${style}"` : ""}>
    <polygon class="top" points="${top}" />
    <polygon class="left" points="${left}" />
    <polygon class="right" points="${right}" />
  </g>`;
}

function escapeXml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;",
  })[character]);
}

const { start, end } = contributionDateRange();
const levels = await fetchContributionLevels(start, end);
const cells = [];

for (let week = 0; week < WEEKS; week += 1) {
  for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + week * DAYS_PER_WEEK + day);
    cells.push({
      date: formatDate(date),
      level: levels.get(formatDate(date)) ?? 0,
      x: MARGIN_X + (week - day) * CELL_WIDTH,
      y: MARGIN_Y + (week + day) * CELL_HEIGHT,
      week,
      day,
    });
  }
}

const activeCells = cells.filter((cell) => cell.level > 0);
const snakeCells = activeCells.length > 0 ? activeCells : cells;
const viewBoxWidth = MARGIN_X + (WEEKS - 1) * CELL_WIDTH + 168;
const viewBoxHeight = MARGIN_Y + (WEEKS + DAYS_PER_WEEK) * CELL_HEIGHT + 58;
const title = `${username}'s animated isometric GitHub contribution calendar`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">A 53-week isometric calendar where a glowing snake travels across GitHub contribution cubes.</desc>
  <defs>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
    <style>
      .label { fill: #8b949e; font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      .cell .top { fill: #e8edf2; } .cell .left { fill: #d0d7de; } .cell .right { fill: #c4cdd7; }
      .cell.level-1 .top { fill: #ddd6fe; } .cell.level-1 .left { fill: #c4b5fd; } .cell.level-1 .right { fill: #b7a4ee; }
      .cell.level-2 .top { fill: #c4b5fd; } .cell.level-2 .left { fill: #a78bfa; } .cell.level-2 .right { fill: #9174e1; }
      .cell.level-3 .top { fill: #a78bfa; } .cell.level-3 .left { fill: #8b5cf6; } .cell.level-3 .right { fill: #7447dc; }
      .cell.level-4 .top { fill: #8b5cf6; } .cell.level-4 .left { fill: #6d28d9; } .cell.level-4 .right { fill: #5b21b6; }
      .snake { filter: url(#glow); opacity: 0; animation: slither 20s linear infinite; }
      .snake .top { fill: #f5f3ff; } .snake .left { fill: #8b5cf6; } .snake .right { fill: #5b21b6; }
      @keyframes slither { 0%, 1% { opacity: 1; } 7%, 100% { opacity: 0; } }
      @media (prefers-color-scheme: dark) {
        .label { fill: #8b949e; } .cell .top { fill: #21262d; } .cell .left { fill: #161b22; } .cell .right { fill: #30363d; }
      }
    </style>
  </defs>
  <text class="label" x="24" y="26">Sun</text><text class="label" x="24" y="44">Tue</text><text class="label" x="24" y="62">Thu</text><text class="label" x="24" y="80">Sat</text>
  <g aria-label="Contribution cubes">
${cells.map((cell) => cube(cell)).join("\n")}
  </g>
  <g aria-label="Animated contribution snake">
${snakeCells.map((cell, index) => cube({ ...cell, level: Math.max(cell.level, 2), className: "snake", style: `animation-delay: -${(index / snakeCells.length * 20).toFixed(3)}s` })).join("\n")}
  </g>
  <text class="label" x="${viewBoxWidth - 174}" y="${viewBoxHeight - 18}">Less</text>
${[0, 1, 2, 3, 4].map((level, index) => cube({ x: viewBoxWidth - 133 + index * 22, y: viewBoxHeight - 24, level, className: "cell" })).join("\n")}
  <text class="label" x="${viewBoxWidth - 16}" y="${viewBoxHeight - 18}" text-anchor="end">More</text>
</svg>\n`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, svg);
console.log(`Wrote ${outputPath} for ${username} (${activeCells.length} active contribution cells).`);
