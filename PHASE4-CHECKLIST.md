# Phase 4 checklist

Do these in order. Tell me which step fails and what you see, and I'll fix it.

You need a bot with at least one source that says Ready (the shipping policy text from Phase 3 is perfect).

## Set up

1. No new packages. Restart `npm run dev`.
2. Open the bot's Settings and add `localhost` under Allowed websites. Save.

## Test

1. **The Install tab.** Open the bot. Settings, Knowledge, Playground and Install are links, and Conversations says "Soon".
2. **The checklist on that tab.** With an active bot that has a Ready source and `localhost` allowed, all three rows show a green tick, and the embed code uses your address (`http://localhost:3000`) and your bot ID. Press the copy button next to it and paste somewhere to confirm.
3. **The live preview.** Press "Show the widget on this page". A round button appears at the bottom right in your bot's color. Click it: the chat opens with your greeting. Ask "How long does delivery to Lahore take?" and check the answer streams in with a source chip and a "Sources:" line under it.
4. **Closing.** Close the chat with the X in its header, then open it again with the round button. Open it once more and press the Escape key: it closes. Press "Hide the widget": the button disappears.
5. **A real page.** Follow "Test it on a real page" on the Install tab (save `test.html`, run `npx serve -l 5000 .`, open `http://localhost:5000/test.html`). The bubble appears. Ask a question and get an answer with a source.
6. **A website that isn't allowed.** In Settings, remove `localhost` and save. Reload `http://localhost:5000/test.html`: no bubble appears. Now open `http://localhost:3000/embed/<your bot ID>` directly in the browser: you see "This chat isn't enabled for this website." Put `localhost` back and save.
7. **Paused.** Pause the bot and save. Reload the test page: no bubble. Make it Active again.
8. **No knowledge.** On a second bot with no sources, add the embed code to the test page instead (or delete the first bot's sources). No bubble appears.
9. **A visitor's conversation comes back.** Ask two questions on the test page, reload the page, and open the chat. Your earlier messages are there. Press the circular arrow in the header ("Start over"): the conversation is cleared, and stays cleared after a reload.
10. **Another visitor.** Open the test page in a private window. It starts empty, with its own conversation.
11. **A small screen.** Make the browser window narrower than 480 pixels (or use your browser's phone view). The open chat fills the whole screen, and the X closes it.
12. **Rate limit.** In one minute, send 6 questions. The 6th shows "You're sending messages quickly. Please wait a moment and try again." (A visitor may send 5 per minute.)
13. **Visitor chats are separate.** In the Playground, your own test chat does not contain the visitor questions.
14. **Direct calls from another website are refused (optional).** On any other website (not Beacon), open the browser console and run:
    `fetch("http://localhost:3000/api/widget/<your bot ID>/chat", {method:"POST", headers:{"Content-Type":"application/json","X-Beacon-Visitor":crypto.randomUUID()}, body:JSON.stringify({messages:[{role:"user",content:"hi"}]})}).then(r=>console.log(r.status)).catch(e=>console.log("blocked", e.message))`
    It must print `blocked` or a 403, never an answer.
15. **MongoDB check (optional).** In Atlas, `chats` has records whose `conversationKey` starts with `visitor:`, and `usage` has counters named `visitor:...` and `ip:...`.

## Code checks

1. `npm test` passes. It now also checks the allowed-website rules, the frame and origin checks and the visitor id check.
2. `npm run lint` shows no errors.
3. `npm run build` finishes without errors.

When all of this works, say "Phase 4 done" and I'll build Phase 5: the owner's view of conversations, the questions the bot couldn't answer, and lead capture.
