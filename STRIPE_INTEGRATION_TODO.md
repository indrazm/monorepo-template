# Stripe Integration — TODO

Hosted Stripe Checkout integration (redirect to a Stripe-hosted payment page).

Scenario: **A** — an existing Checkout Session API call was found and updated in
place. It lives in [`apps/api/src/modules/billing/stripe.ts`](apps/api/src/modules/billing/stripe.ts)
(`createCheckoutSession`), called by `POST /api/v1/billing/checkout`.

---

## Values to Replace

The following values are placeholders and must be updated before going live.

In this repository the `sample_only` values are already real (not `price_...`
placeholders), so **nothing is a hard placeholder** — but review the production
values below.

**Files containing these values:**

- [apps/api/src/modules/billing/stripe.ts](apps/api/src/modules/billing/stripe.ts)

| Field               | Current Value                                                                | What to Set                                                                                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| mode                | `subscription`                                                               | Keep `"subscription"` (recurring plans) or switch to `"payment"` for one-time charges.                                                                                                                         |
| success_url         | `${CLIENT_ORIGINS[0]}/billing?checkout=success`                              | Your real post-payment page. Set `CLIENT_ORIGINS` to your production origin; keep the `?checkout=success` marker.                                                                                              |
| cancel_url          | `${CLIENT_ORIGINS[0]}/billing?checkout=cancel`                               | Your real cancel/return page (same note as above).                                                                                                                                                             |
| line_items[0].price | `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_AGENCY` (env) | Set each env var to the recurring **Price ID** (`price_...`) of the matching plan from https://dashboard.stripe.com/prices. Checkout now references these Prices, so the amount matches the Dashboard exactly. |

> `success_url` / `cancel_url` are derived from `CLIENT_ORIGINS[0]`, so in
> production set `CLIENT_ORIGINS` to your public app origin.

---

## Configured Parameters

These parameters were configured in Checkout Studio and are already set correctly.

**Files containing these parameters:**

- [apps/api/src/modules/billing/stripe.ts](apps/api/src/modules/billing/stripe.ts)

| Parameter                  | Value                                                   |
| -------------------------- | ------------------------------------------------------- |
| ui_mode                    | hosted_page                                             |
| billing_address_collection | auto                                                    |
| phone_number_collection    | { enabled: false }                                      |
| automatic_tax              | { enabled: false }                                      |
| allow_promotion_codes      | false                                                   |
| payment_method_collection  | always (included only because `mode` is `subscription`) |
| submit_type                | auto                                                    |
| integration_identifier     | hosted_web_0001                                         |
| origin_context             | web                                                     |

> **Verified (test mode):** a live `checkout.sessions.create` call was run
> against the configured test key with all of the parameters above — Stripe
> accepted it and returned a hosted checkout URL (`CHECKOUT_OK`). So
> `ui_mode=hosted_page`, `integration_identifier` and `origin_context` are
> accepted by the account's current API version. If you later pin an older API
> version and Stripe rejects `ui_mode`, fall back to `hosted` in
> `apps/api/src/modules/billing/stripe.ts`.

> **Retained (not Checkout Studio parameters):** `metadata[*]` and
> `subscription_data[metadata][*]` are kept on purpose — the webhook
> (`parseBillingEvent`) reads `metadata.organizationId` / `metadata.plan` to map
> the Stripe subscription to the Tacto organization. Removing them would break
> plan activation.

---

## Setup and next steps

### Environment variables

Server-only (no `VITE_` prefix) — already referenced in `apps/api/src/config.ts`:

```sh
STRIPE_SECRET_KEY=sk_test_...      # https://dashboard.stripe.com/test/apikeys
STRIPE_WEBHOOK_SECRET=whsec_...    # https://dashboard.stripe.com/workbench/webhooks
STRIPE_PRICE_STARTER=price_...     # recurring Price ID for the Starter plan
STRIPE_PRICE_GROWTH=price_...      # recurring Price ID for the Growth plan
STRIPE_PRICE_AGENCY=price_...      # recurring Price ID for the Agency plan
```

> Prices now come from the Stripe Dashboard via these Price IDs, so the
> Checkout amount always matches your Stripe products. If a plan's Price ID is
> missing, `POST /api/v1/billing/checkout` returns `integration_unconfigured`.

No publishable key is needed because checkout is a **hosted redirect** (the
browser is sent to Stripe, not embedded). If you later switch to embedded
checkout, add `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` for the web app.

### Endpoints (already present, unchanged)

| Method | Path                       | Purpose                                                              |
| ------ | -------------------------- | -------------------------------------------------------------------- |
| POST   | `/api/v1/billing/checkout` | Auth'd — creates the Checkout Session, returns `{ url }`.            |
| POST   | `/api/v1/billing/portal`   | Auth'd — opens the Stripe Billing Portal (upgrade/downgrade/cancel). |
| POST   | `/api/v1/billing/webhook`  | Public — verifies the Stripe signature, applies plan changes.        |

Point your Stripe webhook endpoint at:
`https://<your-api-host>/api/v1/billing/webhook` and subscribe to
`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`.

### How the integration works

1. The dashboard calls `POST /api/v1/billing/checkout` with the chosen plan.
2. The API creates a hosted Checkout Session and returns its `url`.
3. The browser redirects to Stripe, the customer pays, and Stripe redirects back
   to `success_url`.
4. Stripe calls the webhook; Tacto verifies the signature and updates the org's
   subscription (`plan`, `status`, `externalCustomerId`, `renews_at`).
5. `externalCustomerId` enables the Billing Portal for self-serve changes.

### Test cards & modes

Use test-mode keys. Example cards:

- Success: `4242 4242 4242 4242`
- Requires authentication: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

Any future expiry, any 3-digit CVC, any postal code. Use the Stripe CLI to
forward webhooks locally: `stripe listen --forward-to localhost:8000/api/v1/billing/webhook`.

### Next steps

- Replace inline `price_data` with Stripe Price IDs if you manage products in
  Stripe (optional).
- Configure the Billing Portal in the Stripe Dashboard (allowed actions:
  update/cancel plan, update payment method).
- Add fulfillment/order tracking only if you introduce one-time products.

### Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
