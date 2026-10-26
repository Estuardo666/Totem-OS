# Production deployment

- Publish the web application through a reviewed PR based on current `origin/main`; merge it to let Vercel deploy the exact merged commit.
- Before publishing, compare the candidate against both current `origin/main` and the deployment currently assigned to `totem-os.vercel.app`. Reconcile any production-only fixes first.
- Do not deploy an old checkout or bundle directly with `vercel --prod`. A dirty checkout based on `e288fb4` replaced newer modal, permissions, and content fixes on 2026-10-26.
- Confirm the production deployment metadata matches the merged GitHub SHA. A successful build alone does not prove that current changes were preserved.
- Keep application clients and tasks on the application datasource; retain the isolated SRI ledger and its environment restrictions.

# Validation

- `npm run typecheck`
- `npm run test:unit` (install root and worker dependencies first)
- `node --test tests/browser/transaction-modal.test.mjs` (use `PLAYWRIGHT_CHANNEL=chrome` when using installed Chrome)
