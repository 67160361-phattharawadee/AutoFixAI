# Deploy on Render

This project deploys as one Docker web service. The service serves the customer storefront, admin interface, and API from one HTTPS origin. SQLite data is stored on a persistent disk mounted at `/app/data`.

## Setup

1. Push the project, including `render.yaml`, to the GitHub `main` branch.
2. Sign in to Render and create a new Blueprint from the GitHub repository.
3. Enter `ADMIN_EMAIL`, a unique `ADMIN_PASSWORD` of at least 12 characters, and `STORE_NAME` when prompted.
4. Enter Stripe test keys first. Keep secret keys in Render's environment settings; never commit them to GitHub.
5. Deploy the Blueprint and wait for `/api/health` to report healthy.
6. In Stripe, add a webhook endpoint at `https://<your-render-domain>/api/payments/stripe/webhook` and subscribe to `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, and `checkout.session.async_payment_failed`. Copy the endpoint signing secret to `STRIPE_WEBHOOK_SECRET` in Render and redeploy.
7. Open the Render domain to use the storefront. Sign in with the configured administrator account and set the store shipping/tax policy before accepting orders.

The Blueprint uses a paid Render web-service plan because SQLite needs a persistent disk. The persistent disk is required to retain products, users, and orders across deploys and restarts. Confirm current Render pricing before creating the service.

Render supplies `RENDER_EXTERNAL_URL`; the app uses it for Stripe success and cancellation redirects when `PUBLIC_BASE_URL` is not set.