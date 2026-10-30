# Fleet

A deliberately minimal, Wordle-inspired Battleship game built with Eleventy, plain CSS, vanilla JavaScript, and Supabase.

## Modes

- **Daily waters:** the same deterministic 10 × 10 solo puzzle for everyone each UTC day. Progress stays in the browser.
- **Quick multiplayer:** a 7 × 7 board with ships of length 3, 2, and 2.
- **Standard multiplayer:** a 10 × 10 board with the classic 5, 4, 3, 3, and 2 fleet.

Multiplayer rooms use anonymous Supabase Auth, Row Level Security, realtime updates, and server-validated database functions. An opponent's unhit fleet is never returned to the browser.

## Requirements

- Node.js 20 or newer
- A Supabase project with anonymous sign-ins enabled
- Docker or another compatible container runtime only if running Supabase locally

## Setup

Install dependencies:

```bash
npm install
```

Copy the public configuration template:

```bash
cp .env.example .env
```

Add the project URL and browser-safe publishable key to `.env`. Never add a secret or `service_role` key.

```dotenv
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

Authenticate and link the Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
```

Preview the pending database migration and apply it:

```bash
npx supabase db push --dry-run
npx supabase db push
```

## Development

```bash
npm start
```

Eleventy serves the site at `http://localhost:8080` by default.

Run rules tests and a production build:

```bash
npm run check
```

The static output is written to `dist/`. Configure the two public environment values in the hosting provider before building.

## Local Supabase

The checked-in `supabase/config.toml` enables local anonymous sign-ins and uses the Eleventy development URL. With a container runtime running:

```bash
npx supabase start
npx supabase db reset
npm run supabase:test
```

Stop the local stack with `npm run supabase:stop`.

## Security model

- `.env`, build output, dependencies, and local Supabase state are ignored by Git.
- The publishable key is designed for browser use; database access is controlled by grants and RLS.
- Browser clients cannot insert or alter game rows, fleets, or shots directly.
- Security-definer functions validate room access, fleets, turns, duplicate shots, hits, sunk ships, and wins.
- Invitation tokens are random, stored only as hashes, and passed in URL fragments so they are not sent in normal HTTP requests.
- Rooms expire after 24 hours for gameplay purposes. A scheduled cleanup job can be added later if storage volume warrants it.
