import assert from 'node:assert/strict';
import {
  createLeaderboardSnapshot,
  getLatestScoredGame,
} from './public/leaderboardModel.mjs';

const scores = {
  'Rudy\'s 2': {
    location: 'Dallas',
    'game1-round1-speed-points': 20,
    'game2-round1-speed-points': 40,
  },
  'Rudy\'s 1': {
    location: 'Austin',
    'game1-round1-speed-points': 25,
    'game2-round1-speed-points': 50,
  },
};

assert.equal(getLatestScoredGame(scores), 'game2');

const snapshot = createLeaderboardSnapshot(scores);
assert.equal(snapshot.latestGame, 'game2');
assert.deepEqual(
  snapshot.columns.map((column) => column.key),
  ['game1', 'game2']
);
assert.deepEqual(
  snapshot.rows.map((row) => row.name),
  ["Rudy's 1", "Rudy's 2"]
);
assert.deepEqual(snapshot.rows[0].scores, { game1: 25, game2: 75 });

console.log('Leaderboard model tests passed.');
