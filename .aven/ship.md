# Ship this thread's work

Target pull requests at **main**. Keep the thread's existing branch. Open **draft** pull requests and leave all merging to people: do not merge, enable auto-merge, or deploy production. No reviewers, labels, ticket IDs, or special commit prefixes are required.

## 1. Review and commit the work

Run `git status --short`, `git diff`, and `git diff --check`. Read untracked files before staging them. Commit only changes belonging to this task, including its `.aven` configuration when applicable. Never commit secrets, `.env`, dependencies, build output, unrelated changes, or unsanitized logs. The non-secret `.env.example` may be committed. Do not edit the lockfile by hand; use the repository-pinned pnpm if dependencies change.

Use `git add <explicit-paths>` and `git commit -m "<clear imperative summary>"`. Do not use blanket staging. If unrelated changes prevent updating the branch, stop and explain rather than discarding them.

## 2. Update from main

Set `branch=$(git branch --show-current)`. If it is `main` or empty (detached), stop rather than pushing to main. Otherwise run:

```sh
git fetch origin main
git rebase origin/main
```

If GitHub authentication is unavailable, report that the user must connect GitHub in Aven. You may use `git_fetch` with branch `main` to read the latest base, but do not claim to have shipped. Resolve only conflicts whose intended resolution is clear; otherwise stop and report them. Never discard user work.

## 3. Run the same validation as CI

Use Node.js 24+ and the pnpm version declared in `package.json`. Run these commands after rebasing:

```sh
pnpm install --frozen-lockfile --reporter=silent
pnpm --filter @repo/db exec drizzle-kit check
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @repo/web exec wrangler deploy --dry-run
```

Every command must succeed before pushing. Fix failures caused by this work, commit the fixes, and rerun validation. If a failure cannot be fixed safely, stop and report the failed command and relevant sanitized output; do not ship with failing checks. The Wrangler command is a dry-run only, not a production deployment. Never run `pnpm deploy:web` as part of shipping.

## 4. Capture proof for every UI change

For changes affecting a visible screen or user flow, include **screenshots and a screen recording** demonstrating the actual changed behavior. Non-UI changes need only a text summary of validation. Use synthetic/local data and never expose credentials, tokens, customer data, or private pages in proof.

Chromium and `ffmpeg` are available in the sandbox; Playwright is not installed by `.aven/setup`. Use the desktop browser and desktop tools, not an uninstalled Playwright command. For flows requiring the API, ensure the local services are running and the database URL targets the disposable localhost database before running `pnpm db:migrate`. Obtain any missing runtime secret through the secure secret tool, never in the PR or a committed file.

Start `pnpm dev` with `start_process`, inspect its logs, and wait for the relevant application ports. Initialize the desktop with `desktop_screenshot`, then open `http://localhost:3000` in the desktop browser. Choose a proof directory and discover the active X socket; the inherited `DISPLAY` may point to an inactive display:

```sh
branch=$(git branch --show-current)
proof_dir=".aven/proof/$(printf '%s' "$branch" | tr '/' '-')"
mkdir -p "$proof_dir"
capture_display=":$(find /tmp/.X11-unix -maxdepth 1 -type s -name 'X[0-9]*' -printf '%f\n' | sort -V | tail -1 | sed 's/^X//')"
test "$capture_display" != ":"
```

If no socket exists, stop and report that desktop capture is unavailable. If several exist, verify that the selected display matches the desktop browser, and adjust it if needed.

Capture the changed screen with the following command, using a descriptive filename for each additional screenshot:

```sh
ffmpeg -hide_banner -loglevel error -y -f x11grab -i "$capture_display" \
  -frames:v 1 -update 1 "$proof_dir/after.png"
```

Start this bounded recording command with `start_process` (include assignments for the chosen proof directory and capture display in that process's command), then exercise the changed flow with desktop tools during the recording:

```sh
ffmpeg -hide_banner -loglevel error -y -f x11grab -framerate 15 -i "$capture_display" \
  -t 45 -an -vf 'scale=trunc(iw/2)*2:trunc(ih/2)*2' \
  -c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p \
  -movflags +faststart "$proof_dir/flow.mp4"
```

Check the recording process's completion and logs with the process tools. Confirm that the clip covers the flow, not just a static page, and inspect the screenshots. Validate the recording with `ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "$proof_dir/flow.mp4"`. Keep clips short and each media file under 10 MiB; recompress if necessary. Stop any dev servers you started when finished.

Add a short `README.md` beside the media describing the scenario, reproduction steps, and observed outcome. Commit only sanitized proof files with explicit paths, run `pnpm check` again for the new Markdown, and commit any formatting fixes before pushing. Retain `.aven/proof/` in the branch for merging; do not remove it automatically. If runtime access or capture fails, stop and report the blocker rather than omitting required proof or inventing it.

## 5. Push and create or update the draft PR

Confirm `git status --short` contains no uncommitted task changes and run `git diff --check`. Set `branch=$(git branch --show-current)` again before the PR commands below; stop if it is `main` or empty. Push only this feature branch:

```sh
git push -u origin HEAD
```

If a previously pushed branch was rebased and a normal push is rejected as non-fast-forward, inspect the remote branch before proceeding. Only when it contains no unseen work may you use `git push --force-with-lease origin HEAD` on this feature branch. Never force-push or push directly to `main`. Stop on any other push failure.

Look for an existing open PR with `gh pr list --state open --head "$branch" --base main --json number,url,isDraft`. If there is none, use `gh pr create --draft --base main --head "$branch" --title "<clear summary>" --body-file <temporary-body-file>`. If one exists, update its title/body using `gh pr edit <number> --title "<clear summary>" --body-file <temporary-body-file>` rather than opening a duplicate. If it is ready for review, convert it back to draft with `gh pr ready <number> --undo`.

Use these description sections (or the repository's PR template if one is added later):

- **Summary**: what changed.
- **Why**: motivation and scope.
- **Validation**: actual commands and results, including test counts where available; no claims of checks you did not run.
- **UI proof**: for UI changes, link the screenshots, recording, and reproduction README using full GitHub blob URLs on this feature branch. `gh` cannot upload PR attachments; files must be committed. For non-UI work, say "Not applicable".
- **Risks and follow-ups**: compatibility, migration, configuration, or deployment implications; say "None" when appropriate.

Use `gh pr checks <number>` to report the current CI state; pending checks are not a failure or a pass. Diagnose failures with `gh run view <run-id> --log-failed`, fix task-related failures and rerun local checks before repushing, or report blockers. Do not merge even when checks pass.

## 6. Report back

Tell the user the PR URL, validation results, proof links when applicable, and any pending CI or follow-ups. State that the PR is draft and awaiting manual review/merge. Never claim deployment occurred: this repository's CD job is only a placeholder.
