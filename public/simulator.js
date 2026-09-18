const FALLBACK_POINT_DISTRIBUTION = {
  'perfect-cut-bonus': 2,
  'game1-round1-speed': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game1-round1-variance': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game1-round1-presentation': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game1-round2-speed': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game1-round2-variance': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game1-round3-speed': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game1-round3-variance': [8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0, 0],
  'game2-round1-speed': [56, 46, 37, 38, 14, 5],
  'game2-round1-presentation': [56, 46, 37, 38, 14, 5],
  'game3-round1-speed': [93.5, 56, 37.5],
  'game3-round1-presentation': [93.5, 56, 37.5],
};

let pointDistribution = FALLBACK_POINT_DISTRIBUTION;
let competitors = [];
let metricKeys = [];

const competitorNamesInput = document.getElementById('competitorNames');
const buildInputsBtn = document.getElementById('buildInputsBtn');
const loadDemoBtn = document.getElementById('loadDemoBtn');
const calculateBtn = document.getElementById('calculateBtn');
const autoFillExpectedBtn = document.getElementById('autoFillExpectedBtn');
const statusText = document.getElementById('statusText');
const round1ActiveInput = document.getElementById('round1Active');
const round2ActiveInput = document.getElementById('round2Active');
const round3ActiveInput = document.getElementById('round3Active');

const inputsTable = document.getElementById('inputsTable');
const metricPointsTable = document.getElementById('metricPointsTable');
const totalsTable = document.getElementById('totalsTable');
const validationTable = document.getElementById('validationTable');

let latestTotals = {};
const expectedTotalsByCompetitor = {};

function setStatus(message) {
  statusText.textContent = message;
}

function parseCompetitors() {
  competitors = competitorNamesInput.value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function getMetricType(metricKey) {
  return metricKey.split('-').pop();
}

function parseMetricParts(metricKey) {
  const [game, round, metric] = metricKey.split('-');
  return { game, round, metric };
}

function sortedMetricKeys(keys) {
  const gameOrder = { game1: 1, game2: 2, game3: 3 };
  const roundOrder = { round1: 1, round2: 2, round3: 3 };
  const metricOrder = { speed: 1, variance: 2, presentation: 3 };

  return [...keys].sort((a, b) => {
    const pa = parseMetricParts(a);
    const pb = parseMetricParts(b);

    if (gameOrder[pa.game] !== gameOrder[pb.game]) {
      return (gameOrder[pa.game] || 99) - (gameOrder[pb.game] || 99);
    }
    if (roundOrder[pa.round] !== roundOrder[pb.round]) {
      return (roundOrder[pa.round] || 99) - (roundOrder[pb.round] || 99);
    }
    return (metricOrder[pa.metric] || 99) - (metricOrder[pb.metric] || 99);
  });
}

function getGame1RoundActiveConfig() {
  const total = competitors.length || 1;
  const round1 = Math.max(1, Math.min(total, Number(round1ActiveInput.value) || total));
  const round2 = Math.max(1, Math.min(round1, Number(round2ActiveInput.value) || Math.max(1, round1 - 1)));
  const round3 = Math.max(1, Math.min(round2, Number(round3ActiveInput.value) || Math.max(1, round2 - 1)));

  round1ActiveInput.value = String(round1);
  round2ActiveInput.value = String(round2);
  round3ActiveInput.value = String(round3);

  return { round1, round2, round3 };
}

function buildInputGrid() {
  parseCompetitors();
  metricKeys = Object.keys(pointDistribution).filter(
    (key) => key !== 'perfect-cut-bonus'
  );

  if (!competitors.length) {
    setStatus('Add at least one competitor name.');
    return;
  }

  const header = `
    <tr>
      <th>Metric</th>
      ${competitors.map((name) => `<th>${name}</th>`).join('')}
    </tr>
  `;

  const rows = metricKeys
    .map((metricKey) => {
      const metricType = getMetricType(metricKey);
      const hint =
        metricType === 'speed'
          ? 'lower is better'
          : metricType === 'presentation'
          ? 'higher is better'
          : 'closer to 0 is better';

      return `
      <tr>
        <td class="metric-cell">${metricKey}<br/><small>${hint}</small></td>
        ${competitors
          .map(
            (name, index) => `
          <td>
            <input
              class="metric-input"
              type="number"
              step="0.01"
              data-metric="${metricKey}"
              data-competitor-index="${index}"
              data-competitor-name="${name}"
              value="0"
            />
          </td>
        `
          )
          .join('')}
      </tr>
    `;
    })
    .join('');

  inputsTable.innerHTML = header + rows;
  metricPointsTable.innerHTML = '';
  totalsTable.innerHTML = '';
  validationTable.innerHTML = '';
  setStatus('Input grid ready.');
}

function readRawValues() {
  const data = {};
  competitors.forEach((name) => {
    data[name] = {};
  });

  const inputs = document.querySelectorAll('input.metric-input');
  inputs.forEach((input) => {
    const metricKey = input.dataset.metric;
    const competitorName = input.dataset.competitorName;
    const value = parseFloat(input.value);
    data[competitorName][metricKey] = Number.isNaN(value) ? 0 : value;
  });

  return data;
}

function buildSortedCompetitors(rawValues, metricKey, metricType) {
  return [...competitors].sort((a, b) => {
    const aValue = Number(rawValues[a][metricKey] || 0);
    const bValue = Number(rawValues[b][metricKey] || 0);

    if (metricType === 'speed') {
      return aValue - bValue;
    }

    if (metricType === 'presentation') {
      return bValue - aValue;
    }

    return Math.abs(aValue) - Math.abs(bValue);
  });
}

function areTied(rawValues, metricKey, metricType, nameA, nameB) {
  const aValue = Number(rawValues[nameA][metricKey] || 0);
  const bValue = Number(rawValues[nameB][metricKey] || 0);

  if (metricType === 'variance') {
    return Math.abs(aValue) === Math.abs(bValue);
  }

  return aValue === bValue;
}

function calculateMetricPoints(rawValues) {
  const pointsByCompetitor = {};
  competitors.forEach((name) => {
    pointsByCompetitor[name] = {};
  });

  const game1RoundActive = getGame1RoundActiveConfig();
  const game1Cumulative = Object.fromEntries(competitors.map((name) => [name, 0]));
  const competitorsBySeedOrder = [...competitors];

  let game1Round2ActiveSet = new Set(competitorsBySeedOrder);
  let game1Round3ActiveSet = new Set(competitorsBySeedOrder);

  sortedMetricKeys(metricKeys).forEach((metricKey) => {
    const { game, round } = parseMetricParts(metricKey);
    const metricType = getMetricType(metricKey);
    const pointsArray = pointDistribution[metricKey] || [];

    let eligibleCompetitors = [...competitors];

    if (game === 'game1' && round === 'round1') {
      eligibleCompetitors = competitorsBySeedOrder.slice(0, game1RoundActive.round1);
    }

    if (game === 'game1' && round === 'round2') {
      if (game1Round2ActiveSet.size === competitors.length) {
        const rankByRound1 = [...competitors].sort((a, b) => game1Cumulative[b] - game1Cumulative[a]);
        game1Round2ActiveSet = new Set(rankByRound1.slice(0, game1RoundActive.round2));
      }
      eligibleCompetitors = [...game1Round2ActiveSet];
    }

    if (game === 'game1' && round === 'round3') {
      if (game1Round3ActiveSet.size === competitors.length) {
        const rankByRound2 = [...competitors].sort((a, b) => game1Cumulative[b] - game1Cumulative[a]);
        game1Round3ActiveSet = new Set(rankByRound2.slice(0, game1RoundActive.round3));
      }
      eligibleCompetitors = [...game1Round3ActiveSet];
    }

    const sorted = [...eligibleCompetitors].sort((a, b) => {
      const aValue = Number(rawValues[a][metricKey] || 0);
      const bValue = Number(rawValues[b][metricKey] || 0);

      if (metricType === 'speed') {
        return aValue - bValue;
      }

      if (metricType === 'presentation') {
        return bValue - aValue;
      }

      return Math.abs(aValue) - Math.abs(bValue);
    });

    let rank = 0;
    while (rank < sorted.length) {
      const tied = [sorted[rank]];

      while (
        rank + tied.length < sorted.length &&
        areTied(
          rawValues,
          metricKey,
          metricType,
          sorted[rank],
          sorted[rank + tied.length]
        )
      ) {
        tied.push(sorted[rank + tied.length]);
      }

      const totalPoints = tied.reduce((sum, _, i) => {
        const points = Number(pointsArray[rank + i]);
        return sum + (Number.isFinite(points) ? points : 0);
      }, 0);
      const averagePoints = totalPoints / tied.length;

      tied.forEach((name) => {
        let awardedPoints = averagePoints;

        if (metricType === 'variance') {
          const varianceValue = Number(rawValues[name][metricKey] || 0);
          if (Math.abs(varianceValue) === 0) {
            awardedPoints += Number(pointDistribution['perfect-cut-bonus'] || 0);
          }
        }

        pointsByCompetitor[name][`${metricKey}-points`] = awardedPoints;
      });

      rank += tied.length;
    }

    competitors.forEach((name) => {
      const key = `${metricKey}-points`;
      if (pointsByCompetitor[name][key] === undefined) {
        pointsByCompetitor[name][key] = 0;
      }
      if (game === 'game1') {
        game1Cumulative[name] += Number(pointsByCompetitor[name][key] || 0);
      }
    });

    if (game === 'game1' && round === 'round1') {
      const rankByRound1 = [...competitors].sort((a, b) => game1Cumulative[b] - game1Cumulative[a]);
      game1Round2ActiveSet = new Set(rankByRound1.slice(0, game1RoundActive.round2));
    }

    if (game === 'game1' && round === 'round2') {
      const rankByRound2 = [...competitors].sort((a, b) => game1Cumulative[b] - game1Cumulative[a]);
      game1Round3ActiveSet = new Set(rankByRound2.slice(0, game1RoundActive.round3));
    }
  });

  return pointsByCompetitor;
}

function calculateTotals(pointsByCompetitor) {
  const totals = {};

  competitors.forEach((name) => {
    const rawGameTotals = { game1: 0, game2: 0, game3: 0 };
    Object.entries(pointsByCompetitor[name]).forEach(([metricKey, points]) => {
      const game = metricKey.split('-')[0];
      if (rawGameTotals[game] !== undefined) {
        rawGameTotals[game] += Number(points || 0);
      }
    });

    const game1 = rawGameTotals.game1;
    const game2 = rawGameTotals.game1 + rawGameTotals.game2;
    const game3 = rawGameTotals.game1 + rawGameTotals.game2 + rawGameTotals.game3;

    totals[name] = { game1, game2, game3 };
  });

  return totals;
}

function renderMetricPointsTable(pointsByCompetitor) {
  const header = `
    <tr>
      <th>Metric Points</th>
      ${competitors.map((name) => `<th>${name}</th>`).join('')}
    </tr>
  `;

  const rows = metricKeys
    .map((metricKey) => {
      const pointsKey = `${metricKey}-points`;
      return `
      <tr>
        <td class="metric-cell">${pointsKey}</td>
        ${competitors
          .map((name) => `<td>${Number(pointsByCompetitor[name][pointsKey] || 0).toFixed(2)}</td>`)
          .join('')}
      </tr>
      `;
    })
    .join('');

  metricPointsTable.innerHTML = header + rows;
}

function renderTotalsTable(totals) {
  const header = `
    <tr>
      <th>Competitor</th>
      <th>Game 1 (cumulative)</th>
      <th>Game 2 (cumulative)</th>
      <th>Game 3 (cumulative)</th>
    </tr>
  `;

  const rows = competitors
    .map(
      (name) => `
    <tr>
      <td class="metric-cell">${name}</td>
      <td>${totals[name].game1.toFixed(2)}</td>
      <td>${totals[name].game2.toFixed(2)}</td>
      <td class="pass">${totals[name].game3.toFixed(2)}</td>
    </tr>
  `
    )
    .join('');

  totalsTable.innerHTML = header + rows;
}

function getExpectedValue(name, game) {
  if (!expectedTotalsByCompetitor[name]) {
    expectedTotalsByCompetitor[name] = { game1: '', game2: '', game3: '' };
  }
  return expectedTotalsByCompetitor[name][game];
}

function valuesMatch(expected, actual) {
  if (expected === '' || expected === null || expected === undefined) {
    return null;
  }

  const parsed = Number(expected);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.abs(parsed - actual) < 0.005;
}

function renderCheckCell(matchResult) {
  if (matchResult === null) {
    return '<td class="pending">MISSING</td>';
  }
  return `<td class="${matchResult ? 'pass' : 'fail'}">${
    matchResult ? 'PASS' : 'FAIL'
  }</td>`;
}

function renderValidationTable() {
  if (!competitors.length || !Object.keys(latestTotals).length) {
    validationTable.innerHTML = '';
    return;
  }

  const header = `
    <tr>
      <th>Competitor</th>
      <th>Expected G1</th>
      <th>Actual G1</th>
      <th>Check G1</th>
      <th>Expected G2</th>
      <th>Actual G2</th>
      <th>Check G2</th>
      <th>Expected G3</th>
      <th>Actual G3</th>
      <th>Check G3</th>
    </tr>
  `;

  const rows = competitors
    .map((name) => {
      const g1 = latestTotals[name].game1;
      const g2 = latestTotals[name].game2;
      const g3 = latestTotals[name].game3;

      const expectedG1 = getExpectedValue(name, 'game1');
      const expectedG2 = getExpectedValue(name, 'game2');
      const expectedG3 = getExpectedValue(name, 'game3');

      const passG1 = valuesMatch(expectedG1, g1);
      const passG2 = valuesMatch(expectedG2, g2);
      const passG3 = valuesMatch(expectedG3, g3);

      return `
      <tr>
        <td class="metric-cell">${name}</td>
        <td><input class="expected-input" type="number" step="0.01" data-expected-name="${name}" data-expected-game="game1" value="${expectedG1}" /></td>
        <td>${g1.toFixed(2)}</td>
        ${renderCheckCell(passG1)}
        <td><input class="expected-input" type="number" step="0.01" data-expected-name="${name}" data-expected-game="game2" value="${expectedG2}" /></td>
        <td>${g2.toFixed(2)}</td>
        ${renderCheckCell(passG2)}
        <td><input class="expected-input" type="number" step="0.01" data-expected-name="${name}" data-expected-game="game3" value="${expectedG3}" /></td>
        <td>${g3.toFixed(2)}</td>
        ${renderCheckCell(passG3)}
      </tr>
      `;
    })
    .join('');

  validationTable.innerHTML = header + rows;

  const expectedInputs = document.querySelectorAll('input.expected-input');
  expectedInputs.forEach((input) => {
    input.addEventListener('input', (event) => {
      const name = event.target.dataset.expectedName;
      const game = event.target.dataset.expectedGame;
      if (!expectedTotalsByCompetitor[name]) {
        expectedTotalsByCompetitor[name] = { game1: '', game2: '', game3: '' };
      }
      expectedTotalsByCompetitor[name][game] = event.target.value;
      renderValidationTable();
    });
  });
}

function calculateAll() {
  if (!competitors.length || !metricKeys.length) {
    buildInputGrid();
  }

  const rawValues = readRawValues();
  const pointsByCompetitor = calculateMetricPoints(rawValues);
  const totals = calculateTotals(pointsByCompetitor);
  latestTotals = totals;

  renderMetricPointsTable(pointsByCompetitor);
  renderTotalsTable(totals);
  renderValidationTable();
  setStatus('Scores calculated. Elimination mode applied for Game 1 rounds based on active-team settings.');
}

function autoFillExpectedFromActual() {
  if (!Object.keys(latestTotals).length) {
    setStatus('Calculate scores first, then use Auto-fill Expected from Actual.');
    return;
  }

  competitors.forEach((name) => {
    if (!expectedTotalsByCompetitor[name]) {
      expectedTotalsByCompetitor[name] = { game1: '', game2: '', game3: '' };
    }
    expectedTotalsByCompetitor[name].game1 = latestTotals[name].game1.toFixed(2);
    expectedTotalsByCompetitor[name].game2 = latestTotals[name].game2.toFixed(2);
    expectedTotalsByCompetitor[name].game3 = latestTotals[name].game3.toFixed(2);
  });

  renderValidationTable();
  setStatus('Expected totals auto-filled for all teams (including Teams B and C).');
}

function loadDemoValues() {
  const inputs = document.querySelectorAll('input.metric-input');
  inputs.forEach((input) => {
    const metricType = getMetricType(input.dataset.metric);
    const competitorIndex = Number(input.dataset.competitorIndex);

    let value;
    if (metricType === 'speed') {
      value = 100 + competitorIndex * 5;
    } else if (metricType === 'presentation') {
      value = 30 - competitorIndex * 3;
    } else {
      value = competitorIndex === 0 ? 0 : competitorIndex * 0.25;
    }

    input.value = value;
  });

  setStatus('Demo values loaded. Click Calculate Scores.');
}

async function initializePointDistribution() {
  try {
    const response = await fetch('/pointDistribution');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    pointDistribution = await response.json();
    setStatus('Point distribution loaded from app settings.');
  } catch (error) {
    pointDistribution = FALLBACK_POINT_DISTRIBUTION;
    setStatus('Using fallback point distribution (could not load from server).');
  }

  buildInputGrid();
}

buildInputsBtn.addEventListener('click', buildInputGrid);
calculateBtn.addEventListener('click', calculateAll);
loadDemoBtn.addEventListener('click', loadDemoValues);
autoFillExpectedBtn.addEventListener('click', autoFillExpectedFromActual);

initializePointDistribution();
