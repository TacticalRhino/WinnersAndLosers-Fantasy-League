const state = {
  rosters: null,
  results: null,
  lastUpdatedAt: null
};

const q = s => document.querySelector(s);

const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[m]));

/* =========================================
   DATA LOADING
   ========================================= */

async function fetchFreshJson(path) {
  const separator = path.includes("?") ? "&" : "?";

  const response = await fetch(
    `${path}${separator}v=${Date.now()}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to load ${path}: ${response.status}`
    );
  }

  return response.json();
}

async function load() {
  const [rosters, results] = await Promise.all([
    fetchFreshJson("data/rosters.json"),
    fetchFreshJson("data/standings.json")
  ]);

  state.rosters = rosters;
  state.results = results;
  state.lastUpdatedAt = results.updated_at || null;

  updateHeader();
  renderAll();
}

/* =========================================
   AUTOMATIC STANDINGS REFRESH
   ========================================= */

async function refreshStandings() {
  try {
    const freshResults =
      await fetchFreshJson("data/standings.json");

    const freshTimestamp =
      freshResults.updated_at || null;

    /*
      Only redraw the page if GitHub has actually
      published a newer standings file.
    */
    if (
      freshTimestamp &&
      freshTimestamp !== state.lastUpdatedAt
    ) {
      console.log(
        "New standings detected:",
        freshTimestamp
      );

      state.results = freshResults;
      state.lastUpdatedAt = freshTimestamp;

      updateHeader();
      renderAll();
    }
  } catch (error) {
    /*
      Don't break the site if one background
      refresh fails. Keep showing the most
      recently loaded standings.
    */
    console.warn(
      "Background standings refresh failed:",
      error
    );
  }
}

/* =========================================
   HEADER
   ========================================= */

function updateHeader() {
  q("#updatedAt").textContent =
    state.results.updated_at
      ? new Date(
          state.results.updated_at
        ).toLocaleString()
      : "Awaiting first update";

  q("#managerCount").textContent =
    state.rosters.managers.length;

  q("#pickCount").textContent =
    state.rosters.managers.reduce(
      (n, m) => n + m.picks.length,
      0
    );
}

/* =========================================
   SCORING
   ========================================= */

function pointsForPick(p) {
  const key = `${p.sport}|${p.team}`;

  const rec =
    state.results.team_records?.[key] || {
      wins: 0,
      losses: 0,
      ties: 0
    };

  return p.side === "Winner"
    ? rec.wins
    : rec.losses;
}

function computedStandings() {
  return state.rosters.managers
    .map(m => {
      const buckets = {
        "CFB Winner": 0,
        "CFB Loser": 0,
        "NFL Winner": 0,
        "NFL Loser": 0
      };

      m.picks.forEach(p => {
        buckets[
          `${p.sport} ${p.side}`
        ] += pointsForPick(p);
      });

      const total =
        Object.values(buckets).reduce(
          (a, b) => a + b,
          0
        );

      return {
        ...m,
        buckets,
        total
      };
    })
    .sort(
      (a, b) =>
        b.total - a.total ||
        a.manager.localeCompare(b.manager)
    )
    .map((m, i) => ({
      ...m,
      rank: i + 1
    }));
}

/* =========================================
   STANDINGS
   ========================================= */

function renderStandings() {
  const term =
    q("#standingSearch").value.toLowerCase();

  q("#standingsBody").innerHTML =
    computedStandings()
      .filter(m =>
        m.manager
          .toLowerCase()
          .includes(term)
      )
      .map(
        m => `
          <tr>
            <td class="rank">${m.rank}</td>

            <td>
              <strong>
                ${esc(m.manager)}
              </strong>
            </td>

            <td>
              ${m.buckets["CFB Winner"]}
            </td>

            <td>
              ${m.buckets["CFB Loser"]}
            </td>

            <td>
              ${m.buckets["NFL Winner"]}
            </td>

            <td>
              ${m.buckets["NFL Loser"]}
            </td>

            <td class="total">
              ${m.total}
            </td>
          </tr>
        `
      )
      .join("");
}

/* =========================================
   MANAGERS
   ========================================= */

function renderManagers() {
  const term =
    q("#managerSearch").value.toLowerCase();

  q("#managerCards").innerHTML =
    computedStandings()
      .filter(m =>
        (
          m.manager +
          " " +
          m.picks
            .map(p => p.team)
            .join(" ")
        )
          .toLowerCase()
          .includes(term)
      )
      .map(m => {
        const group =
          (sport, side) =>
            m.picks
              .filter(
                p =>
                  p.sport === sport &&
                  p.side === side
              )
              .map(
                p => `
                  <div class="pick">
                    <span>
                      ${esc(p.team)}
                    </span>

                    <strong>
                      ${pointsForPick(p)}
                    </strong>
                  </div>
                `
              )
              .join("");

        return `
          <article class="manager-card">

            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:12px
              "
            >
              <div>
                <span class="pill">
                  #${m.rank}
                </span>

                <h3>
                  ${esc(m.manager)}
                </h3>
              </div>

              <div class="manager-total">
                ${m.total}
              </div>
            </div>

            <div class="pick-grid">

              <div class="pick-group">
                <h4>CFB Winners</h4>
                ${group("CFB", "Winner")}
              </div>

              <div class="pick-group">
                <h4>CFB Losers</h4>
                ${group("CFB", "Loser")}
              </div>

              <div class="pick-group">
                <h4>NFL Winners</h4>
                ${group("NFL", "Winner")}
              </div>

              <div class="pick-group">
                <h4>NFL Losers</h4>
                ${group("NFL", "Loser")}
              </div>

            </div>
          </article>
        `;
      })
      .join("");
}

/* =========================================
   TEAMS
   ========================================= */

function renderTeams() {
  const usage = {};

  state.rosters.managers.forEach(m =>
    m.picks.forEach(p => {
      const key =
        `${p.sport}|${p.team}`;

      usage[key] ??= {
        sport: p.sport,
        team: p.team,
        uses: []
      };

      usage[key].uses.push({
        manager: m.manager,
        side: p.side
      });
    })
  );

  const term =
    q("#teamSearch").value.toLowerCase();

  q("#teamsBody").innerHTML =
    Object.entries(usage)
      .map(([key, x]) => {
        const rec =
          state.results
            .team_records?.[key] || {
              wins: 0,
              losses: 0,
              ties: 0
            };

        const pointSet = [
          ...new Set(
            x.uses.map(u =>
              u.side === "Winner"
                ? rec.wins
                : rec.losses
            )
          )
        ].join(" / ");

        return {
          ...x,
          key,
          rec,
          pointSet
        };
      })
      .filter(x =>
        x.team
          .toLowerCase()
          .includes(term)
      )
      .sort(
        (a, b) =>
          a.sport.localeCompare(
            b.sport
          ) ||
          a.team.localeCompare(
            b.team
          )
      )
      .map(
        x => `
          <tr>

            <td>
              ${x.sport}
            </td>

            <td>
              <strong>
                ${esc(x.team)}
              </strong>
            </td>

            <td>
              ${x.rec.wins}-${x.rec.losses}${
                x.rec.ties
                  ? `-${x.rec.ties}`
                  : ""
              }
            </td>

            <td>
              ${x.uses
                .map(
                  u => `
                    ${esc(u.manager)}
                    <span class="pill">
                      ${u.side}
                    </span>
                  `
                )
                .join("<br>")}
            </td>

            <td class="total">
              ${x.pointSet}
            </td>

          </tr>
        `
      )
      .join("");
}

/* =========================================
   RENDER
   ========================================= */

function renderAll() {
  renderStandings();
  renderManagers();
  renderTeams();
}

/* =========================================
   TAB NAVIGATION
   ========================================= */

document.addEventListener(
  "click",
  e => {
    if (
      e.target.classList.contains(
        "tab"
      )
    ) {
      document
        .querySelectorAll(
          ".tab,.panel"
        )
        .forEach(x =>
          x.classList.remove(
            "active"
          )
        );

      e.target.classList.add(
        "active"
      );

      q(
        "#" +
        e.target.dataset.tab
      ).classList.add(
        "active"
      );
    }
  }
);

/* =========================================
   SEARCH
   ========================================= */

document.addEventListener(
  "input",
  e => {
    if (
      e.target.id ===
      "standingSearch"
    ) {
      renderStandings();
    }

    if (
      e.target.id ===
      "managerSearch"
    ) {
      renderManagers();
    }

    if (
      e.target.id ===
      "teamSearch"
    ) {
      renderTeams();
    }
  }
);

/* =========================================
   INITIAL LOAD
   ========================================= */

load().catch(err => {
  console.error(err);

  q("#updatedAt").textContent =
    "Data load error";
});

/* =========================================
   LIVE BACKGROUND REFRESH
   ========================================= */

/*
  Check GitHub Pages for newly published
  standings every 5 minutes.

  This does NOT cause any extra CFBD API
  calls. It only checks the JSON file that
  GitHub Pages has already published.
*/

const REFRESH_INTERVAL =
  5 * 60 * 1000;

setInterval(
  refreshStandings,
  REFRESH_INTERVAL
);

/*
  Also check immediately when a user returns
  to the tab after having it in the background.
*/

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      refreshStandings();
    }
  }
);

/*
  Also refresh when a phone/browser comes
  back online after losing connectivity.
*/

window.addEventListener(
  "online",
  refreshStandings
);
