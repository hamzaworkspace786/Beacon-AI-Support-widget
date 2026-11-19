# Beacon

An AI support chat that a business adds to its website with one line of code. It answers
visitors from the business's own documents, shows where each answer came from, and says so
when it doesn't know.

This is a portfolio project, built phase by phase. **Phases 1 and 2 are built.** The chat
itself arrives in Phase 3.

## The plan

| Phase | What gets built | Status |
| --- | --- | --- |
| 1 | Sign-in, creating and editing bots, dashboard, settings with live preview | Done |
| 2 | Knowledge base: upload PDF/Word/text or paste text, extract, chunk and embed it per bot | Built, run `PHASE2-CHECKLIST.md` |
| 3 | Chat API: retrieval limited to one bot, grounded answers with sources, streaming, an "I don't know" rule, rate limits and a cost cap, and a playground in the dashboard | Next |
| 4 | The embeddable widget: one script tag, an isolated chat window, allowed-websites check, a demo store page | |
| 5 | Dashboard insights: conversations, unanswered questions, lead capture | |
| 6 | Tool calling (an order-lookup tool), prompt-injection tests, a small answer-quality test set | |
| 7 | Polish: README with architecture diagram, tests, load test, deploy to Vercel, demo video | |

## Stack

Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, MongoDB,
Better Auth (email and Google), Vercel AI SDK with Google Gemini.

## Run it

1. Install packages: `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (the file explains each value).
3. Start it: `npm run dev`, then open http://localhost:3000
4. Checks: `npm test`, `npm run lint`, `npm run build`

Then follow the phase checklists (`PHASE1-CHECKLIST.md`, `PHASE2-CHECKLIST.md`).

## How Phase 1 is built

- Every bot belongs to one account. Each database query filters by the signed-in user's id,
  so one account can never read or change another's bots.
- Everything the browser sends is validated on the server with Zod, including the list of
  allowed websites, which is cleaned to bare host names.
- Each bot has a public ID (`bot_...`) made of 80 random bits. It is safe to put in a
  website's embed code because it grants no access to the dashboard.
- Sign-in attempts are rate limited per IP address, with the counters stored in the database
  so they work across Vercel's many server instances.

## How Phase 2 is built

A source (an uploaded file or pasted text) goes through these steps:

1. **Check.** The file's real content is checked, not just its name: PDFs must start with
   `%PDF-`, Word files must be real zip packages, text must be UTF-8 without binary bytes.
   Size, page and character limits apply.
2. **Read.** PDFs are read page by page (`unpdf`), Word files with `mammoth`. Word, text and
   pasted content have no real pages, so they are cut into pages of about 3,000 characters,
   which gives every passage a page number to cite later.
3. **Chunk.** Pages are split into overlapping passages of about 800 characters. Passages
   break at sentence boundaries and never cross a page.
4. **Limits.** A bot holds at most 10 sources and 1,500 passages, and each person and the
   whole site have a daily allowance. Phase 3 compares every question against all of a bot's
   passages, so the passage cap keeps answers fast without needing a vector database.
5. **Embed in the background.** The source is saved straight away as "Preparing" and the
   response is sent. After that, the passages are turned into 768-number vectors with
   `gemini-embedding-001`, in batches, with waiting and retries for rate limits and short
   outages. When done, the source becomes "Ready", or "Failed" with a message that is safe to
   show. A source that never finishes is marked failed after 10 minutes.
6. **Isolation.** Every source and passage carries the owner's user id and the bot id, and
   every query filters by the user. Deleting a bot deletes everything it knows.
