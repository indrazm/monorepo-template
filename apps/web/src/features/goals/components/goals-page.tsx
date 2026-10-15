import type { CreateGoalInput, Goal, GoalRule } from "@repo/contracts/goals";
import { eventTypes } from "@repo/contracts/notifications";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { ChevronDownIcon, PlusIcon, TargetIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AppShell } from "../../app-shell/app-shell";
import { sitesQueryOptions } from "../../sites/hooks/use-sites";
import { createGoal, deleteGoal, getGoalStats, listGoals } from "../services";

const selectClass =
  "border-input bg-background focus-visible:ring-ring h-10 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

function goalsQuery(siteId: string) {
  return queryOptions({
    queryKey: ["goals", siteId],
    queryFn: () => listGoals(siteId),
    enabled: siteId.length > 0,
  });
}

function goalStatsQuery(id: string) {
  return queryOptions({
    queryKey: ["goal-stats", id],
    queryFn: () => getGoalStats(id),
  });
}

function describeRule(rule: GoalRule): string {
  if (rule.type === "event") return `When a "${rule.eventType}" event arrives`;
  return `URL ${rule.url.mode}${rule.url.value ? `: ${rule.url.value}` : ""}`;
}

export function GoalsPage() {
  const sites = useQuery(sitesQueryOptions);
  const [siteId, setSiteId] = useState("");
  const activeSiteId = siteId || sites.data?.[0]?.id || "";
  const goals = useQuery(goalsQuery(activeSiteId));

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Goals</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              Track conversions from a URL (a thank-you page) or an event (purchase, signup) to
              measure the impact of your notifications.
            </p>
          </div>
          {activeSiteId ? <CreateGoalDialog siteId={activeSiteId} /> : null}
        </div>

        {sites.data && sites.data.length > 0 ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="g-site" className="text-sm text-muted-foreground">
              Site
            </Label>
            <select
              id="g-site"
              className={selectClass}
              value={activeSiteId}
              onChange={(e) => setSiteId(e.target.value)}
            >
              {sites.data.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Create a site first to define goals.
            </CardContent>
          </Card>
        )}

        {activeSiteId && goals.data ? (
          goals.data.length > 0 ? (
            <div className="grid gap-3">
              {goals.data.map((goal) => (
                <GoalCard key={goal.id} goal={goal} siteId={activeSiteId} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <TargetIcon className="size-6" />
                </span>
                <p className="text-sm text-muted-foreground">
                  No goals yet — add one to start measuring conversions.
                </p>
                <CreateGoalDialog siteId={activeSiteId} />
              </CardContent>
            </Card>
          )
        ) : null}
      </section>
    </AppShell>
  );
}

function GoalCard({ goal, siteId }: { goal: Goal; siteId: string }) {
  const [open, setOpen] = useState(false);
  const stats = useQuery({ ...goalStatsQuery(goal.id), enabled: open });
  const maxDaily = Math.max(1, ...(stats.data?.daily.map((d) => d.conversions) ?? [1]));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{goal.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{describeRule(goal.rule)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="tabular-nums">{goal.conversions.toLocaleString()} conv.</Badge>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            <ChevronDownIcon
              className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
            Details
          </Button>
          <DeleteGoalButton id={goal.id} siteId={siteId} />
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="grid gap-5 border-t pt-4">
          <div>
            <p className="text-sm font-semibold">Last 30 days</p>
            <div className="mt-2 flex h-24 items-end gap-1">
              {(stats.data?.daily ?? []).map((day) => (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.conversions}`}
                  className="flex-1 rounded-t bg-primary/70"
                  style={{ height: `${Math.round((day.conversions / maxDaily) * 100)}%` }}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Assisted by notification</p>
            <p className="text-xs text-muted-foreground">
              Conversions preceded by a view of the notification within 30 minutes.
            </p>
            {stats.data && stats.data.attribution.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-sm">
                {stats.data.attribution.map((row) => (
                  <li key={row.notificationId} className="flex items-center justify-between">
                    <span className="truncate">{row.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {row.conversions.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No assisted conversions yet.</p>
            )}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function CreateGoalDialog({ siteId }: { siteId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState<"url" | "event">("url");
  const [eventType, setEventType] = useState<(typeof eventTypes)[number]>("purchase");
  const [mode, setMode] = useState<"all" | "simple" | "contains" | "regex">("contains");
  const [value, setValue] = useState("");

  const create = useMutation({
    mutationFn: (input: CreateGoalInput) => createGoal(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals", siteId] });
      toast.success("Goal created");
      setName("");
      setValue("");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate({
      siteId,
      name: name.trim(),
      rule:
        ruleType === "event"
          ? { type: "event", eventType }
          : { type: "url", url: { mode, value: mode === "all" ? undefined : value.trim() } },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-fit">
          <PlusIcon className="size-4" /> New goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>New conversion goal</DialogTitle>
            <DialogDescription>
              Count visitors who reach a matching URL, or events of a given type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="goal-name">Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Checkout complete"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="goal-rule-type">Trigger</Label>
            <select
              id="goal-rule-type"
              className={selectClass}
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as "url" | "event")}
            >
              <option value="url">URL reached</option>
              <option value="event">Event received</option>
            </select>
          </div>
          {ruleType === "event" ? (
            <div className="grid gap-2">
              <Label htmlFor="goal-event">Event type</Label>
              <select
                id="goal-event"
                className={selectClass}
                value={eventType}
                onChange={(e) => setEventType(e.target.value as (typeof eventTypes)[number])}
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="grid gap-2">
                <Label htmlFor="goal-mode">URL match</Label>
                <select
                  id="goal-mode"
                  className={selectClass}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="all">All pages</option>
                  <option value="simple">Exact path</option>
                  <option value="contains">Path contains</option>
                  <option value="regex">Regex</option>
                </select>
              </div>
              {mode !== "all" ? (
                <div className="grid gap-2">
                  <Label htmlFor="goal-value">Value</Label>
                  <Input
                    id="goal-value"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="/thank-you"
                    required
                  />
                </div>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGoalButton({ id, siteId }: { id: string; siteId: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteGoal(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["goals", siteId] });
      toast.success("Goal deleted");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      disabled={remove.isPending}
      onClick={() => remove.mutate()}
    >
      Delete
    </Button>
  );
}
