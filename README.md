# Pocket Pilot — a browser-only Decisions lab

Play a three-lane driving game while inspecting every model input, typed question, answer, JSON response, and measured round trip. Includes classroom slides and recorded model comparisons.

[Play Pocket Pilot](https://nipunbatra.github.io/pocket-pilot/) · [Classroom slides](https://nipunbatra.github.io/pocket-pilot/slides.html)

## Run and host

Serve this folder with any static host. GitHub Pages can publish `main` at `/`.
No build step, backend, npm dependencies, or hosting secrets are required.
For a local preview only: `python3 -m http.server 8780 --bind 127.0.0.1`.
Open the served URL; use `slides.html` for the presentation.

## Classroom controls and JSON

The road, selected decision, and rewindable history share one workspace. All settings
are visible together in two desktop rows: connection, model, input, questions, driving
mode, speed, sampling, image size, sound, and volume. Keep this layout without a
separate settings dialog. Model comparisons and the complete log open separately.
Recorded demo works without a key. On smaller laptops, history becomes a horizontal
strip; phones stack the panels and controls.

Full JSON offers Request, Response, Metadata + action, and Full frame. Use the searchable tree,
expand/collapse, or syntax-highlighted Raw view with line numbers. Click a tree field
name to copy its path. Copy JSON and Download keep every original field and image byte,
even when search or shortened strings simplify the display. Enlarge focuses the
inspector; Escape restores the layout. Present requests browser full screen.

The 23-slide lesson explains LM/VLM, the Decisions API, Jev, typed answers,
request/response JSON, and proposed sustainability-lab applications. The comparison
covers all six models, all supported image/JSON paths, 210/420/840px images and
1/2/3 questions. Run D contains 189 attempts across 63 settings, three scenes each.
Earlier A/B/C recordings remain separate; exports contain all 264 attempts.
Tables show correct/attempts, errors, median/mean/min/max latency, mean reported
input/output tokens and scaled recorded cost per 1,000 calls. Missing is not zero.
CSV/JSON downloads retain full precision. The evidence ZIP stores each PNG once
and includes a script to restore exact requests/responses. Speaker notes explain
sample limits, scoring and timings. The animated walkthrough at
`walkthrough.html` includes Gemini narration, an original Lyria instrumental score, 1080p motion graphics, captions, chapters and a transcript. Animations explain the system; benchmark numbers come from saved calls.

## Visitors supply their own OpenRouter key

Connect a dedicated key with a small credit limit. Live calls go directly from
the visitor's browser to OpenRouter’s Decisions or chat-completions endpoint. The key is
held only in a JavaScript closure, never saved to localStorage, sessionStorage,
cookies, logs, URLs, or exports. Refresh, navigation, and Disconnect clear it.
Disconnect stops new calls and aborts the browser request; an already accepted
provider request may still be billed. Connection does not validate a key until
the first live call. There is no shared site-owner API key.

The page's JavaScript can access the key while connected, so users must trust
the site's code and should use limited-credit keys. Static hosting does not
make a browser immune to malicious extensions or compromised site code.
No analytics, third-party scripts, or remote fonts are loaded. A restrictive
Content Security Policy allows inference connections only to OpenRouter.
GitHub still serves the files and may log ordinary web requests.

Images/structured scenes are sent to OpenRouter and the selected provider;
their data policies apply. Recorded runs and slides require no key. New run
history stays in the tab until exported. Exports contain game inputs/answers,
not the API key. Browser-direct timings include network and routing; the
recorded comparison table retains the original local-server timings.

## Models and controls

Luna, Clef-flash, and Clef can receive a road image. Jev uses explicitly labelled
structured JSON. Only the lane question steers; the optional second/third
questions demonstrate probability and ordered-score outputs. Classroom mode
freezes game time during API waits. Real time intentionally exposes latency.
Every run stops after 30 requests, a collision, or an API error.

## Maintenance

`public-client.js` owns key handling and browser transport; `racing.js` owns the
game UI; `road-engine.js` is the pure simulation. `public-config.js` contains
only public questions and model IDs. Never commit keys or credential files.
The included recorded JSON contains artificial game scenes and real responses,
not authentication headers. Keeping this repository and hosted page trustworthy
is part of keeping visitors' in-memory keys safe.

## Decisions vs standard chat LLM / VLM

Choose GPT-4.1 or GPT-4.1 Mini in the same model dropdown. Road image sends the
exact PNG to a vision-capable chat model; Structured scene sends JSON as text.
Both use OpenRouter `/api/v1/chat/completions`, strict JSON schema, temperature 0,
a 120-token cap, and no requested explanation. They can drive the same game.
Decisions models continue to use `/api/alpha/decisions`.

Compare → Compare this input makes three billed calls on one frozen scene:
Luna Decisions, GPT-4.1, and Mini, with order rotated. It uses the current input,
image size and question count, and never steers. Tables separate JSON/image,
question count and timing origin, report correct/attempts and errors, and use
successful complete responses for median latency. Failure timings remain in the
full trace. Each run retains the 30-call limit. Refresh/disconnect clears the key.

Chat returns a lane enum, optional boolean, and optional 0/1/2 level. The app
validates these before steering; no probabilities or confidence are invented.
The regular chat API can enforce structured output too. This experiment compares
complete model/API paths; it does not isolate API overhead or prove a universal
latency/accuracy ranking.

Full JSON → Request shows the actual sent body (`wire_request` in exported
frames); Response shows the untouched provider response (`raw_response`). Full
frame also contains the canonical scene/questions (`request`) and app-parsed
answers (`response`). These normalized answers are explicitly labelled.

Open recorded LLM / VLM comparison requires no key. Its 18 calls cover three
identical 420 × 480 scenes and the corresponding three JSON scenes, one lane
question per call and three models. All attempts are retained. Measured medians:
Luna 701 ms image / 535 ms JSON; GPT-4.1 1807 ms image / 759 ms JSON; Mini 2084 ms image /
1031 ms JSON. These are small local-server samples; live browser timings vary.

References: [OpenRouter structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs),
[GPT-4.1](https://openrouter.ai/openai/gpt-4.1),
[GPT-4.1 Mini](https://openrouter.ai/openai/gpt-4.1-mini).
