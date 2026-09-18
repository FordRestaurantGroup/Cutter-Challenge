// Test script to validate scoring logic
// Matches the exact scoring from adminCompetitorsList.js and leaderboards.js

const fs = require('fs');
const path = require('path');

// Load point distribution
const pointDistribution = JSON.parse(
  fs.readFileSync('./data/pointDistribution.json', 'utf-8')
);

// Demo input values matching what we'll test
const inputValues = {
  'demo-0': {
    'game1-round1-speed-minutes': 1,
    'game1-round1-speed-seconds': 0,
    'game1-round1-speed-centiseconds': 0,
    'game1-round1-variance': 0,
    'game1-round1-presentation': 30,
    'game1-round2-speed-minutes': 1,
    'game1-round2-speed-seconds': 0,
    'game1-round2-speed-centiseconds': 0,
    'game1-round2-variance': 0,
    'game1-round2-presentation': 30,
    'game1-round3-speed-minutes': 1,
    'game1-round3-speed-seconds': 0,
    'game1-round3-speed-centiseconds': 0,
    'game1-round3-variance': 0,
    'game1-round3-presentation': 30,
    'game2-round1-speed-minutes': 1,
    'game2-round1-speed-seconds': 40,
    'game2-round1-speed-centiseconds': 0,
    'game2-round1-presentation': 30,
    'game3-round1-speed-minutes': 1,
    'game3-round1-speed-seconds': 40,
    'game3-round1-speed-centiseconds': 0,
    'game3-round1-presentation': 30
  },
  'demo-1': {
    'game1-round1-speed-minutes': 1,
    'game1-round1-speed-seconds': 45,
    'game1-round1-speed-centiseconds': 0,
    'game1-round1-variance': 0.25,
    'game1-round1-presentation': 27,
    'game1-round2-speed-minutes': 1,
    'game1-round2-speed-seconds': 45,
    'game1-round2-speed-centiseconds': 0,
    'game1-round2-variance': 0.25,
    'game1-round2-presentation': 27,
    'game1-round3-speed-minutes': 1,
    'game1-round3-speed-seconds': 45,
    'game1-round3-speed-centiseconds': 0,
    'game1-round3-variance': 0.25,
    'game1-round3-presentation': 27,
    'game2-round1-speed-minutes': 1,
    'game2-round1-speed-seconds': 50,
    'game2-round1-speed-centiseconds': 0,
    'game2-round1-presentation': 27,
    'game3-round1-speed-minutes': 1,
    'game3-round1-speed-seconds': 50,
    'game3-round1-speed-centiseconds': 0,
    'game3-round1-presentation': 27
  },
  'demo-2': {
    'game1-round1-speed-minutes': 2,
    'game1-round1-speed-seconds': 0,
    'game1-round1-speed-centiseconds': 0,
    'game1-round1-variance': 0.5,
    'game1-round1-presentation': 24,
    'game1-round2-speed-minutes': 2,
    'game1-round2-speed-seconds': 0,
    'game1-round2-speed-centiseconds': 0,
    'game1-round2-variance': 0.5,
    'game1-round2-presentation': 24,
    'game1-round3-speed-minutes': 2,
    'game1-round3-speed-seconds': 0,
    'game1-round3-speed-centiseconds': 0,
    'game1-round3-variance': 0.5,
    'game1-round3-presentation': 24,
    'game2-round1-speed-minutes': 2,
    'game2-round1-speed-seconds': 0,
    'game2-round1-speed-centiseconds': 0,
    'game2-round1-presentation': 24,
    'game3-round1-speed-minutes': 2,
    'game3-round1-speed-seconds': 0,
    'game3-round1-speed-centiseconds': 0,
    'game3-round1-presentation': 24
  },
  'demo-3': {
    'game1-round1-speed-minutes': 2,
    'game1-round1-speed-seconds': 15,
    'game1-round1-speed-centiseconds': 0,
    'game1-round1-variance': 0.75,
    'game1-round1-presentation': 21,
    'game1-round2-speed-minutes': 2,
    'game1-round2-speed-seconds': 15,
    'game1-round2-speed-centiseconds': 0,
    'game1-round2-variance': 0.75,
    'game1-round2-presentation': 21,
    'game1-round3-speed-minutes': 2,
    'game1-round3-speed-seconds': 15,
    'game1-round3-speed-centiseconds': 0,
    'game1-round3-variance': 0.75,
    'game1-round3-presentation': 21,
    'game2-round1-speed-minutes': 2,
    'game2-round1-speed-seconds': 15,
    'game2-round1-speed-centiseconds': 0,
    'game2-round1-presentation': 21,
    'game3-round1-speed-minutes': 2,
    'game3-round1-speed-seconds': 15,
    'game3-round1-speed-centiseconds': 0,
    'game3-round1-presentation': 21
  }
};

// Convert time to seconds
function timeStringToSeconds(timeString) {
  const [minutes, seconds, centiseconds] = timeString.split(':').map(parseFloat);
  return minutes * 60 + seconds + centiseconds / 100;
}

// Convert minutes:seconds:centiseconds to string
function formatTime(minutes, seconds, centiseconds) {
  const totalSeconds = minutes * 60 + seconds + centiseconds / 100;
  const formattedMinutes = Math.floor(totalSeconds / 60);
  const formattedSeconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  const formattedCentiseconds = ((totalSeconds % 1) * 100)
    .toFixed(0)
    .padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}:${formattedCentiseconds}`;
}

// Calculate metric points with tie handling
function calculateMetricPoints(game, round, metric, pointsArray) {
  if (!pointsArray) {
    console.error(`Missing points array for ${game}-${round}-${metric}`);
    return;
  }

  // Build data for sorting
  const competitorData = [];
  for (const [name, data] of Object.entries(inputValues)) {
    let value;

    if (metric === 'speed') {
      const minutes = data[`${game}-${round}-speed-minutes`] || 0;
      const seconds = data[`${game}-${round}-speed-seconds`] || 0;
      const centiseconds = data[`${game}-${round}-speed-centiseconds`] || 0;
      value = formatTime(minutes, seconds, centiseconds);
    } else {
      value = data[`${game}-${round}-${metric}`] || 0;
      if (metric === 'variance') {
        value = Math.abs(parseFloat(value));
      } else {
        value = parseFloat(value);
      }
    }

    competitorData.push({ name, value });
  }

  // Sort
  competitorData.sort((a, b) => {
    if (metric === 'speed') {
      return timeStringToSeconds(a.value) - timeStringToSeconds(b.value);
    } else if (metric === 'variance') {
      return a.value - b.value;
    } else if (metric === 'presentation') {
      return b.value - a.value;
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
console.log('\n=== ADMIN APP SCORING (TEST) ===\n');
console.log('Game Totals (Cumulative):');
console.log('Competitor\t\tGame 1\t\tGame 2\t\tGame 3');
console.log('---\t\t\t---\t\t---\t\t---');
Object.entries(cumulativeTotals).forEach(([name, totals]) => {
  console.log(`${name}\t\t${totals.game1}\t\t${totals.game2}\t\t${totals.game3}`);
});

// Compare with simulator output
console.log('\n=== EXPECTED SIMULATOR OUTPUT ===\n');
console.log('Team A (demo-0):\t\tG1=62, G2=174, G3=361');
console.log('Team B (demo-1):\t\tG1=49, G2=141, G3=253');
console.log('Team C (demo-2):\t\tG1=30, G2=104, G3=179');
console.log('Team D (demo-3):\t\tG1=15, G2=91, G3=91');
