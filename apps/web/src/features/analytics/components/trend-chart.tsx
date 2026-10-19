import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/ui/components/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "@repo/ui/components/recharts";

export type TrendPoint = { date: string; views: number; clicks: number; claims: number };

// Categorical palette validated for both themes by the dataviz skill
// (blue / orange / aqua). Colors carry series identity; the legend + tooltip
// provide the non-color relief the validator asks for.
const chartConfig = {
  views: { label: "Impressions", theme: { light: "#2a78d6", dark: "#3987e5" } },
  clicks: { label: "Clicks", theme: { light: "#eb6834", dark: "#d95926" } },
  claims: { label: "Rewards", theme: { light: "#1baf7a", dark: "#199e70" } },
} satisfies ChartConfig;

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Change-over-time trend for impressions/clicks/rewards (FR-ANL-02). One shared
// count axis (never dual-axis); thin 2px lines; crosshair tooltip + legend.
export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No activity in this range yet.
      </p>
    );
  }
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={shortDate}
        />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(label) => shortDate(String(label))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="views"
          type="monotone"
          stroke="var(--color-views)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="clicks"
          type="monotone"
          stroke="var(--color-clicks)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          dataKey="claims"
          type="monotone"
          stroke="var(--color-claims)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
