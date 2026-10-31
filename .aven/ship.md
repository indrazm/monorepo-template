# Ship this thread's work

Open or update a **ready-for-review** pull request against **main**, using the thread's current branch. Leave merging to people; prefer squash merge.

## 1. Review and prepare

- Read `docs/README.md` and the relevant working guides. Inspect `git status --short`, `git diff`, and `git diff --cached`. Include only changes belonging to this thread, including its `.aven` configuration when relevant.
- Check `git branch --show-current`. Keep that branch. If you are on `main` or a detached HEAD, stop and report that a thread branch is required. Never push directly to `main` or force-push it.
- Never commit secrets, `.env` files (except the public `.env.example`), dependency folders, or build output. Do not edit `pnpm-lock.yaml` by hand; use pnpm when dependencies change. Review generated migrations and keep SQL and snapshots together.
- Run `pnpm check && pnpm typecheck && pnpm test && pnpm build` before committing, as required by the repository guide. Fix failures caused by this work and retry; stop and report anything you cannot fix. Never ship with failed checks.
- Stage explicit paths with `git add -- <paths>` after review, not an indiscriminate `git add .`. Commit with `git commit -m "<clear description>"`. Follow the repository's existing clear, descriptive commit style; Conventional Commits are welcome but not required. If the work is already committed, do not create an empty commit.

## 2. Update from main

Run:

```sh
git fetch origin main
git rebase origin/main
```

If fetching fails, stop and report it. If conflicts occur, resolve only when the intended behavior is clear; otherwise abort with `git rebase --abort` and report the conflict. Do not discard unrelated work or rewrite `main`.

## 3. Record proof for UI changes

- For **every UI change**, exercise the changed screen or flow with the browser/desktop tools. Start any needed development server with `start_process`, wait for readiness, and stop it with `stop_process` when finished. Run `pnpm db:migrate` only against the intended local development database when the API needs its schema; never migrate an external database automatically.
- Create a focused folder under `.aven/proof/` with `mkdir -p .aven/proof/<change-topic>`. Capture actual PNG screenshots using the available browser/desktop screenshot tools and save them there. Include comparable before/after images when a prior screen exists; for a new screen, include its finished state and relevant interaction states. Do not substitute a description for an image or fabricate a prior state.
- Use non-sensitive test data. Inspect screenshots for credentials, tokens, private customer details, or internal information before committing. Show the user the saved images with `show_image`.
- **Keep proof files in the branch and through merge.** Do not remove them before merging. Link each image in the PR's Testing section using its GitHub blob URL on the pushed branch, not a sandbox path. You can obtain the repository and branch with `gh repo view --json nameWithOwner --jq .nameWithOwner` and `git branch --show-current`.
- Playwright is not installed by `.aven/setup`; do not assume it or its browsers are available. Screenshots do not require it. Recordings are not required by this policy.
- If you cannot run the UI or obtain trustworthy screenshots, stop and report the missing prerequisite rather than silently skipping proof. Non-UI changes need textual check results only, not image files.

## 4. Run all CI-equivalent checks

Run from the repository root, in this order, after rebasing and recording proof:

```sh
pnpm config set store-dir "$HOME/.local/share/pnpm/store"
pnpm install --frozen-lockfile --reporter=silent
pnpm --filter @repo/db exec drizzle-kit check
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @repo/web exec wrangler deploy --dry-run
```

Every command must pass. Fix failures caused by this work and rerun the full sequence; stop and report failures you cannot fix. Do not weaken tests, skip checks, deploy to Cloudflare, or use production credentials just to ship. If `.aven/setup` or `.aven/resume` changed, also run `bash -n .aven/setup .aven/resume`.

Review `git diff --check` and the final diff, stage only intended fixes and proof files, and commit them with a clear message. If source, dependencies, or configuration changed after checks passed, rerun all checks. Leave no intended work uncommitted.

## 5. Push and create or update the PR

Run:

```sh
git push -u origin HEAD
```

If the push is rejected or authentication fails, stop and report it. Do not force-push to work around rejection. If GitHub is not connected, tell the user to connect it; do not ask for a token in chat.

Prepare a concise title and a description in a temporary file outside the repository, with these sections:

- **Summary:** what changed.
- **Motivation:** why it changed.
- **Testing:** the commands run and their actual results; link committed screenshot proof for UI changes. Clearly distinguish automated checks from manual UI verification.
- **Risks:** compatibility, migration, operational, or other risks; say "None identified" when appropriate.
- **Follow-ups:** remaining work or "None".

Link any issues or tickets the user supplied. Do not invent references, auto-close issues without an explicit request, add reviewers or labels unless specified, or expose secrets, private customer details, or confidential internal links.

Check for an existing PR for this branch:

```sh
gh pr list --head "$(git branch --show-current)" --state open --json number,url,baseRefName,isDraft
```

If none exists, open a ready-for-review PR (no `--draft`):

```sh
pr_url=$(gh pr create --base main --title "$title" --body-file "$body_file")
```

Here, `title` is your prepared title and `body_file` is the temporary description file. For an existing PR, set `pr_url` to the URL returned by `gh pr list`. If it already targets `main`, update it with `gh pr edit "$pr_url" --title "$title" --body-file "$body_file"`; if it is a draft, run `gh pr ready "$pr_url"`. If an existing PR targets a different base, stop and report it rather than retargeting silently. If any GitHub command fails, stop and report the error; do not create duplicates. Remove the temporary description file afterward.

## 6. Report; do not merge

Run `gh pr checks "$pr_url"` to inspect CI. For failed checks, use `gh run view <run-id> --log-failed`, fix failures caused by this work, rerun local checks, and push normally. If a failure is outside this work, stop and report it. Pending checks are not passing checks; report them accurately.

Do not run `gh pr merge`, enable auto-merge, approve on the user's behalf, publish a release, or deploy. A person decides when to squash-merge. Finish with the PR URL, a short change summary, local and CI check status, links to UI proof when applicable, and any unresolved risks or follow-ups.
