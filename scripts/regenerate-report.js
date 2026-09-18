const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const REPORT_ASSETS_DIR = path.join(PUBLIC_DIR, 'report-assets');
const POINTS_FILE = path.join(ROOT, 'data', 'pointDistribution.json');
const SCENARIO_FILE = path.join(ROOT, 'data', 'reportScenario.json');
const LIVE_POINTS_FILE = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Roaming'),
  "Rudy's Cutter Challenge",
  'pointDistribution.json'
);
const BASE_URL = 'http://localhost:3000';
const TODAY = new Date().toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const ROUND_DEFS = [
  {
    key: 'g1r1',
    label: 'Game 1 · Round 1',
    game: 'game1',
    round: 'round1',
    metrics: ['speed', 'variance', 'presentation'],
    screenshotFiles: [
      'g1r1-heat1-admin.png',
      'g1r1-heat2-admin.png',
      'g1r1-heat3-admin.png',
      'g1r1-heat4-admin.png',
    ],
    groups: [
      ["Rudy's 1", "Rudy's 2", "Rudy's 3"],
      ["Rudy's 4", "Rudy's 5", "Rudy's 6"],
      ["Rudy's 7", "Rudy's 8", "Rudy's 9"],
      ["Rudy's 10", "Rudy's 11", "Rudy's 12"],
    ],
    leaderboardFile: 'g1r1-leaderboard.png',
  },
  {
    key: 'g1r2',
    label: 'Game 1 · Round 2',
    game: 'game1',
    round: 'round2',
    metrics: ['speed', 'variance'],
    screenshotFiles: [
      'g1r2-heat1-admin.png',
      'g1r2-heat2-admin.png',
      'g1r2-heat3-admin.png',
      'g1r2-heat4-admin.png',
    ],
    groups: [
      ["Rudy's 1", "Rudy's 2", "Rudy's 3"],
      ["Rudy's 4", "Rudy's 5", "Rudy's 6"],
      ["Rudy's 7", "Rudy's 8", "Rudy's 9"],
      ["Rudy's 10", "Rudy's 11", "Rudy's 12"],
    ],
  },
  {
    key: 'g1r3',
    label: 'Game 1 · Round 3',
    game: 'game1',
    round: 'round3',
    metrics: ['speed', 'variance'],
    screenshotFiles: [
      'g1r3-heat1-admin.png',
      'g1r3-heat2-admin.png',
      'g1r3-heat3-admin.png',
      'g1r3-heat4-admin.png',
    ],
    groups: [
      ["Rudy's 1", "Rudy's 2", "Rudy's 3"],
      ["Rudy's 4", "Rudy's 5", "Rudy's 6"],
      ["Rudy's 7", "Rudy's 8", "Rudy's 9"],
      ["Rudy's 10", "Rudy's 11", "Rudy's 12"],
    ],
  },
  {
    key: 'g2r1',
    label: 'Game 2 · Round 1',
    game: 'game2',
    round: 'round1',
    metrics: ['speed', 'presentation'],
    screenshotFiles: ['g2r1-heata-admin.png', 'g2r1-heatb-admin.png'],
    groups: [
      ["Rudy's 1", "Rudy's 2", "Rudy's 3"],
      ["Rudy's 4", "Rudy's 5", "Rudy's 6"],
    ],
    leaderboardFile: 'g2r1-leaderboard.png',
  },
  {
    key: 'g3r1',
    label: 'Game 3 · Championship',
    game: 'game3',
    round: 'round1',
    metrics: ['speed', 'presentation'],
    screenshotFiles: ['g3r1-final-admin.png'],
    groups: [["Rudy's 1", "Rudy's 2", "Rudy's 3"]],
    leaderboardFile: 'g3r1-final-leaderboard.png',
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timeToSeconds(timeString) {
  const [minutes, seconds, centiseconds] = timeString.split(':').map(Number);
  return minutes * 60 + seconds + centiseconds / 100;
}

function ordinal(index) {
  const value = index + 1;
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return `${value}st`;
  if (mod10 === 2 && mod100 !== 12) return `${value}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${value}rd`;
  return `${value}th`;
}

function normalizeScenario(scenario) {
  const names = Object.keys(scenario.competitors);
  return names.map((name) => ({
    name,
    location: scenario.competitors[name].location,
    stages: scenario.competitors[name],
  }));
}

function buildRawData(entries) {
  const raw = {};
  for (const entry of entries) {
    raw[entry.name] = { location: entry.location, eliminated: false };
    for (const roundDef of ROUND_DEFS) {
      const stage = entry.stages[roundDef.key];
      if (!stage) continue;
      const prefix = `${roundDef.game}-${roundDef.round}`;
      if (stage.speed) {
        const [minutes, seconds, centiseconds] = stage.speed.split(':');
        raw[entry.name][`${prefix}-speed-minutes`] = minutes;
        raw[entry.name][`${prefix}-speed-seconds`] = seconds;
        raw[entry.name][`${prefix}-speed-centiseconds`] = centiseconds;
        raw[entry.name][`${prefix}-speed-total`] = stage.speed;
      }
      if (stage.variance !== undefined) raw[entry.name][`${prefix}-variance`] = stage.variance;
      if (stage.presentation !== undefined) raw[entry.name][`${prefix}-presentation`] = String(stage.presentation);
      if (stage.accuracy !== undefined) raw[entry.name][`${prefix}-accuracy`] = stage.accuracy;
    }
  }
  return raw;
}

function calculatePoints(raw, pointDistribution) {
  const names = Object.keys(raw);
  const stageResults = {};
  const competitorTotals = {};
  const allPoints = JSON.parse(JSON.stringify(raw));

  for (const name of names) {
    competitorTotals[name] = { game1: 0, game2: 0, game3: 0 };
  }

  for (const roundDef of ROUND_DEFS) {
    const prefix = `${roundDef.game}-${roundDef.round}`;
    const stageKey = roundDef.key;
    stageResults[stageKey] = { rows: [], totals: [] };

    for (const metric of roundDef.metrics) {
      const pointsArray = pointDistribution[`${prefix}-${metric}`];
      if (!pointsArray) continue;
      const metricRows = names
        .filter((name) => {
          if (metric === 'speed') return allPoints[name][`${prefix}-speed-total`] !== undefined;
          return allPoints[name][`${prefix}-${metric}`] !== undefined;
        })
        .map((name) => {
          let sortValue;
          if (metric === 'speed') sortValue = timeToSeconds(allPoints[name][`${prefix}-speed-total`]);
          else if (metric === 'variance') sortValue = Math.abs(parseFloat(allPoints[name][`${prefix}-variance`] || 0));
          else sortValue = parseFloat(allPoints[name][`${prefix}-presentation`] || 0);
          return { name, sortValue };
        })
        .sort((a, b) => (metric === 'presentation' ? b.sortValue - a.sortValue : a.sortValue - b.sortValue));

      let rank = 0;
      while (rank < metricRows.length) {
        const tieGroup = [metricRows[rank]];
        while (
          rank + tieGroup.length < metricRows.length &&
          metricRows[rank + tieGroup.length].sortValue === metricRows[rank].sortValue
        ) {
          tieGroup.push(metricRows[rank + tieGroup.length]);
        }
        const averagePoints =
          tieGroup.reduce((sum, _, idx) => sum + Number(pointsArray[rank + idx] || 0), 0) /
          tieGroup.length;
        for (const competitor of tieGroup) {
          let awarded = averagePoints;
          if (
            metric === 'variance' &&
            Math.abs(parseFloat(allPoints[competitor.name][`${prefix}-variance`] || 0)) === 0
          ) {
            awarded += Number(pointDistribution['perfect-cut-bonus'] || 0);
          }
          allPoints[competitor.name][`${prefix}-${metric}-points`] = awarded;
        }
        rank += tieGroup.length;
      }
    }

    for (const name of names) {
      const row = {
        name,
        stage: raw[name],
      };
      let total = 0;
      for (const metric of roundDef.metrics) {
        row[metric] = Number(allPoints[name][`${prefix}-${metric}-points`] || 0);
        total += row[metric];
      }
      row.total = total;
      stageResults[stageKey].rows.push(row);
      competitorTotals[name][roundDef.game] += total;
    }

    stageResults[stageKey].rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }

  const cumulative = names
    .map((name) => ({
      name,
      round1:
        Number(stageResults.g1r1.rows.find((row) => row.name === name)?.total || 0) +
        Number(stageResults.g1r2.rows.find((row) => row.name === name)?.total || 0) +
        Number(stageResults.g1r3.rows.find((row) => row.name === name)?.total || 0),
      game2Raw: Number(stageResults.g2r1.rows.find((row) => row.name === name)?.total || 0),
      game3Raw: Number(stageResults.g3r1.rows.find((row) => row.name === name)?.total || 0),
    }))
    .map((entry) => ({
      ...entry,
      afterRound2: entry.round1 + entry.game2Raw,
      final: entry.round1 + entry.game2Raw + entry.game3Raw,
    }))
    .sort((a, b) => b.final - a.final || b.afterRound2 - a.afterRound2 || b.round1 - a.round1);

  return { allPoints, stageResults, cumulative };
}

function renderChips(values) {
  return values
    .map((value, index) => `<span class="chip${index === 0 ? ' best' : ''}">${escapeHtml(value)}</span>`)
    .join('');
}

function buildStyle() {
  return `
    :root {
      --red:#c0392b; --dark:#161616; --mid:#262626; --card:#1f1f1f; --border:#383838;
      --text:#ececec; --muted:#9a9a9a; --gold:#f0c040; --blue:#3498db; --green:#2ecc71;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--dark); color:var(--text); font-family:Segoe UI,system-ui,sans-serif; line-height:1.5; }
    header { background:var(--red); padding:2rem; text-align:center; border-bottom:4px solid #8b1a10; }
    h1 { margin:0; font-size:2rem; text-transform:uppercase; letter-spacing:1px; }
    header p { margin:.5rem 0 0; opacity:.9; }
    .container { max-width:1150px; margin:0 auto; padding:1.5rem; }
    h2 { color:var(--gold); font-size:1.25rem; text-transform:uppercase; letter-spacing:1px; margin:2rem 0 1rem; border-bottom:1px solid var(--border); padding-bottom:.45rem; }
    h3 { color:var(--blue); font-size:1rem; margin:1.25rem 0 .6rem; text-transform:uppercase; letter-spacing:.5px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:1rem 1.25rem; margin-bottom:1rem; }
    .grid { display:grid; gap:1rem; }
    .grid.two { grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); }
    .grid.three { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
    table { width:100%; border-collapse:collapse; font-size:.9rem; }
    th { background:var(--mid); color:var(--gold); text-align:left; padding:.55rem .7rem; font-size:.75rem; text-transform:uppercase; letter-spacing:.4px; }
    td { padding:.5rem .7rem; border-bottom:1px solid var(--border); }
    tr:last-child td { border-bottom:none; }
    .num { text-align:right; font-variant-numeric:tabular-nums; }
    .callout { border-left:4px solid var(--gold); background:rgba(240,192,64,.08); border-radius:0 8px 8px 0; padding:.8rem 1rem; margin:1rem 0; }
    .callout.good { border-color:var(--green); background:rgba(46,204,113,.08); }
    .callout.info { border-color:var(--blue); background:rgba(52,152,219,.08); }
    .chips { display:flex; flex-wrap:wrap; gap:.35rem; }
    .chip { background:var(--border); border-radius:999px; padding:.15rem .55rem; font-size:.85rem; }
    .chip.best { background:var(--red); color:white; }
    .muted { color:var(--muted); }
    .rank1 { color:var(--gold); font-weight:700; }
    .rank2 { color:#d0d0d0; font-weight:700; }
    .rank3 { color:#cd7f32; font-weight:700; }
    .details { margin-top:.75rem; }
    details { background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-bottom:.75rem; }
    summary { cursor:pointer; padding:.85rem 1rem; font-weight:600; }
    .details-body { padding:1rem; border-top:1px solid var(--border); }
    .screenshot img { width:100%; display:block; background:#111; border-radius:8px; }
    a { color:var(--gold); }
    footer { text-align:center; color:var(--muted); padding:2rem; border-top:1px solid var(--border); margin-top:2rem; }
  `;
}

function renderMainReport(pointDistribution, scenarioEntries, calculated) {
  const topThree = calculated.cumulative.slice(0, 3);
  const round1Breakdown = topThree.map((entry) => {
    const r1 = calculated.stageResults.g1r1.rows.find((row) => row.name === entry.name).total;
    const r2 = calculated.stageResults.g1r2.rows.find((row) => row.name === entry.name).total;
    const r3 = calculated.stageResults.g1r3.rows.find((row) => row.name === entry.name).total;
    return `<tr><td>${escapeHtml(entry.name)}</td><td class="num">${r1}</td><td class="num">${r2}</td><td class="num">${r3}</td><td class="num">${entry.round1}</td></tr>`;
  }).join('');

  const stageCards = [
    ['Game 1 R1 Speed', pointDistribution['game1-round1-speed']],
    ['Game 1 R1 Variance', pointDistribution['game1-round1-variance']],
    ['Game 1 R1 Presentation', pointDistribution['game1-round1-presentation']],
    ['Game 1 R2 Speed', pointDistribution['game1-round2-speed']],
    ['Game 1 R2 Variance', pointDistribution['game1-round2-variance']],
    ['Game 1 R3 Speed', pointDistribution['game1-round3-speed']],
    ['Game 1 R3 Variance', pointDistribution['game1-round3-variance']],
    ['Game 2 Speed', pointDistribution['game2-round1-speed']],
    ['Game 2 Presentation', pointDistribution['game2-round1-presentation']],
    ['Game 3 Speed', pointDistribution['game3-round1-speed']],
    ['Game 3 Presentation', pointDistribution['game3-round1-presentation']],
  ].map(([label, values]) => `
    <div class="card">
      <div class="muted" style="text-transform:uppercase;font-size:.75rem;font-weight:700;">${escapeHtml(label)}</div>
      <div class="chips" style="margin-top:.5rem;">${renderChips(values)}</div>
    </div>
  `).join('');

  const cumulativeRows = calculated.cumulative.slice(0, 6).map((entry, index) => `
    <tr>
      <td class="${index === 0 ? 'rank1' : index === 1 ? 'rank2' : index === 2 ? 'rank3' : ''}">${ordinal(index)}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td class="num">${entry.round1}</td>
      <td class="num">${entry.game2Raw}</td>
      <td class="num">${entry.afterRound2}</td>
      <td class="num">${entry.game3Raw || '—'}</td>
      <td class="num">${entry.final}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Scoring Simulation Report — Rudy's BBQ Cutter Challenge</title>
  <style>${buildStyle()}</style>
</head>
<body>
  <header>
    <h1>Scoring Simulation Report</h1>
    <p>Rudy's BBQ Cutter Challenge · regenerated ${escapeHtml(TODAY)} · live matrix + real app screenshots</p>
  </header>
  <div class="container">
    <h2>Scenario</h2>
    <div class="callout info">This report is generated from <code>data/reportScenario.json</code> and the current <code>data/pointDistribution.json</code>. Screenshots are captured from the live app pages, not the simulator.</div>
    <div class="card">
      <table>
        <thead><tr><th>Competitor</th><th>Profile</th><th class="num">Round 1</th><th class="num">After Game 2</th><th class="num">Final</th></tr></thead>
        <tbody>
          ${topThree.map((entry, index) => `<tr><td class="${index === 0 ? 'rank1' : index === 1 ? 'rank2' : 'rank3'}">${escapeHtml(entry.name)}</td><td>${index === 0 ? 'Fastest / perfect-cut baseline' : index === 1 ? 'Middle benchmark' : 'Slow benchmark'}</td><td class="num">${entry.round1}</td><td class="num">${entry.afterRound2}</td><td class="num">${entry.final}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <h2>Point Distribution</h2>
    <div class="grid three">${stageCards}</div>

    <h2>Round 1 Breakdown</h2>
    <div class="card">
      <table>
        <thead><tr><th>Competitor</th><th class="num">Cut 1</th><th class="num">Cut 2</th><th class="num">Cut 3</th><th class="num">Round 1 Total</th></tr></thead>
        <tbody>${round1Breakdown}</tbody>
      </table>
    </div>

    <h2>Cumulative Standings</h2>
    <div class="card">
      <table>
        <thead><tr><th>Place</th><th>Competitor</th><th class="num">Round 1</th><th class="num">Game 2 Raw</th><th class="num">After Game 2</th><th class="num">Game 3 Raw</th><th class="num">Final</th></tr></thead>
        <tbody>${cumulativeRows}</tbody>
      </table>
    </div>

    <div class="callout good"><strong>Verification:</strong> This report was rebuilt from the current matrix and the screenshot assets in <code>public/report-assets</code> were regenerated from the real app workflow.</div>

    <p><a href="scoring-report-addendum.html">Open the full screenshot addendum →</a></p>
  </div>
  <footer>Generated ${escapeHtml(TODAY)} · Rudy's BBQ Cutter Challenge</footer>
</body>
</html>`;
}

function renderInputTable(def, scenarioEntries) {
  const rows = [];
  def.groups.forEach((group, heatIndex) => {
    group.forEach((name) => {
      const entry = scenarioEntries.find((item) => item.name === name);
      const stage = entry.stages[def.key];
      if (!stage) return;
      rows.push(`
        <tr>
          <td>${escapeHtml(`${def.label.replace('Game ', 'G').replace(' · ', ' H').replace('Round ', 'R')} H${heatIndex + 1}`)}</td>
          <td>${escapeHtml(name)}</td>
          <td class="num">${escapeHtml(stage.speed || '—')}</td>
          ${stage.accuracy !== undefined ? `<td class="num">${escapeHtml(stage.accuracy)}</td><td class="num">${escapeHtml(stage.variance)}</td>` : ''}
          ${stage.presentation !== undefined ? `<td class="num">${escapeHtml(stage.presentation)}</td>` : ''}
        </tr>
      `);
    });
  });
  return rows.join('');
}

function renderStageResultsTable(def, calculated) {
  const prefix = `${def.game}-${def.round}`;
  const rows = calculated.stageResults[def.key].rows
    .filter((row) => row.total > 0 || def.key.startsWith('g1'))
    .map((row, index) => {
      const rankClass = index === 0 ? 'rank1' : index === 1 ? 'rank2' : index === 2 ? 'rank3' : '';
      const metricCells = def.metrics
        .map((metric) => `<td class="num">${row[metric] || 0}</td>`)
        .join('');
      return `<tr><td class="${rankClass}">${ordinal(index)}</td><td>${escapeHtml(row.name)}</td>${metricCells}<td class="num">${row.total}</td></tr>`;
    })
    .join('');
  const headers = def.metrics.map((metric) => `<th class="num">${escapeHtml(metric)} pts</th>`).join('');
  return `<table><thead><tr><th>Place</th><th>Competitor</th>${headers}<th class="num">Stage Total</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderScreenshotDetails(def) {
  const screenshots = def.screenshotFiles
    .map((file, index) => `
      <details>
        <summary>${escapeHtml(file)}</summary>
        <div class="details-body screenshot"><img src="report-assets/${escapeHtml(file)}" alt="${escapeHtml(file)}" /></div>
      </details>
    `)
    .join('');
  const leaderboard = def.leaderboardFile
    ? `<details><summary>${escapeHtml(def.leaderboardFile)}</summary><div class="details-body screenshot"><img src="report-assets/${escapeHtml(def.leaderboardFile)}" alt="${escapeHtml(def.leaderboardFile)}" /></div></details>`
    : '';
  return screenshots + leaderboard;
}

function renderAddendum(pointDistribution, scenarioEntries, calculated) {
  const sections = ROUND_DEFS.map((def) => {
    const includeAccuracy = def.metrics.includes('variance');
    const includePresentation = def.metrics.includes('presentation');
    return `
      <h2>${escapeHtml(def.label)}</h2>
      <div class="grid two">
        <div class="card">
          <h3>Input Data</h3>
          <table>
            <thead>
              <tr>
                <th>Heat</th><th>Competitor</th><th class="num">Speed</th>
                ${includeAccuracy ? '<th class="num">Accuracy</th><th class="num">Variance</th>' : ''}
                ${includePresentation ? '<th class="num">Presentation</th>' : ''}
              </tr>
            </thead>
            <tbody>${renderInputTable(def, scenarioEntries)}</tbody>
          </table>
        </div>
        <div class="card">
          <h3>Scoring</h3>
          ${renderStageResultsTable(def, calculated)}
        </div>
      </div>
      <div class="details">${renderScreenshotDetails(def)}</div>
    `;
  }).join('');

  const finalRows = calculated.cumulative.map((entry, index) => `
    <tr>
      <td class="${index === 0 ? 'rank1' : index === 1 ? 'rank2' : index === 2 ? 'rank3' : ''}">${ordinal(index)}</td>
      <td>${escapeHtml(entry.name)}</td>
      <td class="num">${entry.round1}</td>
      <td class="num">${entry.game2Raw || '—'}</td>
      <td class="num">${entry.afterRound2}</td>
      <td class="num">${entry.game3Raw || '—'}</td>
      <td class="num">${entry.final}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Full Simulation Addendum — Rudy's BBQ Cutter Challenge</title>
  <style>${buildStyle()}</style>
</head>
<body>
  <header>
    <h1>Full Simulation Addendum</h1>
    <p>Regenerated ${escapeHtml(TODAY)} · actual app screenshots from Admin + Leaderboards</p>
  </header>
  <div class="container">
    <p><a href="scoring-report.html">← Back to main report</a></p>
    <div class="callout info">If you update <code>data/pointDistribution.json</code>, run this script again to sync the live app matrix, recapture screenshot assets, and rebuild both report HTML files.</div>
    ${sections}
    <h2>Final Standings</h2>
    <div class="card">
      <table>
        <thead><tr><th>Place</th><th>Competitor</th><th class="num">Round 1</th><th class="num">Game 2 Raw</th><th class="num">After Game 2</th><th class="num">Game 3 Raw</th><th class="num">Final</th></tr></thead>
        <tbody>${finalRows}</tbody>
      </table>
    </div>
  </div>
  <footer>Generated ${escapeHtml(TODAY)} · Rudy's BBQ Cutter Challenge</footer>
</body>
</html>`;
}

function writeReports(pointDistribution, scenarioEntries, calculated) {
  fs.writeFileSync(path.join(PUBLIC_DIR, 'scoring-report.html'), renderMainReport(pointDistribution, scenarioEntries, calculated));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'scoring-report-addendum.html'), renderAddendum(pointDistribution, scenarioEntries, calculated));
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/admin`);
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Timed out waiting for app server on http://localhost:3000');
}

async function isServerUp() {
  try {
    const response = await fetch(`${BASE_URL}/admin`);
    return response.ok;
  } catch {
    return false;
  }
}

function syncLivePointDistribution() {
  ensureDir(path.dirname(LIVE_POINTS_FILE));
  fs.copyFileSync(POINTS_FILE, LIVE_POINTS_FILE);
}

async function seedAdminAndCapture(page, scenarioEntries, targetWeights) {
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#competitorsList li');

  const scenario = Object.fromEntries(scenarioEntries.map((entry) => [entry.name, entry.stages]));
  const captures = ROUND_DEFS.flatMap((def) =>
    def.screenshotFiles.map((file, index) => ({
      stage: def.key,
      file: path.join(REPORT_ASSETS_DIR, file),
      names: def.groups[index],
    }))
  );

  await page.evaluate(({ targetWeights }) => {
    document.getElementById('targetWeightRound1').value = targetWeights.round1;
    document.getElementById('targetWeightRound2').value = targetWeights.round2;
    document.getElementById('targetWeightRound3').value = targetWeights.round3;
    localStorage.setItem('targetWeightRound1', targetWeights.round1);
    localStorage.setItem('targetWeightRound2', targetWeights.round2);
    localStorage.setItem('targetWeightRound3', targetWeights.round3);
  }, { targetWeights });

  for (const capture of captures) {
    await page.evaluate(({ capture, scenario, roundDefs }) => {
      const stageOrder = roundDefs.map((item) => item.key);
      const names = Object.keys(scenario);
      const activeStages = stageOrder.slice(0, stageOrder.indexOf(capture.stage) + 1);
      const clear = () => {
        document.querySelectorAll('#competitorsList .competitor-item').forEach((li, idx) => {
          li.style.display = '';
          const checkbox = document.getElementById(`competitor${idx}`);
          if (checkbox) checkbox.checked = false;
          const scoring = document.getElementById(`scoring-${idx}`);
          if (scoring) scoring.classList.add('hidden');
          li.querySelectorAll('input[type="number"], input[type="text"]').forEach((input) => {
            if (input.classList.contains('targetInputs') || input.classList.contains('perfectCutBonusInput') || input.classList.contains('scoreTableInputs')) return;
            input.value = '';
          });
          [1,2,3].forEach((round) => {
            const variance = document.getElementById(`game1-round${round}-variance-${idx}`);
            if (variance) variance.textContent = '';
          });
        });
      };
      const fillSpeed = (prefix, idx, time) => {
        const [m, s, cs] = time.split(':');
        document.getElementById(`${prefix}-minutes-${idx}`).value = m;
        document.getElementById(`${prefix}-seconds-${idx}`).value = s;
        document.getElementById(`${prefix}-centiseconds-${idx}`).value = cs;
      };
      clear();
      const currentCompetitors = [];
      names.forEach((name, idx) => {
        const li = document.querySelectorAll('#competitorsList .competitor-item')[idx];
        const visible = capture.names.includes(name);
        li.style.display = visible ? '' : 'none';
        const checkbox = document.getElementById(`competitor${idx}`);
        const scoring = document.getElementById(`scoring-${idx}`);
        if (!visible) return;
        checkbox.checked = true;
        scoring.classList.remove('hidden');
        currentCompetitors.push({ name, location: name });
        activeStages.forEach((stageKey) => {
          const stage = scenario[name][stageKey];
          if (!stage) return;
          if (stageKey.startsWith('g1')) {
            const roundNumber = stageKey === 'g1r1' ? '1' : stageKey === 'g1r2' ? '2' : '3';
            fillSpeed(`game1-round${roundNumber}-speed`, idx, stage.speed);
            if (stage.accuracy !== undefined) document.getElementById(`game1-round${roundNumber}-accuracy-${idx}`).value = stage.accuracy;
            if (stage.variance !== undefined) document.getElementById(`game1-round${roundNumber}-variance-${idx}`).textContent = `Variance: ${stage.variance}`;
            if (stage.presentation !== undefined) document.getElementById(`game1-round1-presentation-${idx}`).value = stage.presentation;
          }
          if (stageKey === 'g2r1') {
            fillSpeed('game2-round1-speed', idx, stage.speed);
            document.getElementById(`game2-round1-presentation-${idx}`).value = stage.presentation;
          }
          if (stageKey === 'g3r1') {
            fillSpeed('game3-round1-speed', idx, stage.speed);
            document.getElementById(`game3-round1-presentation-${idx}`).value = stage.presentation;
          }
        });
      });
      while (currentCompetitors.length < 3) currentCompetitors.push({ name: 'Select Cutter', location: "Rudy's Cutter Challenge" });
      localStorage.setItem('currentCompetitors', JSON.stringify(currentCompetitors));
      document.getElementById('currentCompetitorsList').innerHTML = currentCompetitors.map((c) => `<li>${c.name} - ${c.location}</li>`).join('');
      window.scrollTo(0, document.getElementById('competitorsList').offsetTop);
    }, { capture, scenario, roundDefs: ROUND_DEFS });
    await page.waitForTimeout(200);
    await page.locator('#competitorsList').screenshot({ path: capture.file });
  }
}

async function captureLeaderboards(browser, rawData) {
  const page = await browser.newPage();
  const captures = [
    { hash: 'all', file: path.join(REPORT_ASSETS_DIR, 'g1r1-leaderboard.png') },
    { hash: 'all', file: path.join(REPORT_ASSETS_DIR, 'g2r1-leaderboard.png') },
    { hash: 'final', file: path.join(REPORT_ASSETS_DIR, 'g3r1-final-leaderboard.png') },
  ];
  for (const capture of captures) {
    await page.goto(`${BASE_URL}/leaderboards#${capture.hash}`, { waitUntil: 'networkidle' });
    await page.evaluate((payload) => {
      localStorage.setItem('inputValuesChanged', JSON.stringify(payload));
      localStorage.setItem('currentCompetitors', JSON.stringify([
        { name: "Rudy's 1", location: "Rudy's 1" },
        { name: "Rudy's 2", location: "Rudy's 2" },
        { name: "Rudy's 3", location: "Rudy's 3" },
      ]));
    }, rawData);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('body').screenshot({ path: capture.file, fullPage: true });
  }
  await page.close();
}

async function main() {
  ensureDir(REPORT_ASSETS_DIR);
  const pointDistribution = readJson(POINTS_FILE);
  const scenario = readJson(SCENARIO_FILE);
  const scenarioEntries = normalizeScenario(scenario);
  const rawData = buildRawData(scenarioEntries);
  const calculated = calculatePoints(rawData, pointDistribution);

  syncLivePointDistribution();

  let child = null;
  if (!(await isServerUp())) {
    child = spawn('npm', ['start'], {
      cwd: ROOT,
      shell: true,
      stdio: 'inherit',
    });
    await waitForServer(60000);
  }

  const browserExecutable = chromium.executablePath();
  if (!fs.existsSync(browserExecutable)) {
    const installResult = spawnSync('npx', ['playwright', 'install', 'chromium'], {
      cwd: ROOT,
      shell: true,
      stdio: 'inherit',
    });
    if (installResult.status !== 0) {
      throw new Error('Failed to install Playwright Chromium browser.');
    }
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const adminPage = await browser.newPage();
    await seedAdminAndCapture(adminPage, scenarioEntries, scenario.targetWeights);
    await adminPage.close();
    await captureLeaderboards(browser, rawData);
    writeReports(pointDistribution, scenarioEntries, calculated);
    console.log('Report regenerated successfully.');
    console.log(`- Live matrix synced: ${LIVE_POINTS_FILE}`);
    console.log(`- Screenshots updated: ${REPORT_ASSETS_DIR}`);
    console.log('- Report files updated: public/scoring-report.html, public/scoring-report-addendum.html');
  } finally {
    await browser.close();
    if (child) {
      child.kill();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
