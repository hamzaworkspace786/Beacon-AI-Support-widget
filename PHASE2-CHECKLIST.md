# Phase 2 checklist

Do these in order. Tell me which step fails and what you see, and I'll fix it.

You need three small test files: a text-based PDF with at least 2 pages, a Word file (.docx) with some paragraphs, and a .txt file with a few paragraphs. A scanned PDF (a photo of a page) is useful for step 7, if you have one.

## Set up

1. `GOOGLE_GENERATIVE_AI_API_KEY` must be in `.env.local` (your free key from aistudio.google.com/apikey).
2. No new packages this phase. Restart `npm run dev` anyway so it picks up the key.
3. Open `/api/health`. It should show `"ai": true`.

## Test

1. **The tab.** Open a bot. Settings and Knowledge are links. Playground, Conversations and Install say "Soon" and don't click.
2. **Paste text.** Title "Shipping policy" and three or four sentences. Press Add text. The source appears at once as "Preparing" and turns to "Ready" within about 10 seconds, without refreshing. It says "Pasted text · 1 passage".
3. **Upload a PDF.** Drop it on the box (then try the Choose a file button too). It goes from Preparing to Ready. The line shows its page count, size and number of passages, and the grey text under it is the start of the PDF.
4. **Upload a Word file and a .txt file.** Both reach Ready.
5. **Reload.** Refresh the page. All your sources are still there with Ready.
6. **Wrong files.** Each of these must show a clear message and add nothing:
   - a .png or .jpg file: "Beacon reads PDF, Word (.docx), and text (.txt) files."
   - a .png renamed to .pdf: "This file looks like it isn't really a PDF."
   - a file over 4 MB: "This file is larger than 4 MB."
   - an empty .txt file
7. **No readable text.** If you have a scanned PDF, upload it. You should see "no selectable text" and nothing is added.
8. **Short text.** Paste "hi" with a title. You should see "Paste at least a couple of sentences."
9. **Delete.** Delete one source (confirm the prompt). It disappears and stays gone after a refresh.
10. **A bad AI key.** In `.env.local` change the key to something wrong, restart, and paste some text. The source should end as Failed with "Search isn't set up correctly on this server yet." Put the real key back and restart.
11. **Another account.** Sign in as a different account and open `/api/bots/<id of your first bot>/sources`. You must get "Bot not found", not the list.
12. **The limit.** Add sources up to 10. The upload box and the text form then disable and a note says the bot is full. Delete one and they come back.
13. **MongoDB check (optional).** In Atlas, open the `beacon` database. `sources` shows your sources with `embeddingModel` and `embeddingDimensions: 768`. `chunks` has one record per passage, each with an `embedding` field.
14. **Delete a bot (optional).** Delete a bot that has sources. Its records are gone from both `sources` and `chunks`.

## Code checks

1. `npm test` passes. It now also checks text cleaning, paging, chunking, file checks and the retry logic.
2. `npm run lint` shows no errors.
3. `npm run build` finishes without errors.

When all of this works, say "Phase 2 done" and I'll build Phase 3, the chat itself.
