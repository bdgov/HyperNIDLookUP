# HyperNIDLookUP

## Project structure
- `public/` — frontend HTML, CSS, JavaScript and assets
- `api/` — Vercel serverless functions

## Run locally
1. Install Node.js and Vercel CLI.
2. Run `npm install`.
3. Run `npx vercel dev`.

## Environment variables
Add API keys and payment secrets in Vercel Project Settings → Environment Variables.
Do not put secrets in frontend files or commit `.env.local`.

## Important
Connect only to an authorized identity-verification API. Validate access, minimize
personal-data collection, protect logs, and verify payments server-side.
