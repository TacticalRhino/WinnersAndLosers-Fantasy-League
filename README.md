# Winners & Losers Football Challenge — 2026

A free static league hub for GitHub Pages.

## Features
- Overall standings sorted high to low.
- Every manager's 12 picks and current points.
- All drafted teams with records, owners, and side.
- Winner picks score one point per win; loser picks score one point per loss; ties score zero.
- Postseason records are included.
- Daily automated refresh with GitHub Actions plus manual refresh.

## Setup
1. Create a new public GitHub repository.
2. Upload every file/folder in this package, preserving folders.
3. Commit to `main`.
4. Request a free CollegeFootballData API key.
5. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
6. Name it `CFBD_API_KEY` and paste the key.
7. In **Settings → Pages**, choose **GitHub Actions** as the source.
8. In the **Actions** tab, run **Update standings and deploy** once.
9. Share the GitHub Pages URL with the league.

## Data sources
College records use CollegeFootballData `/records?year=2026`. The key stays in GitHub Secrets. NFL results use ESPN's public scoreboard endpoint, which requires no key but is unofficial/undocumented and may need adjustment in the future.

## Schedule
The workflow runs daily at 11:00 UTC. Scheduled GitHub jobs can occasionally run later. The workflow can always be run manually.

## Edit the league roster
Manager names and picks are in `data/rosters.json`.

## Privacy
A free GitHub Pages site from a public repo is public. Never put the CFBD API key in any repository file.
