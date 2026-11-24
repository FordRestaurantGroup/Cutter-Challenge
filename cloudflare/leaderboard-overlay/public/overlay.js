const content = document.getElementById('leaderboard-content');
const title = document.getElementById('leaderboard-title');
const publishedTime = document.getElementById('published-time');
const leaderboard = document.querySelector('.leaderboard');

if (new URLSearchParams(window.location.search).has('preview')) {
  document.body.classList.add('preview');
}

function formatScore(score) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(score);
}

function createCell(className, text) {
  const cell = document.createElement('div');
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function render(snapshot) {
  title.textContent = snapshot.title || 'Current Standings';
  content.replaceChildren();

  if (!snapshot.rows?.length) {
    content.appendChild(
      createCell('empty-state', 'Waiting for published scores…')
    );
    publishedTime.textContent = '';
    leaderboard.setAttribute('aria-busy', 'false');
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'standings-grid';
  grid.style.setProperty('--score-columns', snapshot.columns.length);

  const header = document.createElement('div');
  header.className = 'standings-row standings-row--header';
  header.append(
    createCell('rank-cell', '#'),
    createCell('competitor-cell', 'Cutter')
  );
  snapshot.columns.forEach((column) => {
    header.appendChild(createCell('score-cell', column.label));
  });
  grid.appendChild(header);

  snapshot.rows.forEach((row) => {
    const rowElement = document.createElement('div');
    rowElement.className = 'standings-row';
    if (row.eliminated) rowElement.classList.add('is-eliminated');
    if (row.rank <= 3) rowElement.dataset.place = String(row.rank);

    rowElement.appendChild(createCell('rank-cell', String(row.rank)));

    const competitorCell = document.createElement('div');
    competitorCell.className = 'competitor-cell';
    competitorCell.appendChild(createCell('competitor-name', row.name));
    if (row.location && row.location !== row.name) {
      competitorCell.appendChild(
        createCell('competitor-location', row.location)
      );
    }
    rowElement.appendChild(competitorCell);

    snapshot.columns.forEach((column) => {
      rowElement.appendChild(
        createCell('score-cell', formatScore(row.scores[column.key] || 0))
      );
    });

    grid.appendChild(rowElement);
  });

  content.appendChild(grid);
  publishedTime.textContent = snapshot.publishedAt
    ? `Updated ${new Date(snapshot.publishedAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : '';
  leaderboard.setAttribute('aria-busy', 'false');
}

async function refreshLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    render(await response.json());
  } catch (error) {
    console.error('Unable to refresh leaderboard:', error);
  }
}

await refreshLeaderboard();
window.setInterval(refreshLeaderboard, 5000);
