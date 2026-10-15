// A tiny, dependency-free metrics registry + Prometheus exposition (NFR-OBS-01).
// The API records request counts and latency per route; process and BullMQ queue
// gauges are sampled when `/metrics` is scraped.

type Labels = Record<string, string>;
type CounterSample = { name: string; labels: Labels; value: number };
type SummarySample = { name: string; labels: Labels; count: number; sum: number };

const counters = new Map<string, CounterSample>();
const summaries = new Map<string, SummarySample>();

function escapeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function sampleKey(name: string, labels: Labels): string {
  const inner = Object.keys(labels)
    .sort()
    .map((key) => `${key}="${escapeValue(labels[key] ?? "")}"`)
    .join(",");
  return `${name}{${inner}}`;
}

export function increment(name: string, labels: Labels = {}, value = 1): void {
  const key = sampleKey(name, labels);
  const existing = counters.get(key);
  if (existing) existing.value += value;
  else counters.set(key, { name, labels, value });
}

export function observe(name: string, labels: Labels, value: number): void {
  const key = sampleKey(name, labels);
  const existing = summaries.get(key);
  if (existing) {
    existing.count += 1;
    existing.sum += value;
  } else {
    summaries.set(key, { name, labels, count: 1, sum: value });
  }
}

// Records an HTTP request: total count by method/route/status and a duration
// summary by method/route (FR-NFR-OBS-01).
export function recordRequest(
  method: string,
  route: string,
  status: number,
  durationSeconds: number,
): void {
  increment("tacto_http_requests_total", { method, route, status: String(status) });
  observe("tacto_http_request_duration_seconds", { method, route }, durationSeconds);
}

// Renders the registry plus process gauges and any caller-supplied queue lines
// in the Prometheus text exposition format.
export function renderMetrics(queueLines: string[] = []): string {
  const lines: string[] = [];

  lines.push("# TYPE tacto_process_uptime_seconds gauge");
  lines.push(`tacto_process_uptime_seconds ${process.uptime().toFixed(3)}`);
  const memory = process.memoryUsage();
  lines.push("# TYPE tacto_process_resident_memory_bytes gauge");
  lines.push(`tacto_process_resident_memory_bytes ${memory.rss}`);

  if (counters.size > 0) {
    lines.push("# TYPE tacto_http_requests_total counter");
    for (const sample of counters.values()) {
      lines.push(`${sampleKey(sample.name, sample.labels)} ${sample.value}`);
    }
  }
  if (summaries.size > 0) {
    lines.push("# TYPE tacto_http_request_duration_seconds summary");
    for (const sample of summaries.values()) {
      lines.push(`${sampleKey(`${sample.name}_sum`, sample.labels)} ${sample.sum}`);
      lines.push(`${sampleKey(`${sample.name}_count`, sample.labels)} ${sample.count}`);
    }
  }

  lines.push(...queueLines);
  return `${lines.join("\n")}\n`;
}

// Formats BullMQ queue depths as `tacto_queue_jobs{queue,state}` gauges.
export function renderQueueMetrics(counts: Record<string, Record<string, number>>): string[] {
  const lines: string[] = ["# TYPE tacto_queue_jobs gauge"];
  for (const [queue, states] of Object.entries(counts)) {
    for (const [state, value] of Object.entries(states)) {
      lines.push(
        `tacto_queue_jobs{queue="${escapeValue(queue)}",state="${escapeValue(state)}"} ${value}`,
      );
    }
  }
  return lines;
}
