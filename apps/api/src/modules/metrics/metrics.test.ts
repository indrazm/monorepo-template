import { describe, expect, it } from "vitest";
import { recordRequest, renderMetrics, renderQueueMetrics } from "./metrics";

describe("metrics registry", () => {
  it("renders request counters, duration summaries, process and queue gauges", () => {
    recordRequest("GET", "/api/v1/sites", 200, 0.05);
    const text = renderMetrics(renderQueueMetrics({ webhook: { waiting: 2, failed: 1 } }));

    expect(text).toContain("# TYPE tacto_process_uptime_seconds gauge");
    expect(text).toContain(
      'tacto_http_requests_total{method="GET",route="/api/v1/sites",status="200"} 1',
    );
    expect(text).toContain(
      'tacto_http_request_duration_seconds_count{method="GET",route="/api/v1/sites"} 1',
    );
    expect(text).toContain(
      'tacto_http_request_duration_seconds_sum{method="GET",route="/api/v1/sites"} 0.05',
    );
    expect(text).toContain('tacto_queue_jobs{queue="webhook",state="waiting"} 2');
    expect(text).toContain('tacto_queue_jobs{queue="webhook",state="failed"} 1');
  });
});
