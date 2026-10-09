# Pocket Pilot — a browser-only Decisions lab

Play a three-lane driving game while inspecting every model input, typed question, answer, JSON response, and measured round trip. Includes classroom slides and recorded model comparisons.

[Play Pocket Pilot](https://nipunbatra.github.io/pocket-pilot/) · [Classroom slides](https://nipunbatra.github.io/pocket-pilot/slides.html)

## Native Mario experiment

[Play Mario](https://nipunbatra.github.io/pocket-pilot/mario.html) uses the actual
PlayMario HTML5 remake source directly: all 32 maps, original game physics,
power-ups, enemies and MP3 sound. No iframe, remote game embedding or ROM.
The engine is pinned at 51d9c404db8b6f85104c9dff36e92f940b97cce7.
See vendor/playmario/NOTICE.md for source and Nintendo attribution.
Upstream has no root license file; this copy is not claimed to be permissively licensed.

Use arrows or A/D/W/S, Shift or Space to run/fire. The model chooses among 13
full button combinations, held for 4/8/16 native frames. Pause, inference and
history inspection stop the simulation. Native input transitions preserve jump
hold/release semantics. Changing worlds or restarting begins a new attempt and
keeps old records. Each record contains its own world and captured visible scene.
JSON lists visible geometry only; vision receives the captured canvas plus the
control contract. Road fine-tunes are not offered as Mario-trained models.

Our adapter is mario-engine.js; mario-contract.js supplies the questions.
platformer.js shares the inspector and controller with the small original game.

## Platformer experiment

Open [the platformer](https://nipunbatra.github.io/pocket-pilot/platformer.html) for
an original Mario-style browser level. Play manually, inspect a labelled scripted
reference, or try original Liquid 600M locally and Clef/Clef-flash/Jev/Luna via
OpenRouter. No Nintendo artwork, ROM, music or level data is included.

The simulation freezes during inference, then applies the returned action for
4 or 8 frames at 60 Hz. Speed changes playback, not the action horizon. Pausing,
restarting or hiding the tab discards an in-flight action. Runs stop at 200
decisions. Model outputs are never corrected by the scripted reference.

Use JSON or image inputs and 1–3 typed questions. Only action controls the player.
Export includes exact request/response, captured image, input mode, timing,
before/after state and frames actually applied. Human and scripted records do not
invent probabilities or model timings. The API key is never included. Our road
fine-tunes predict lanes and are not offered as platformer-trained models.

The physics and original canvas renderer are in platformer-engine.js and
platformer-view.js; contract and controller are in platformer-contract.js and
platformer.js. Everything runs from this static folder; no additional dependencies.

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

## Trained Pocket Pilot model — no API key

Choose **Pocket Pilot · trained JSON · local WebGPU**, then Load and One decision.
This is our trained Qwen3.5-0.8B backbone + LoRA + Clef-style decision head,
not the original chat model. It scores supplied answers with zero generated tokens.
Only structured scene input is supported by this checkpoint. All one/two/three
question versions remain available. Changing models releases the active GPU sessions.

The first load downloads about 1.38 GB from
[Nipun/pocket-pilot-json-decisions-0.8b](https://huggingface.co/Nipun/pocket-pilot-json-decisions-0.8b).
The game pins the exact revision in trained-runtime/model-manifest.json.
Weights are cached when possible. WebGPU with float16 shader support and sufficient
memory is required; inference stays on the device. The image experiment is separate.

On Apple M2 Max, 216 held-out scenes at each question count gave 216/216 correct
lanes. Median warm browser latency: 111.2 ms (one question), 138.6 ms (two),
166.9 ms (three). The three-question middle-blocked result was 216/216 and
vertical-position accuracy was 204/216, matching native classifications.
These are local browser measurements, not network round trips; download/setup is
excluded. They measure this game and schema, not general reasoning. Full evidence,
training data and export scripts are included in the model repository.

Runtime source is in trained-runtime/source. To rebuild from that directory:
`npm ci --ignore-scripts` then `node build.mjs ..`. It shares the pinned WebAssembly
files in local-runtime/. See trained-runtime/NOTICE.md for provenance and licenses.

## Local Liquid model — no API key

Choose **Liquid 600M · local WebGPU · experimental**, then **Load model**.
Recent browsers with WebGPU and enough GPU memory can run image and structured
JSON decisions on the device. The first load downloads approximately 595 MB
for images or 406 MB for text, plus tokenizer/runtime files. Weights are cached
when possible. Unload frees model sessions; switching to a cloud model also unloads.
No model input or output is sent for local inference. Hugging Face serves downloads.

The warm three-scene check measured 217 ms/image and 60 ms/JSON for one question
on an Apple GPU, but only 2/3 and 1/3 correct lanes respectively. This is an
experimental teaching comparison, not a reliable driver. A follow-up image check
got 6/18 lanes correct with the current prompt; three simpler formulations got
6/18, 3/18 and 7/18. The local timing label excludes model loading and is distinct
from a network round trip. See [timings, all 84 prompt checks and limitations](./liquid-local.html).

Weights are pinned to revision 4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0 of
onnx-community/d1-omni-600M-ONNX. Liquid's LFM Open License v1.0 applies, including
its commercial threshold. Runtime source and exact dependency lock are included
in local-runtime/source. To rebuild that bundle: cd local-runtime/source,
then npm ci --ignore-scripts and node build.mjs .. . Run node test-contract.mjs
for the question/answer contract checks. The static host needs no build or backend.

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
No analytics, third-party scripts, or remote fonts are loaded. The Content Security Policy permits OpenRouter calls and pinned model downloads from Hugging Face. Runtime JavaScript and WebAssembly are self-hosted; WebAssembly compilation is permitted.
GitHub still serves the files and may log ordinary web requests.

Images/structured scenes are sent to OpenRouter and the selected provider;
their data policies apply. Recorded runs and slides require no key. New run
history stays in the tab until exported. Exports contain game inputs/answers,
not the API key. Browser-direct timings include network and routing; the
recorded comparison table retains the original local-server timings.

## Verified Clef route

Both Clef variants pin OpenRouter to Cloudflare and disable fallback. The client
refuses to steer unless the response confirms Cloudflare. A provider routing
change on 8 October produced near-constant wrong choices and 16,384-token image
usage; pinning Cloudflare restored 441-token inputs and 4/4 Clef, 3/4 Clef-flash
correct lanes on the four checked images. See [routing and local model checks](./liquid-local.html).

## Models and controls

Luna, Clef-flash, and Clef can receive a road image. Jev uses explicitly labelled
structured JSON. Only the lane question steers; the optional second/third
questions demonstrate probability and ordered-score outputs. Classroom mode
freezes game time during API waits. Real time intentionally exposes latency.
Every run stops after 30 requests, a collision, or an API error.

## Fine-tuned Liquid models

The model selector keeps the **original, not fine-tuned Liquid 600M** and adds
separate **fine-tuned JSON** and **fine-tuned image** choices. Each fine-tune loads
its own immutable Hugging Face weights, locks the matching input modality and
reports its revision/fine-tuned status in Timing + metadata and exported JSON.
Use `?model=liquid-json` or `?model=liquid-image` for direct links.

Both browser variants retain 216/216 held-out correct lane choices at every
question count. On Apple M2 Max, one-question medians were 56.7 ms for JSON and
206.0 ms for image input. Warm timing includes preprocessing/readback; download
and setup are excluded. See [full browser results](./liquid-finetuned.html),
including auxiliary errors, precision, native comparisons and model links.
These are independent task-specific fine-tunes, not a single jointly trained
multimodal checkpoint. Image input is perception, not image generation.

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
