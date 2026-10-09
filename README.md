# AutoFixAI
https://autofixai-store-ld50.onrender.com
## Run with Docker Desktop

Copy `.env.example` to `.env` once, then set a random `SESSION_SECRET`, your Stripe secret key, Stripe webhook secret, and a private admin email/password (at least 12 characters). Keep `.env` private; never send these keys in chat or commit the file.

For local Stripe testing, use a Stripe test secret key and run Stripe CLI in a second terminal:

```powershell
stripe listen --forward-to localhost:8123/api/payments/stripe/webhook
```

Copy the CLI's `whsec_...` value into `STRIPE_WEBHOOK_SECRET` in `.env`, then start the app from PowerShell:

```powershell
docker compose up --build -d
```

Open <http://localhost:8123/>. The web container proxies `/api/*` to the API service. Check startup with `docker compose ps` and `docker compose logs -f api`.

The store-admin account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` at API startup; the public signup form cannot claim that email. The configured password is reset to the `.env` value at each startup. Store defaults are free shipping and prices include tax, matching the current owner selection; they can be changed in **จัดการร้าน**. Enter real product prices and available quantities or create products before selling. New/migrated products start at zero stock. Admin can advance paid orders through preparation, shipped, and completed.

For live payments, use Stripe live keys, set `PUBLIC_BASE_URL` to the public HTTPS site, configure the Stripe webhook endpoint as `https://your-domain/api/payments/stripe/webhook`, and put its signing secret in `.env`. Both Stripe keys are mandatory before checkout is enabled. Restart with `docker compose up --build -d` after changing environment values. Stripe enables payment methods according to the merchant account and Dashboard configuration.

## Run without Docker

Install Node.js 20 or newer, then run:

```powershell
npm install
$env:PORT = '8123'
npm start
```

Open <http://localhost:8123/>. The server creates and seeds `data/autofix.db` on first start. Run `npm run check` for JavaScript syntax checks and `npm test` for database/API integration tests.

The seeded demo account is `demo@autofix.com` with password `AutoFix123!` and has customer permissions. The store admin is a separate account initialized from `.env`. Change or remove the demo credentials before deploying publicly.

## What is connected

Products, accounts, garage vehicles, orders, inventory, and maintenance records are persisted in SQLite. Authenticated endpoints use signed bearer tokens. Checkout reserves stock transactionally, calculates totals from database prices, and creates a Stripe Checkout Session. Only a signature-verified Stripe webhook marks an order paid; expired or cancelled sessions release reserved stock. Admin inventory and fulfillment endpoints require the admin role.

Stripe keys and saved store policy are required for checkout. The backend calculates item prices and the configured shipping fee; it does not calculate tax separately. The admin must choose whether tax is already included in listed prices or not applicable, according to the shop's actual tax obligations. The application records shipping addresses and fulfillment status but does not create shipping labels, integrate a carrier, or process refunds. Orders created before this payment integration are marked `legacy_unverified` and must not be treated as paid.

The symptom helper is rule-based demo logic. Image identification returns sample brake-part matches and is not a real vision model. Shipping fulfillment remains manual after the admin marks the paid order as shipped.
