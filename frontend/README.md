# Biodata frontend

Next.js 16 (App Router, TypeScript strict, Tailwind CSS v4) UI for the biodata
service. The browser never talks to the FastAPI backend directly — every call
goes through this app's own route handlers under `/api/*`.

## Environment

| variable      | scope       | default                 | notes                                          |
| ------------- | ----------- | ----------------------- | ---------------------------------------------- |
| `BACKEND_URL` | server only | `http://localhost:8000` | e.g. `http://backend:8000` under Docker Compose |

`BACKEND_URL` is read at request time inside the route handlers, so it is never
inlined into the client bundle and the production build succeeds without it.

## Scripts

```bash
npm ci            # install from the lockfile
npm run dev       # dev server on :3000
npm run lint      # eslint
npm run typecheck # tsc --noEmit
npm run build     # production build (works with BACKEND_URL unset)
npm test          # vitest
npm start         # serve the production build on :3000
```

## Layout

```
src/app/page.tsx                     single-page biodata intake + recent submissions
src/app/api/bio-records/route.ts     POST/GET proxies to the backend (force-dynamic)
src/components/bio-form.tsx          the form, live age/BMI, submit + error handling
src/components/recent-submissions.tsx paged list (limit 20) fed by the GET proxy
src/lib/schema.ts                    zod schema mirroring the contract's constraints
src/lib/bio.ts                       domain constants + age/BMI helpers
src/lib/api-errors.ts                maps backend 409/422/502 onto UI + field errors
src/lib/countries.ts                 generated ISO-3166 alpha-2 list
```

## Idempotency

The form generates one `crypto.randomUUID()` key per fill and keeps it in a ref.
The same key is reused for every attempt at the same fill — double clicks,
validation retries after a 422, and retries after a network error — so the
backend can collapse duplicates. The key is only rotated after a successful save
clears the form (or when the user hits **Clear**). A backend `200` means the
record already existed and is reported as "already recorded", a `409` means the
key was reused with different data and asks the user to start a fresh fill.
