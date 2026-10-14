import { describe, expect, it } from "vitest";
import { parseBillingEvent } from "./stripe";

describe("parseBillingEvent", () => {
  it("captures the organization id, plan and customer id from checkout", () => {
    const update = parseBillingEvent({
      type: "checkout.session.completed",
      data: {
        object: { customer: "cus_abc", metadata: { organizationId: "org-1", plan: "growth" } },
      },
    });
    expect(update).toMatchObject({
      organizationId: "org-1",
      plan: "growth",
      status: "active",
      customerId: "cus_abc",
    });
  });

  it("reads an expanded customer object and downgrades on deletion", () => {
    const deleted = parseBillingEvent({
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: { id: "cus_xyz" },
          metadata: { organizationId: "org-2" },
        },
      },
    });
    expect(deleted).toMatchObject({
      organizationId: "org-2",
      plan: "free",
      status: "canceled",
      customerId: "cus_xyz",
    });
  });

  it("ignores events without an organization id", () => {
    expect(
      parseBillingEvent({ type: "checkout.session.completed", data: { object: {} } }),
    ).toBeNull();
  });
});
