# Pocket Pilot — a browser-only Decisions lab

Play a three-lane driving game while inspecting every model input, typed question, answer, JSON response, and measured round trip. Includes classroom slides and recorded model comparisons.

[Play Pocket Pilot](https://nipunbatra.github.io/pocket-pilot/) · [Classroom slides](https://nipunbatra.github.io/pocket-pilot/slides.html)

## Run and host

Serve this folder with any static host. GitHub Pages can publish `main` at `/`.
No build step, backend, npm dependencies, or hosting secrets are required.
For a local preview only: `python3 -m http.server 8780 --bind 127.0.0.1`.
Open the served URL; use `slides.html` for the presentation.

## Visitors supply their own OpenRouter key

Connect a dedicated key with a small credit limit. Live calls go directly from
the visitor's browser to `https://openrouter.ai/api/alpha/decisions`. The key is
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
