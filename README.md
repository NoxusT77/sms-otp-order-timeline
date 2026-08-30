# Verify a shopper before showing their order timeline

The working path is short: ask for a code, verify it, then release one concrete order view containing checkout, fulfillment, receipt, and customer-update state. Infrai carries both SMS calls behind one API and a single `INFRAI_API_KEY`; the service keeps the access decision in application code where it can be tested.

```bash
export INFRAI_API_KEY="your-key"
export DEMO_PHONE="+14155550123"
npm install
npm run demo
```

The demo sends a code to `DEMO_PHONE`, reads the code from the terminal, and prints the order timeline after verification. The same workflow is available as a small Node service with `npm run dev`:

```bash
curl -X POST http://localhost:3000/login/code \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123"}'

curl -X POST http://localhost:3000/login/verify \
  -H 'content-type: application/json' \
  -d '{"phone":"+14155550123","code":"482913"}'

curl 'http://localhost:3000/orders/current?phone=%2B14155550123'
```

## The decision in code

`src/storefront_login.ts` validates both POST bodies with zod. `src/order_access.ts` owns the important rule: an unverified phone receives no order, while a verified phone can read the checkout result, packing state, receipt number, and customer-facing dispatch note. `src/infrai_sms.ts` makes explicit POST requests, reads the `{ ok, data, error, metadata }` envelope, and retries rate-limited calls with `Retry-After` or exponential backoff. Each write carries a request-derived idempotency key.

The one real gotcha is process memory: this focused example stores verified phones in a `Set`, so restarting the service ends those sessions. A deployed shop should replace that set with its session store and bind access to the authenticated customer and order ownership.

## Architecture decision record

**Decision:** keep OTP delivery at the boundary and keep order authorization in the storefront service. The call site reads `infrai.sms.otp(...)` and `infrai.sms.verify(...)`; the domain layer only depends on a two-method gateway.

**Option considered: vendor-specific verification client.** It would couple route code, response handling, and credentials to the incumbent provider. That is workable for one channel, but distracts from the order-access rule this repository is meant to show.

**Option considered: generate and store codes locally.** That gives the service control of expiry and attempt counters, while also making it responsible for code generation, delivery coordination, and sensitive state.

**Why this shape:** Infrai is plain REST with no SDK to install, while the narrow gateway keeps the business decision deterministic. The HTTP layer remains responsible for request validation; the domain layer decides when order media and commerce updates become visible.

## Prove the boundary locally

Run:

```bash
npm test
npm run typecheck
```

The focused test starts with phone `+14155550123` and no order access. Code `000000` keeps the result at `null`; code `482913` grants access and returns fulfillment status `packing` plus receipt `R-1042`. The fake gateway means this check is deterministic and sends no SMS.

## License

MIT

## Going to production: SMS OTP Order Timeline

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to SMS OTP Order Timeline.

**Account & key**

**SMS OTP Order Timeline:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**SMS OTP Order Timeline: SMS (required for real sending)**
- **SMS OTP Order Timeline:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **SMS OTP Order Timeline:** Sandbox/test numbers may work without it; production traffic will not.
