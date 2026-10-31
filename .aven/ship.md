# Ship this thread's work

Follow this sequence. Keep the thread's existing branch and target `main`. Create
a draft PR; leave review and merging to people. Do not enable auto-merge, merge,
push directly to `main`, or run deployment/release commands. The Cloudflare
`--dry-run` check below is validation, not deployment.

1. **Review and prepare.** Read `docs/README.md` and the relevant working guides.
   Run `git status --short`, `git diff`, and `git diff --cached`. Include only work
   belonging to this thread, including intended `.aven` configuration. Keep clear,
   imperative commit messages (for example, `Configure Aven environment and shipping`);
   Conventional Commit prefixes are not required. Never commit secrets, `.env`,
   dependency stores, build output, or unrelated changes. Do not edit the lockfile
   by hand; use pnpm and review generated changes. If the branch is `main`, stop
   and ask for a feature branch rather than committing or pushing there.

2. **Validate, commit, and update.** Run the complete check block below before
   committing. Stage explicit intended paths with `git add`, review
   `git diff --cached`, and commit with `git commit -m` and an appropriate message.
   If there is nothing new to commit, continue with existing thread commits.
   Update the base with `git fetch origin main && git rebase origin/main`.
   Resolve only conflicts you understand, preserving both sides' intent; if you
   cannot resolve them safely, stop and report the conflict. If GitHub is not
   connected, report that shipping is blocked; `git_fetch` can refresh `main`
   for local work but cannot push or open the PR.

3. **Collect proof for every UI change.** Start the changed web app with
   `pnpm --filter @repo/web dev` using `start_process`, wait for port 3000, and
   exercise the affected routes and states in the sandbox browser. Start API and
   worker services only if the flow needs them, with `start_process`; use the
   local services from `.aven/resume` and run `pnpm db:migrate` when needed. Use
   synthetic data, not customer data. If credentials are missing, request them
   privately; never print or commit them. If an essential flow cannot be verified,
   stop and report the blocker rather than inventing proof.

   Run `mkdir -p .aven/proof`. Capture PNG screenshots of the changed screens;
   include before/after comparisons when useful, using an isolated baseline
   worktree rather than discarding the thread's work. Use descriptive, unique
   filenames so existing proof is not overwritten. For an unauthenticated screen,
   this is a concrete capture command (choose the actual changed route and file):

   ```sh
   chromium --headless --no-sandbox --disable-dev-shm-usage \
     --window-size=1440,1000 --virtual-time-budget=5000 \
     --screenshot="$PWD/.aven/proof/changed-screen-after.png" http://localhost:3000
   ```

   For authenticated or interactive states, use the desktop browser tools and
   save the screenshot as a PNG under `.aven/proof/`. Inspect the images and
   remove sensitive content before staging. Stop managed dev servers when done.
   Commit proof images with the change (or a separate imperative proof commit)
   and keep them through merge. Link them from the PR's Testing section using
   branch-relative links such as `.aven/proof/changed-screen-after.png`, with a
   short caption naming the route/state and any viewport or comparison context.
   `gh` cannot attach media; the images must be in the branch. Non-UI changes
   need text check results, not screenshots. Recordings are not required;
   Playwright is not installed by the current `.aven/setup`.

4. **Verify the final rebased tree.** Run these commands from the repository root,
   using Node.js 24 and pnpm 10.30.3, matching `.github/workflows/ci-cd.yml`:

   ```sh
   pnpm install --frozen-lockfile --reporter=silent &&
   pnpm --filter @repo/db exec drizzle-kit check &&
   pnpm check &&
   pnpm typecheck &&
   pnpm test &&
   pnpm build &&
   pnpm --filter @repo/web exec wrangler deploy --dry-run &&
   git diff --check
   ```

   Fix failures caused by this work and rerun affected checks, then the full
   block. For baseline failures or unavailable prerequisites you cannot fix,
   stop and report the exact command and blocker. Never ship with failed or
   skipped required checks. Review generated changes; commit intended fixes
   after validation and verify the final tree again if its contents changed.
   Confirm `git status --short` has no uncommitted intended work before pushing.

5. **Push only the thread branch.** Run `git push -u origin HEAD`. On rejection
   or authentication failure, stop and report it. Do not force-push without
   explicit approval, and never force-push `main`.

6. **Create or update the draft PR.** Find an existing PR with
   `gh pr list --head "$(git branch --show-current)" --base main --state open --json number,url,isDraft`.
   Use an imperative title and write the description to `/tmp/aven-pr-body.md`
   with these sections:
   - **Summary:** what changed.
   - **Why:** the problem and rationale.
   - **Testing:** exact commands and pass/fail results, test counts when available,
     and links/captions for committed UI proof. Do not paste noisy full logs.
   - **Risks:** migration, compatibility, operational risks or `None identified`.
   - **Follow-ups:** remaining work or `None`.

   Exclude secrets, customer data, and private/internal links. Add no reviewers,
   labels, or issue links automatically; include them only when explicitly
   supplied by the user. Set `pr_title` to the chosen title. For a new PR, run
   `gh pr create --draft --base main --head "$(git branch --show-current)" --title "$pr_title" --body-file /tmp/aven-pr-body.md`.
   For an existing PR, use its URL as `pr_url` and run
   `gh pr edit "$pr_url" --title "$pr_title" --body-file /tmp/aven-pr-body.md`;
   if it is ready for review, run `gh pr ready "$pr_url" --undo` to restore draft
   status. Do not create duplicates. If creation/update fails, report that the
   branch was pushed but the PR step failed.

7. **Report, do not merge.** Inspect `gh pr checks "$pr_url"` (set `pr_url` from
   the create command's output for a new PR). For failures, inspect
   `gh run view <run-id> --log-failed`, fix issues caused by this work, and repeat
   validation/push; otherwise report the blocker. Pending checks are pending,
   not passing. Tell the user the PR URL, local check results, proof links,
   and CI status. Leave the PR draft and do not merge or enable auto-merge.
