// Test script to validate scoring logic
// This will simulate the exact admin app scoring with demo values

const fs = require('fs');
const path = require('path');

// Load point distribution
const pointDistribution = JSON.parse(
  fs.readFileSync('./data/pointDistribution.json', 'utf-8')
);

console.log('Point Distribution loaded:', Object.keys(pointDistribution));

// Demo input values matching what we entered in admin and simulator
const inputValues = {
  'rudy-0': {  // Rudy's 1 / Team A
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
  'rudy-1': {  // Rudy's 2 / Team B
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
  'rudy-2': {  // Rudy's 3 / Team C
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
  'rudy-3': {  // Rudy's 4 / Team D
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

// Scoring logic extracted from adminCompetitorsList.js
function calculateMetricPoints(game, round, metric, competitorsList, inputValues, pointDistribution) {
  // Sort competitors based on metric
  const competitors = Array.isArray(competitorsList) ? competitorsList : Object.keys(competitorsList);
  const sortedCompetitors = [...competitors].sort((a, b) => {
    const aValue = parseFloat(inputValues[a][`${game}-${round}-${metric}`] || 0);
    const bValue = parseFloat(inputValues[b][`${game}-${round}-${metric}`] || 0);

    if (metric === 'speed') {
      return aValue - bValue; // Lower is better
    } else if (metric === 'variance') {
      return Math.abs(aValue) - Math.abs(bValue); // Closer to 0 is better
    } else if (metric === 'presentation') {
      return bValue - aValue; // Higher is better
    }
  });

  // Assign points based on placement (with tie handling)
  const pointsArray = pointDistribution[`${game}-${round}-${metric}`];
  let rank = 0;

  const results = {};

  while (rank < sortedCompetitors.length) {
    const currentValue = parseFloat(
      inputValues[sortedCompetitors[rank]][`${game}-${round}-${metric}`] || 0
    );

    // Find all competitors with the same value (ties)
    const tieCompetitors = [sortedCompetitors[rank]];
    while (
      rank + tieCompetitors.length < sortedCompetitors.length &&
      parseFloat(
        inputValues[sortedCompetitors[rank + tieCompetitors.length]][
          `${game}-${round}-${metric}`
        ] || 0
      ) === currentValue
    ) {
      tieCompetitors.push(sortedCompetitors[rank + tieCompetitors.length]);
    }

    // Calculate average points for tied competitors
    const totalPoints = tieCompetitors.reduce((sum, _, index) => {
      const points = Number(pointsArray[rank + index]);
      return sum + (Number.isFinite(points) ? points : 0);
    }, 0);
    const averagePoints = totalPoints / tieCompetitors.length;

    // Assign average points to each tied competitor
    tieCompetitors.forEach((competitor) => {
      results[competitor] = averagePoints;
    });

    rank += tieCompetitors.length;
  }

  return results;
}

// Calculate scores for all games and rounds
const games = [
  { name: 'game1', rounds: [1, 2, 3], metrics: ['speed', 'variance', 'presentation'] },
  { name: 'game2', rounds: [1], metrics: ['speed', 'presentation'] },
  { name: 'game3', rounds: [1], metrics: ['speed', 'presentation'] }
];

const competitors = Object.keys(inputValues);
const scores = {};

competitors.forEach((c) => {
  scores[c] = {
    'game1-total': 0,
    'game2-total': 0,
    'game3-total': 0
  };
});

games.forEach(({ name: game, rounds, metrics }) => {
  rounds.forEach((round) => {
    metrics.forEach((metric) => {
      const points = calculateMetricPoints(
        `${game}-round${round}`,
        metric,
        competitors,  // Pass array of competitors
        inputValues,
        pointDistribution
      );

      Object.entries(points).forEach(([competitor, pointValue]) => {
        const key = `${game}-round${round}-${metric}-points`;
        inputValues[competitor][key] = pointValue;

        // Accumulate game totals
        if (game === 'game1') {
          scores[competitor]['game1-total'] += pointValue;
        } else if (game === 'game2') {
          scores[competitor]['game2-total'] += pointValue;
        } else if (game === 'game3') {
          scores[competitor]['game3-total'] += pointValue;
        }
      });
    });
  });
});

// Output results
console.log('\n=== SCORING RESULTS ===\n');
competitors.forEach((competitor) => {
  console.log(`${competitor}:`);
  console.log(`  Game 1 Total: ${scores[competitor]['game1-total']}`);
  console.log(`  Game 2 Total: ${scores[competitor]['game2-total']}`);
  console.log(`  Game 3 Total: ${scores[competitor]['game3-total']}`);
});

console.log('\n=== DETAILED METRIC POINTS ===\n');
games.forEach(({ name: game, rounds, metrics }) => {
  console.log(`${game.toUpperCase()}:`);
  rounds.forEach((round) => {
    metrics.forEach((metric) => {
      console.log(`  round${round}-${metric}:`);
      competitors.forEach((competitor) => {
        const key = `${game}-round${round}-${metric}-points`;
        const value = inputValues[competitor][key];
        console.log(`    ${competitor}: ${value}`);
      });
    });
  });
});
