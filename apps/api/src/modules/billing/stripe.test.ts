import { afterEach, describe, expect, it, vi } from "vitest";
import { createBillingPortalSession, createCheckoutSession, parseBillingEvent } from "./stripe";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("maps a Portal plan change from the subscription Price ID", () => {
    const update = parseBillingEvent(
      {
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_abc",
            status: "active",
            cancel_at_period_end: true,
            metadata: { organizationId: "org-3", plan: "starter" },
            items: { data: [{ price: { id: "price_growth_year" } }] },
          },
        },
      },
      {
        starter: { month: "price_starter", year: null },
        growth: { month: "price_growth", year: "price_growth_year" },
        agency: { month: "price_agency", year: null },
      },
    );
    expect(update).toMatchObject({
      organizationId: "org-3",
      plan: "growth",
      status: "active",
      cancelAtPeriodEnd: true,
    });
  });

  it("ignores events without an organization id", () => {
    expect(
      parseBillingEvent({ type: "checkout.session.completed", data: { object: {} } }),
    ).toBeNull();
  });
});

describe("createCheckoutSession", () => {
  it("sends the Checkout Studio parameters and preserves the existing ones", async () => {
    let body: URLSearchParams | undefined;
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      body = new URLSearchParams(init.body);
      return new Response(JSON.stringify({ url: "https://checkout.stripe.com/c/pay/x" }), {
        status: 200,
      });
    });

    const url = await createCheckoutSession({
      secretKey: "sk_test",
      plan: "growth",
      priceId: "price_growth",
      organizationId: "org-1",
      successUrl: "https://app.example.com/billing?checkout=success",
      cancelUrl: "https://app.example.com/billing?checkout=cancel",
    });
    expect(url).toBe("https://checkout.stripe.com/c/pay/x");

    // fixed_by_ui (Checkout Studio)
    expect(body?.get("ui_mode")).toBe("hosted_page");
    expect(body?.get("billing_address_collection")).toBe("auto");
    expect(body?.get("phone_number_collection[enabled]")).toBe("false");
    expect(body?.get("automatic_tax[enabled]")).toBe("false");
    expect(body?.get("allow_promotion_codes")).toBe("false");
    expect(body?.get("submit_type")).toBe("auto");
    expect(body?.get("integration_identifier")).toBe("hosted_web_0001");
    expect(body?.get("origin_context")).toBe("web");
    // sample_only kept + app linkage kept
    expect(body?.get("mode")).toBe("subscription");
    expect(body?.get("payment_method_collection")).toBe("always");
    expect(body?.get("success_url")).toBe("https://app.example.com/billing?checkout=success");
    // Real Stripe Price ID from the Dashboard (not inline price_data).
    expect(body?.get("line_items[0][price]")).toBe("price_growth");
    expect(body?.get("line_items[0][quantity]")).toBe("1");
    expect(body?.get("metadata[organizationId]")).toBe("org-1");
  });
});

describe("createBillingPortalSession", () => {
  it("returns the portal URL", async () => {
    vi.stubGlobal("fetch", async () => {
      return new Response(JSON.stringify({ url: "https://billing.stripe.com/p/session" }), {
        status: 200,
      });
    });
    const url = await createBillingPortalSession({
      secretKey: "sk_test",
      customerId: "cus_1",
      returnUrl: "https://app.example.com/billing",
    });
    expect(url).toBe("https://billing.stripe.com/p/session");
  });

  it("throws when Stripe rejects the request", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 400 }));
    await expect(
      createBillingPortalSession({ secretKey: "sk_test", customerId: "x", returnUrl: "https://a" }),
    ).rejects.toThrow(/Stripe portal failed/);
  });
});
