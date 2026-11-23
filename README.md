# Beacon

An AI support chat that a business adds to its website with one line of code. It answers
visitors from the business's own documents, shows where each answer came from, and says so
when it doesn't know.

This is a portfolio project, built phase by phase. **Phases 1 to 4 are built.** The owner's
view of conversations and unanswered questions arrives in Phase 5.

## The plan

| Phase | What gets built | Status |
| --- | --- | --- |
| 1 | Sign-in, creating and editing bots, dashboard, settings with live preview | Done |
| 2 | Knowledge base: upload PDF/Word/text or paste text, extract, chunk and embed it per bot | Done |
| 3 | Chat engine: retrieval limited to one bot, grounded answers with sources, streaming, an "I don't know" rule, rate limits and a cost cap, and a Playground in the dashboard | Done |
| 4 | The embeddable widget: one script tag, an isolated chat window, allowed-websites check, visitor sessions, an Install tab with a live preview | Built, run `PHASE4-CHECKLIST.md` |
| 5 | Dashboard insights: conversations, unanswered questions, lead capture | Next |
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

Then follow the phase checklists (`PHASE1-CHECKLIST.md`, `PHASE2-CHECKLIST.md`,
`PHASE3-CHECKLIST.md`, `PHASE4-CHECKLIST.md`).

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

## How Phase 3 is built

A question goes through these steps:

1. **Check.** The question is validated (length, shape, ends with a customer message), only
   the last few turns are kept, and the bot must belong to the signed-in person.
2. **Count.** The question counts against the person's, the bot's and the whole site's
   daily allowance before any AI is called. A single database update does the counting, so
   two requests at once can't both slip past a limit.
3. **Search.** The question (joined with the one before it, if it is a short follow-up) is
   embedded and compared with every passage of that one bot. Only passages that match at
   least `MIN_RELEVANCE` are kept, best eight at most, and the sources they come from are
   numbered 1, 2, 3 by relevance.
4. **Decline without the AI.** If nothing matches closely enough, the bot gives a fixed
   "I couldn't find that" answer without calling the language model. It costs nothing and can
   never invent an answer. These questions are saved as `no_match`, which Phase 5 turns into
   a list of what the owner should add.
5. **Ground the answer.** The prompt tells the model to use only the numbered excerpts, to
   treat them and the customer's words as data and not instructions, to stay on topic, to
   cite sources as [1], and never to invent contact details or policies. Excerpt text can't
   close its own tags.
6. **Stream with a backup.** The answer streams back word by word. If the main model fails
   or says nothing for 20 seconds, a backup model answers instead. After the first words,
   it can't switch, so a later failure ends the answer with a clear "cut off" message.
7. **Show the evidence.** Each answer carries the sources it was allowed to cite. A citation
   of any other number is dropped as made up. The Playground's "How it answered" panel
   shows the sources and their match scores, which is how the threshold is tuned.
8. **Save.** The question and answer are saved together with their sources and outcome.

Search compares vectors in memory. A bot holds at most 1,500 passages (about 4.6 MB of
vectors), so that takes a few milliseconds. Many bots at once, or much larger ones, is where
a database vector index such as Atlas Vector Search starts to pay off.

## How Phase 4 is built

A business adds one line to its website:

```html
<script src="https://YOUR-BEACON-ADDRESS/widget.js" data-bot="bot_..." async></script>
```

1. **The loader (`public/widget.js`).** About 200 lines of plain JavaScript with no
   dependencies. It first asks Beacon for the bot's look and whether it may appear on this
   website. Only if the answer is yes does it draw a round button, inside a shadow root so the
   website's CSS can't change it and it can't change the website's.
2. **The chat window (`/embed/<bot id>`).** Clicking the button opens an iframe served by
   Beacon. The chat's code and styles never run inside the customer's page. The window tells
   the loader to close by `postMessage`, and the loader only listens to its own iframe and
   Beacon's own address.
3. **Which websites may show a bot.** Two checks, both based on headers the browser fills in
   and a web page cannot forge:
   - The loader's request for the bot's look carries an `Origin` header. A website that isn't
     on the bot's list of allowed websites gets `{ "enabled": false }` and no bubble.
   - The chat window's request carries a `Referer` header naming the website that framed it.
     A website that isn't on the list gets a notice instead of the chat, and no chat code or
     bot details are sent. Direct visits to the chat address (no framing website) are refused.
4. **Visitors.** Each visitor gets a random id in their browser (`localStorage`). It keeps one
   visitor's conversation apart from another's and brings it back after a reload. It is not a
   login: anyone can pick any id.
5. **The chat API for visitors** (`/api/widget/<bot id>/chat`) refuses any request whose
   `Origin` isn't Beacon's own address, so another website's script can't make a visitor's
   browser call it. It uses the same answering code as the owner's Playground
   (`lib/chat/respond.ts`), so there is one place to improve answers.
6. **What actually protects the AI allowance.** A program outside a browser can send any
   headers, so the website checks stop casual misuse but not a determined caller. The real
   protection is the limits: per visitor, per network address, per bot per day (shared with
   the owner's test questions) and for the whole site. A visitor sees friendly messages and
   learns nothing about how Beacon is set up.
7. **The Install tab.** Shows whether the bot is ready to appear (active, has knowledge, has
   an allowed website), the embed code with the right address, a live preview that adds the
   real widget to the dashboard page, and steps to test on a real page from your own computer.
