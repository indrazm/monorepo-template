import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/components/sonner";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

export const selectClass =
  "border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none";

export function copy(value: string, label: string) {
  navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copied`))
    .catch(() => toast.error("Could not copy"));
}

export function Secret({ label, value }: { label: string; value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/60 px-3 py-1.5 text-xs">
          {shown ? value : "•".repeat(Math.min(32, value.length))}
        </code>
        <Button variant="ghost" size="icon" onClick={() => setShown((s) => !s)} aria-label="Reveal">
          {shown ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => copy(value, label)}>
          Copy
        </Button>
      </div>
    </div>
  );
}

export function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/60 px-3 py-1.5 text-xs">
          {value}
        </code>
        <Button variant="ghost" size="sm" onClick={() => copy(value, "Value")}>
          Copy
        </Button>
      </div>
    </div>
  );
}
