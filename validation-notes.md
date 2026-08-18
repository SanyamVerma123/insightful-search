# Final validation notes

Date: 2026-08-18

## Automated checks

- `pnpm exec tsc --noEmit` passed.
- `pnpm exec vitest run src/lib/sector-normalize.test.ts` passed: 4 tests.
- `pnpm build` passed and generated the Nitro/Cloudflare output.

## Browser checks

- Dashboard root loaded successfully with the India/US market switcher, 1-second silent refresh label, Day gainers / Day losers / Most active controls, sector buttons, TradingView heatmap frame, and responsive dashboard panels.
- Dashboard AI Analyst view loaded with the compact header, Research history rail, New research action, history toggle, model selector, research mode and effort controls, prompt suggestions, and compact composer.
- Stock page for `APOLLOHOSP.NS` loaded with live Indian quote data, native responsive price chart, financial statements in ₹ millions, analyst coverage, events, news, Research with AI actions, Add to watchlist, and PDF report action. The PDF action entered its Preparing state after activation.
- The standalone `/chat` route still exists as a separate legacy-style route; the redesigned AI workspace is available in the dashboard AI Analyst view at `/`.

## Final hardening

- AI errors now render as a calm `Research paused safely` recovery card with a retry action and no raw provider stack trace.
- PDF responses use an owned `ArrayBuffer` rather than Node-specific `Buffer` or a strict `BlobPart`, preserving runtime compatibility.

## Preview URL

https://8080-ixg1n9d7g37tkxgyj9c77-069f6356.sg1.manus.computer/

## Scope constraint

No GitHub commit or push was performed, per task instructions.

## Follow-up note

A real AI tool-call animation and provider recovery path require a configured provider key in Settings; the UI and routing paths are implemented and ready for runtime testing after a key is supplied.

## AI layout and background-request follow-up

- The dedicated AI route now uses the same redesigned `AIView` workspace rather than the legacy minimal chat page.
- The AI entry action can open the persistent dashboard AI view with `/?view=ai`.
- The dashboard keeps `AIView` mounted while other dashboard tabs render, so an active `useChat` request is not unmounted when switching Markets, Pro Screener, or other internal tabs. Chat messages and session metadata remain in localStorage.
- The browser test submitted a prompt with an unavailable selected provider and displayed the friendly `Research paused safely` card with `Retry research`; no raw provider message was shown.
- The browser then switched to Markets and back to AI. The saved session, prompt, and recovery state remained present.
- The model picker now synchronizes a saved preferred model to an actually available catalog entry when the saved ID is not returned by the provider catalog. The header also identifies when the selected provider key is missing.
- The server now treats an explicit model selection strictly: it will not silently substitute a different provider. It returns a clear provider-configuration message, while unknown upstream stream errors are mapped to a generic friendly retry message.
- Final checks after these changes: TypeScript passed, 4 sector tests passed, and production build passed.

## History collapse and tool animation follow-up

The history rail now uses a zero-width desktop state when closed, with the main AI column reclaiming the released space and expanding from `max-w-3xl` to `max-w-5xl`. On mobile, the rail remains an overlay drawer and does not reserve horizontal space.

Tool pills now inspect the AI SDK tool-part state. The animated three-dot pulse appears only for `input-streaming` and `input-available`, which are active tool phases. Completed tools render a neutral check state, and failed tool outputs render a non-animated failure state.

Browser validation confirmed the desktop rail opens and closes without leaving an empty column. TypeScript passed, all 4 sector-normalization tests passed, and the production build passed after the final change.

## Custom AI model registry follow-up

Settings now includes a Custom models editor. Each entry stores a provider, exact provider model ID, and optional display label. Entries can be removed, are included in the Preferred AI model selector, and persist with the existing local API-key settings when Save keys is pressed.

The AI Analyst merges saved custom models with the live catalog and routes their provider/model IDs through the existing provider factories and strict provider-key validation. A saved test entry `opencode:custom/finance-research-model` with display label `Finance Research Custom` was created in the browser, saved, and verified in the AI model selector. Selecting it changed the readiness notice to `Add a OpenCode Zen key in Settings to use this model.`

Final checks for this feature: TypeScript passed, 4 sector-normalization tests passed, and the production build passed.

## Chat composer and background research follow-up

The AI composer now defaults to `Balanced` research mode and `Medium Effort`. The mode cycle remains `Balanced → Quick Take → Deep Research`, and the existing morphing text, pill transitions, attachment, microphone, send/stop, and effort-bar animations remain in place. The effort-bar logic now recognizes the app’s `Low Effort`, `Medium Effort`, and `High Effort` labels.

Assistant messages now include `Copy` and `Retry` controls below the response. Copy uses the browser clipboard when available and gives a temporary `Copied` state. Retry reuses the preceding user prompt and is disabled while another request is active.

To reduce the reported periodic refresh behavior, the QueryClient now disables automatic query refetching on window focus and reconnect and limits retries to one. The stock news `Research with AI` action now uses client-side router navigation instead of `window.location.href`, removing the known hard reload path. The dashboard keeps AIView mounted while switching internal tabs, so an active AI stream can continue while the AI tab is hidden and messages remain persisted in local storage.

Final verification: Balanced and Medium Effort are visible as the initial composer selections in the running preview; TypeScript passed, 4 sector-normalization tests passed, and the production build passed.

## Mermaid visual error hardening

The Mermaid renderer now pre-validates diagram syntax with `mermaid.parse(..., { suppressErrors: true })` before calling `render`. Mermaid is initialized with `suppressErrorRendering: true`, its default parse-error callback is silenced for this isolated renderer, and the host DOM is cleared before and after failed rendering.

Malformed Mermaid now resolves to the existing calm `Visual preview unavailable` card with an optional `View diagram source` disclosure. No parser message or Mermaid version text is passed into the rendered chat UI. Valid HTML/SVG continues to use the separate sandboxed iframe preview.

Final checks: TypeScript passed, 4 sector-normalization tests passed, and the production build passed. The rebuilt AI Analyst preview loaded normally with no visible raw Mermaid error text.

## Supplied chat-bar replacement

Replaced the previous simplified AI composer with the supplied animated chat-bar implementation as the visual baseline. The new bar uses the compact collapsed prompt state, animated expansion with a multiline textarea, attachment tray and image gallery, model dropdown, effort cycling pill, voice waveform, animated arrow/microphone/stop action button, outside-click handling, and source styling adapted to the existing finance-terminal theme.

Project-specific behavior was reconnected: the composer defaults to `Balanced` and `Medium Effort`, submits `{ model, effort, attachments }` to AIView, calls `onStop` while a response is streaming, supports the existing background-mounted AI workspace, preserves image attachment handling, and retains the existing message-level Retry and Copy actions outside the composer.

The replacement was checked in the running preview: the collapsed bar shows `Ask anything`, expands into the new input surface, and exposes `Balanced`, `Quick Take`, `Deep Research`, `Medium Effort`, attachment, and voice/send controls. TypeScript passed, 4 sector-normalization tests passed, and the production build passed.

## Critical AI reliability pass

The supplied Kilo credential was tested privately against the configured Kilo gateway. The `/models` endpoint returned HTTP 200, the exact model `nvidia/nemotron-3-ultra-550b-a55b:free` appeared in the live catalog, and the app’s own `/api/chat` route returned a complete HTTP 200 UI-message stream with `finish` and `[DONE]`. The credential was not written to the repository or included in application state.

AIView now retains a stable AI SDK `Chat` runtime per history-session ID instead of recreating one `useChat` instance whenever the selected history chat changes. Each runtime has its own messages and active request, so switching to another history chat or another internal dashboard tab no longer replaces the original runtime or calls a stop operation. Background runtime errors are tracked per session and cleared on successful completion or retry.

The large visible red `Research paused safely` panel was removed. Failed requests now leave the saved response in place and expose a compact neutral `Response saved · Retry` action; raw provider or parser messages remain hidden. Assistant messages continue to include Copy and Retry actions.

The history rail now matches the requested reference structure more closely: `Chats` count, `New research`, `Search in chats`, grouped `Today`, `Yesterday`, and `Earlier` sections, active-session highlighting, and responsive drawer behavior. It opens by default on desktop and remains an overlay drawer on narrow screens.

Official stream-resume reference used: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams. The documentation states that true completion through full page reloads or route destruction requires server-side persistence of active streams and a resumable GET endpoint; the current fix guarantees continuity across the app’s history and internal-tab switching by retaining runtimes in the mounted client, while a complete browser reload still requires a durable resumable-stream backend.

Final validation: TypeScript passed, 4 sector-normalization tests passed, the production build passed, the live AI Analyst showed the reference-style Chats panel, and the verified Kilo model was added to the picker as `Nemotron 3 Ultra · Free · 550B`.

## Effort budgets, active history dots, and mobile pass

The chat route now uses the requested output ceilings: 50,000 tokens for Low Effort, 75,000 for Medium Effort, and 1,000,000 for High Effort. Deep Research and High Effort permit up to 100 tool/research steps, while other modes permit up to 40. The system instructions now explicitly tell the analyst to finish the requested answer and never stop mid-sentence or ask the user to say continue unless a required provider or tool genuinely fails.

AI history sessions now expose a shared runtime-status registry. Each session shows the three animated dots directly before its title only while its AI SDK status is `submitted` or `streaming`; ready, error, and completed sessions remain static. Status updates are broadcast even when another session is selected.

The global header search is now visible on narrow screens, centered in the available top-row space, and uses a responsive width of `clamp(132px, 44vw, 300px)`. The AI workspace header, model select, history drawer, messages, images, code, and root layout received min-width, max-width, wrapping, and overflow safeguards. Global mobile rules cap media/code width and reduce table density below 640px.

Validation: TypeScript passed, 4 sector-normalization tests passed, production build passed, the live AI workspace displayed the grouped Chats history panel and wider centered search control, and the live document reported no horizontal overflow at the preview viewport (`documentWidth === innerWidth`).

## 2026-08-18 — Kilo/Nemotron reliability and requested features

- Direct Kilo testing confirmed that generic string reasoning payloads are rejected; the route now omits the generic reasoning field and forwards Kilo's `reasoningEffort` provider option.
- Nemotron's live catalog reports a 65,536-token completion ceiling; the route clamps Nemotron requests to that ceiling instead of sending 75,000/1,000,000-token values.
- Kilo receives a curated finance tool subset, excluding the oversized raw-market escape hatch while retaining quotes, history, financials, news, web search, comparisons, market summaries, and screeners.
- Added press-and-hold/context-menu history actions with inline rename, delete, runtime cleanup, and fallback chat creation.
- Added the `create_screener` tool with structured filters, optional symbols, India/NSE/BSE normalization, live screening, and structured matching rows.
- AIView renders the screener result as a compact table and saves the returned filters once into the existing dashboard custom preset store.
- Validation passed: TypeScript, 4/4 sector tests, and production build. The first build attempt was terminated under memory pressure; after stopping dev servers, the build completed successfully.
- Later live Kilo smoke requests returned HTTP 403 Forbidden even for direct requests with the provided key/model, so a successful post-patch provider stream could not be confirmed after the gateway began rejecting that key. The app continues to map this to the existing friendly retry/provider-settings state and never displays raw upstream errors.
- No GitHub commit or push was performed.

## 2026-08-18 — Exact updated workspace recovery check

- The preserved updated source copy is `/home/ubuntu/insightful-search-run`; it contains 94 source files and the long-running markers `chatRuntimeStore`, `create_screener`, provider/model routing, and the AI workspace changes. The clean GitHub checkout contains 90 source files and does not contain those updated markers.
- Restored two missing loading components required by the preserved AI workspace: `src/components/ui/loading-state.tsx` and `src/components/ui/loader.tsx`.
- Started the preserved workspace on port 8090. The markets shell loaded through the public preview.
- Switching to AI Analyst then showed the app's own `This page didn't load` recovery screen, so publication is paused until the exact updated copy's runtime failure is repaired and the AI workspace is visibly verified.

## 2026-08-18 — Exact updated workspace now visually verified

- After restoring the model catalog shape, loader components, screener currency/industry types, legacy Settings compatibility, and the test dependency, TypeScript passed.
- The same port-8090 workspace now loads the AI Analyst view successfully.
- Browser verification shows the long-running updated UI: Chats history rail with New research/Search in chats, AI analyst header, provider-aware model picker including Kilo Nemotron, live context/Web search controls, prompt suggestions, Balanced and Medium Effort defaults, and the compact composer with attachment, voice, and send controls.
- This is the copy to publish; the clean main checkout must not replace it.
