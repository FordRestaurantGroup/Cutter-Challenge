const GAME_KEYS = ['game1', 'game2', 'game3'];

export function buildLeaderboardEntries(data = {}) {
  return Object.entries(data).map(([name, personData]) => {
    const rawGamePoints = {};

    for (const [key, value] of Object.entries(personData || {})) {
      if (!key.endsWith('points')) continue;

      const game = key.split('-')[0];
      rawGamePoints[game] = (rawGamePoints[game] || 0) + Number(value || 0);
    }

    let cumulativePoints = 0;
    const cumulativeGames = {};

    for (const game of GAME_KEYS) {
      cumulativePoints += rawGamePoints[game] || 0;
      cumulativeGames[game] = cumulativePoints;
    }

    return {
      name,
      location: personData?.location || '',
      eliminated: Boolean(personData?.eliminated),
      ...cumulativeGames,
    };
  });
}

export function getLatestScoredGame(data = {}) {
  for (const game of [...GAME_KEYS].reverse()) {
    const hasPoints = Object.values(data).some((personData) =>
      Object.entries(personData || {}).some(
        ([key, value]) =>
          key.startsWith(`${game}-`) &&
          key.endsWith('points') &&
          Number(value || 0) !== 0
      )
    );

    if (hasPoints) return game;
  }

  return 'game1';
}

export function sortEntriesForCurrentStandings(entries, latestGame) {
  return [...entries].sort((a, b) => {
    const pointDifference = (b[latestGame] || 0) - (a[latestGame] || 0);
    if (pointDifference !== 0) return pointDifference;
    return a.name.localeCompare(b.name);
  });
}

export function createLeaderboardSnapshot(
  data = {},
  { title = 'Current Standings' } = {}
) {
  const latestGame = getLatestScoredGame(data);
  const latestGameIndex = GAME_KEYS.indexOf(latestGame);
  const visibleGames = GAME_KEYS.slice(0, latestGameIndex + 1);
  const entries = sortEntriesForCurrentStandings(
    buildLeaderboardEntries(data),
    latestGame
  );

  return {
    version: 1,
    title,
    publishedAt: new Date().toISOString(),
    latestGame,
    columns: visibleGames.map((game, index) => ({
      key: game,
      label: `Game ${index + 1}`,
    })),
    rows: entries.map((entry, index) => ({
      rank: index + 1,
      name: entry.name,
      location: entry.location,
      eliminated: entry.eliminated,
      scores: Object.fromEntries(
        visibleGames.map((game) => [game, entry[game] || 0])
      ),
    })),
  };
}
