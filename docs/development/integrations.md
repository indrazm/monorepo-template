# Integrations — how to connect

Tacto ingests events through the public ingestion API. There are three ways in:

1. **Server API** — `POST /ingest/v1/event` with `Authorization: Bearer <site api key>`.
2. **Custom webhook** — `POST /ingest/v1/webhook/webhook?site=<siteKey>` signed with the
   generated secret (header `x-tacto-signature` = hex HMAC-SHA256 of the raw body).
3. **Provider webhooks** — provider-specific endpoints
   `POST /ingest/v1/webhook/<provider>?site=<siteKey>`.

Each provider is connected one of two ways (visible in the dashboard next to the
provider):

- **Direct** — the provider signs its webhook itself; you paste its signing
  secret in the dashboard and we verify the provider's native signature header.
- **Via Zapier / Make** — the provider has no inbound webhook we can verify, so
  you forward the event through Zapier / Make (or your own server) and sign it
  with the generated secret (`x-tacto-signature`). This is how the large long
  tail of tools connects without a bespoke connector each.

> Rule of thumb: don't chase a native connector for every tool. **Custom
> webhook + Zapier/Make** covers most needs; native connectors exist only where
> the provider's signature is well-defined and stable.

## Direct providers

| Provider       | Signature header we verify                             | Secret source                                   |
| -------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Stripe         | `Stripe-Signature` (`t` + `v1`, hex HMAC)              | Dashboard → Webhooks signing secret (`whsec_…`) |
| Shopify        | `X-Shopify-Hmac-Sha256` (base64 HMAC)                  | App webhook signing secret                      |
| WooCommerce    | `X-WC-Webhook-Signature` (base64 HMAC)                 | Webhook "Secret" field                          |
| BigCommerce    | `X-BC-Signature` (hex HMAC)                            | Webhook client secret                           |
| Wix            | `X-Wix-Signature` (base64 HMAC)                        | Webhook signing secret                          |
| Ecwid          | `X-Ecwid-Webhook-Signature` (base64 HMAC)              | Webhook secret                                  |
| Paddle         | `Paddle-Signature` (`ts` + `h1`, hex HMAC)             | Notification destination secret                 |
| Lemon Squeezy  | `X-Signature` (hex HMAC)                               | Webhook signing secret                          |
| Recharge       | `X-Recharge-Hmac-Sha256` (base64 HMAC)                 | Webhook secret                                  |
| HubSpot        | `X-HubSpot-Signature` (hex SHA256 of secret+body)      | App client secret                               |
| Typeform       | `Typeform-Signature` (`sha256=` + base64 HMAC)         | Webhook secret                                  |
| Calendly       | `Calendly-Webhook-Signature` (`t` + `v1`, base64 HMAC) | Webhook signing key                             |
| Kajabi         | `X-Kajabi-Hmac-SHA256` (base64 HMAC)                   | Webhook secret                                  |
| Thinkific      | `X-Thinkific-Hmac-Sha256` (base64 HMAC)                | Webhook secret                                  |
| Memberful      | `X-Memberful-Webhook-Signature` (base64 HMAC)          | Webhook secret                                  |
| Custom webhook | `x-tacto-signature` (hex HMAC of body)                 | Generated in the dashboard                      |

Steps for a direct provider:

1. In the provider's webhook settings, create an endpoint pointing to the
   dashboard's webhook URL for that provider.
2. Copy the provider's signing secret into the "Connect" box (for the custom
   webhook, we generate the secret for you).
3. Subscribe to the events you want to show (orders, purchases, signups, forms…).
4. Optionally add a **data filter** (JSON path + value) to only accept some events.

## Via Zapier / Make (long tail)

Email, marketing, CRM, helpdesk, spreadsheets and accounting tools
(ConvertKit, Mailchimp, ActiveCampaign, WordPress, Webflow, Salesforce,
Pipedrive, Zoho, Airtable, Google Sheets, Intercom, Crisp, Drift, Tawk.to,
LiveChat, QuickBooks, Xero, Squarespace, PrestaShop, Magento, Gumroad, SendOwl,
Jotform, Formspree, Teachable, Circle, Zapier, Make):

1. Create a Zap/Scenario with the tool as the trigger.
2. Add a **Webhooks → POST** action to the dashboard webhook URL.
3. Set `x-tacto-signature` = hex `HMAC-SHA256(rawBody, generatedSecret)`.
4. Send a JSON body with `name`, `city`, `product`, `dedupeKey`, `occurredAt`
   (see the "custom webhook" body shape).

## Event body (custom webhook / Zapier / Make)

```json
{
  "type": "purchase",
  "name": "Mike Jones",
  "city": "London",
  "product": "Nike Air",
  "dedupeKey": "order-1234",
  "occurredAt": "2026-10-14T10:00:00.000Z"
}
```

`type` is one of `purchase`, `signup`, `visit`, `form_submit`, `custom`,
`review`. Only a first name + city are stored for display (GDPR).

## Notes / limitations

- Signature verification is best-effort per provider; if a provider changes its
  scheme, prefer the **custom webhook / Zapier** path.
- Events from provider webhooks are marked **verified** (trusted source).
- Google Sheets/Airtable have no outbound webhook of their own — they must be
  driven by an automation tool or a script that signs and posts the body.
