import { Button } from "@repo/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon } from "lucide-react";
import { useState } from "react";
import { notificationsQueryOptions } from "../../notifications/hooks/use-notifications";

// ---------------------------------------------------------------------------
// Manual loop order (FR-NGS-02). The payload endpoint already honours
// `loop.manualOrder`; this is the only place it can be filled. Drag to reorder,
// or use the arrow buttons (keyboard-accessible, same effect).
// ---------------------------------------------------------------------------

export function ManualOrderEditor({
  siteId,
  value,
  onChange,
}: {
  siteId: string;
  value: string[];
  onChange: (order: string[]) => void;
}) {
  const notifications = useQuery(notificationsQueryOptions(siteId));
  const [dragging, setDragging] = useState<string | null>(null);

  const rows = notifications.data ?? [];
  if (notifications.isLoading) {
    return <p className="text-xs text-muted-foreground">Loading notifications…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No notifications on this site yet — create one first.
      </p>
    );
  }

  // Saved order first (in its stored sequence), then anything created since.
  const known = new Map(rows.map((row) => [row.id, row]));
  const ordered = [
    ...value.map((id) => known.get(id)).filter((row): row is NonNullable<typeof row> => !!row),
    ...rows.filter((row) => !value.includes(row.id)),
  ];

  function move(from: number, to: number) {
    if (to < 0 || to >= ordered.length) return;
    const ids = ordered.map((row) => row.id);
    const [moved] = ids.splice(from, 1);
    if (!moved) return;
    ids.splice(to, 0, moved);
    onChange(ids);
  }

  return (
    <ul className="grid gap-1">
      {ordered.map((row, index) => (
        <li
          key={row.id}
          draggable
          onDragStart={() => setDragging(row.id)}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragging || dragging === row.id) return;
            const from = ordered.findIndex((entry) => entry.id === dragging);
            if (from !== -1) move(from, index);
          }}
          className={`flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-sm ${
            dragging === row.id ? "opacity-50" : ""
          }`}
        >
          <GripVerticalIcon className="size-4 shrink-0 cursor-grab text-muted-foreground" />
          <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
          {row.isActive ? null : (
            <span className="shrink-0 text-xs text-muted-foreground">paused</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${row.name} up`}
            disabled={index === 0}
            onClick={() => move(index, index - 1)}
          >
            <ChevronUpIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Move ${row.name} down`}
            disabled={index === ordered.length - 1}
            onClick={() => move(index, index + 1)}
          >
            <ChevronDownIcon className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
