# Deploy on Render

This project deploys as one Docker web service. The service serves the customer storefront, admin interface, and API from one HTTPS origin. The Blueprint uses Render's Free compute plan and does not attach persistent storage.

## Setup

1. Push the project, including `render.yaml`, to the GitHub `main` branch.
2. Sign in to Render and create a new Blueprint from the GitHub repository.
3. Enter `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters when prompted. The store name defaults to `AutoFix`.
4. Deploy the Blueprint and wait for `/api/health` to report healthy. Payments remain disabled until Stripe is configured.
5. In Stripe, add a webhook endpoint at `https://<your-render-domain>/api/payments/stripe/webhook` and subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`.
6. In Render's service environment settings, add `STRIPE_SECRET_KEY` and the endpoint signing secret as `STRIPE_WEBHOOK_SECRET`, then redeploy. Keep secret keys in Render; never commit them to GitHub.
7. Open the Render domain to use the storefront. Sign in with the configured administrator account and set the store shipping/tax policy before accepting orders.

This Free deployment is for preview/testing only. Render's free filesystem is ephemeral, so SQLite products, users, and orders can be lost whenever the service restarts, sleeps, or redeploys. Do not accept real orders until you upgrade to a paid service and attach a persistent disk, or migrate the database to persistent managed storage.

Render supplies `RENDER_EXTERNAL_URL`; the app uses it for Stripe success and cancellation redirects when `PUBLIC_BASE_URL` is not set.