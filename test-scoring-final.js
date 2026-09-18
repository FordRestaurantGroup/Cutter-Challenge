// Test script - using RAW SECONDS (like the simulator does)

const fs = require('fs');

const pointDistribution = JSON.parse(
  fs.readFileSync('./data/pointDistribution.json', 'utf-8')
);

// Demo values: SPEED IN RAW SECONDS (not MM:SS:CC)
// This matches what the simulator uses
const inputValues = {
  'team-A': {
    'game1-round1-speed': 100,
    'game1-round1-variance': 0,
    'game1-round1-presentation': 30,
    'game1-round2-speed': 100,
    'game1-round2-variance': 0,
    'game1-round2-presentation': 30,
    'game1-round3-speed': 100,
    'game1-round3-variance': 0,
    'game1-round3-presentation': 30,
    'game2-round1-speed': 100,
    'game2-round1-presentation': 30,
    'game3-round1-speed': 100,
    'game3-round1-presentation': 30
  },
  'team-B': {
    'game1-round1-speed': 105,
    'game1-round1-variance': 0.25,
    'game1-round1-presentation': 27,
    'game1-round2-speed': 105,
    'game1-round2-variance': 0.25,
    'game1-round2-presentation': 27,
    'game1-round3-speed': 105,
    'game1-round3-variance': 0.25,
    'game1-round3-presentation': 27,
    'game2-round1-speed': 105,
    'game2-round1-presentation': 27,
    'game3-round1-speed': 105,
    'game3-round1-presentation': 27
  },
  'team-C': {
    'game1-round1-speed': 110,
    'game1-round1-variance': 0.5,
    'game1-round1-presentation': 24,
    'game1-round2-speed': 110,
    'game1-round2-variance': 0.5,
    'game1-round2-presentation': 24,
    'game1-round3-speed': 110,
    'game1-round3-variance': 0.5,
    'game1-round3-presentation': 24,
    'game2-round1-speed': 110,
    'game2-round1-presentation': 24,
    'game3-round1-speed': 110,
    'game3-round1-presentation': 24
  },
  'team-D': {
    'game1-round1-speed': 115,
    'game1-round1-variance': 0.75,
    'game1-round1-presentation': 21,
    'game1-round2-speed': 115,
    'game1-round2-variance': 0.75,
    'game1-round2-presentation': 21,
    'game1-round3-speed': 115,
    'game1-round3-variance': 0.75,
    'game1-round3-presentation': 21,
    'game2-round1-speed': 115,
    'game2-round1-presentation': 21,
    'game3-round1-speed': 115,
    'game3-round1-presentation': 21
  }
};

// Calculate metric points with tie handling
function calculateMetricPoints(game, round, metric, pointsArray) {
  if (!pointsArray) {
    console.error(`Missing points array for ${game}-${round}-${metric}`);
    return {};
  }

  const competitorData = [];
  for (const [name, data] of Object.entries(inputValues)) {
    let value;

    if (metric === 'speed') {
      value = data[`${game}-${round}-speed`] || 0;
    } else if (metric === 'variance') {
      value = Math.abs(parseFloat(data[`${game}-${round}-variance`] || 0));
    } else {
      value = data[`${game}-${round}-presentation`] || 0;
    }

    competitorData.push({ name, value });
  }

  // Sort
  competitorData.sort((a, b) => {
    if (metric === 'speed') {
      return a.value - b.value;  // Lower is better
    } else if (metric === 'variance') {
      return a.value - b.value;  // Lower is better
    } else if (metric === 'presentation') {
      return b.value - a.value;  // Higher is better
    }
  });

  // Assign points with tie handling
  const results = {};
  let rank = 0;

  while (rank < competitorData.length) {
    const currentValue = competitorData[rank].value;
    const tieGroup = [competitorData[rank]];

    while (
      rank + tieGroup.length < competitorData.length &&
      competitorData[rank + tieGroup.length].value === currentValue
    ) {
      tieGroup.push(competitorData[rank + tieGroup.length]);
    }

    // Calculate average points
    const totalPoints = tieGroup.reduce((sum, _, index) => {
      const points = pointsArray[rank + index];
      return sum + (Number.isFinite(points) ? points : 0);
    }, 0);
    const avgPoints = totalPoints / tieGroup.length;

    // Assign to each competitor in tie
    tieGroup.forEach((competitor) => {
      results[competitor.name] = avgPoints;
    });

    rank += tieGroup.length;
  }

  return results;
}

// Calculate all scores
const games = [
  { name: 'game1', rounds: [1, 2, 3], metrics: ['speed', 'variance', 'presentation'] },
  { name: 'game2', rounds: [1], metrics: ['speed', 'presentation'] },
  { name: 'game3', rounds: [1], metrics: ['speed', 'presentation'] }
];

// Initialize scores per competitor
const gamePointTotals = {};
Object.keys(inputValues).forEach((name) => {
  gamePointTotals[name] = {
    game1: 0,
    game2: 0,
    game3: 0
  };
});

// Calculate points for each game/round/metric
games.forEach(({ name: game, rounds, metrics }) => {
  rounds.forEach((round) => {
    metrics.forEach((metric) => {
      const key = `${game}-round${round}-${metric}`;
      const pointsArray = pointDistribution[key];

      if (!pointsArray) {
        console.warn(`Missing points array for ${key}`);
        return;
      }

      const points = calculateMetricPoints(game, `round${round}`, metric, pointsArray);

      // Handle variance perfect-cut bonus
      if (metric === 'variance') {
        Object.entries(points).forEach(([name, value]) => {
          const variance = inputValues[name][`${game}-round${round}-variance`];
          if (Math.abs(parseFloat(variance)) === 0) {
            points[name] = value + pointDistribution['perfect-cut-bonus'];
          }
        });
      }

      // Add to game totals
      Object.entries(points).forEach(([name, value]) => {
        gamePointTotals[name][game] += value;
      });
    });
  });
});

// Accumulate game totals (Game 2 = G1 + G2, Game 3 = G1 + G2 + G3)
const cumulativeTotals = {};
Object.entries(gamePointTotals).forEach(([name, games]) => {
  cumulativeTotals[name] = {
    game1: games.game1,
    game2: games.game1 + games.game2,
    game3: games.game1 + games.game2 + games.game3
  };
});

// Output results
console.log('\n=== CORRECTED TEST (USING RAW SECONDS) ===\n');
console.log('Game Totals (Cumulative):');
console.log('Competitor\t\tGame 1\t\tGame 2\t\tGame 3');
console.log('---\t\t\t---\t\t---\t\t---');
Object.entries(cumulativeTotals).forEach(([name, totals]) => {
  console.log(`${name}\t\t${totals.game1.toFixed(0)}\t\t${totals.game2.toFixed(0)}\t\t${totals.game3.toFixed(0)}`);
});

console.log('\n=== SIMULATOR OUTPUT (EXPECTED) ===\n');
console.log('Team A:\t\t\tG1=62, G2=174, G3=361');
console.log('Team B:\t\t\tG1=49, G2=141, G3=253');
console.log('Team C:\t\t\tG1=30, G2=104, G3=179');
console.log('Team D:\t\t\tG1=15, G2=91, G3=91');
