# Ship this thread's work

Use `main` as the PR base and keep this thread's existing `aven/...` branch.
Create a **draft** PR. Leave merging to a person using **rebase merge**; never
merge, enable auto-merge, or deploy from this workflow.

## 1. Review and commit

- Run `git status --short`, `git diff`, and `git diff --cached`. Inspect new
  files before staging them. Include only changes belonging to this task;
  leave unrelated work alone. Include relevant `.aven` files when setting up
  the environment or shipping policy.
- Set `branch="$(git branch --show-current)"`. Stop if HEAD is detached, if
  the branch is `main`, or if it is not this thread's branch. Never push
  directly to `main` or switch to a different working branch.
- Stage explicit paths with `git add -- <task-file-paths>` and review
  `git diff --cached --check` and `git diff --cached` before committing.
  Replace the path list with the actual task files; do not use `git add .`.
- Use a clear, concise commit message matching the repository's mixed style;
  Conventional Commits are not required. Run `git commit -m "$commit_message"`
  with a message describing the change. If everything is already committed,
  do not create an empty commit.
- Never commit real secrets, `.env`, dependency directories, build output,
  or raw logs containing sensitive data. Do not edit the lockfile by hand;
  use pnpm when an intentional dependency change requires regeneration.

## 2. Update from main

Run `git fetch origin main && git rebase origin/main` only when the working
tree is clean. If unrelated changes prevent rebasing, stop and explain;
do not stash, discard, or commit them without the user's direction.

Resolve conflicts only when the correct result is clear. If it is not,
run `git rebase --abort` and ask the user. If GitHub authentication is missing,
stop and explain that the user needs to connect GitHub; do not request a token
in chat. Do not rewrite already-published history without an explicit request.
If the branch has already been pushed and rebasing would rewrite its published
commits, stop before rebasing and ask the user how to proceed.

## 3. Run the CI checks locally

Use Node.js 24 and pnpm 10.30.3, as configured by `.aven/setup`. From the
repository root, run every command below in order and require each to exit 0:

```sh
pnpm install --frozen-lockfile --reporter=silent
pnpm --filter @repo/db exec drizzle-kit check
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @repo/web exec wrangler deploy --dry-run
```

The Wrangler command is a local bundle validation, not a deployment.
If a check fails, fix only issues caused by this task, commit those fixes,
and rerun all checks against the final commit. If a failure is unrelated or
cannot be fixed safely, stop and report the failing command; do not push.
Run `git status --short` afterward and inspect any generated changes. Commit
only intentional task changes, then rerun checks if those changes affect the
result. Never claim a check passed unless you ran it successfully.

## 4. Push and create or update the draft PR

- Run `git push -u origin "$branch"`. If rejected, stop and report why.
  Never force-push without an explicit user request, and never force-push main.
- Check for an existing open PR with
  `gh pr list --head "$branch" --base main --state open --json number,url`.
  If exactly one exists, use its number as `pr_number`. If more than one
  exists, stop and ask which to update. Leave an existing PR's review state
  unchanged.
- Set `pr_title` to a concise description of the change and set `pr_body` to
  a Markdown description with these headings:
  - **Summary**: what changed, including important files or behavior.
  - **Why**: the problem or reason for the change.
  - **Validation**: exact commands run and their results, including useful
    test counts; state what was not tested. Use concise, sanitized text only.
  - **Risks**: known compatibility, migration, or rollout concerns; use
    "None identified" only when accurate.
  - **Follow-ups**: remaining work or user actions, or "None" when accurate.
- Omit secrets, customer names, and private/internal links. Do not invent
  results, issue links, or reviewers. No screenshots, recordings, raw command
  output files, or committed proof artifacts are required.
- Create a new PR with
  `gh pr create --draft --base main --head "$branch" --title "$pr_title" --body "$pr_body"`.
  For an existing PR, run
  `gh pr edit "$pr_number" --title "$pr_title" --body "$pr_body"`.
  Do not automatically assign reviewers, add labels, or link tickets. Add
  these only when explicitly requested for the task.
- If push succeeds but PR creation/update fails, report that the branch was
  pushed and explain the PR failure. Do not claim shipping is complete.

## 5. Report and leave merging to the user

Get the URL with `gh pr view "$branch" --json url --jq .url` and set
`pr_number="$(gh pr view "$branch" --json number --jq .number)"`.
Run `gh pr checks "$pr_number"`. If CI is pending,
say so; do not claim it passed. For a failing check, inspect it with
`gh run view <run-id> --log-failed`, fix task-caused failures if safe, rerun
local checks, and push the fix. Stop and explain unrelated or blocked failures.
Never treat absent checks as passing checks.

Report the PR URL, the changes shipped, validation results, CI status, and
remaining risks or actions. Leave the PR for human review and **rebase merge**.
Do not run `gh pr merge`, turn on auto-merge, publish a release, or deploy.
