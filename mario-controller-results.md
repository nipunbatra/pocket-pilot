# Mario: controller comparison and measured clears

Measured on 15 October 2026. Game: PlayMario HTML5 World 1-1, native engine
revision `51d9c404db8b6f85104c9dff36e92f940b97cce7`. Model requested through
OpenRouter: `~typesafe/jev-latest`; resolved model: `typesafe/jev-1.14-20261014`.

## What was different from Jev's Mario example?

The [reference controller](https://github.com/fhshaik/typesafe-mario), checked at
`ca22449ed187118d19326d1f54b01b6636578aa4`, reads structured emulator state,
calculates collision and takeoff timing, and selects from seven action macros.
It pauses for decisions. Its success does not demonstrate a cloud model reacting
to a continuously advancing game at 16×.

Our browser controller was asking a broad 13-action question over visible
rectangles, with a fixed 8- or 16-frame interval. Earlier improvements to the
separate NES experiment had not reached this browser version. The browser's
pixels and physics also differ from the NES; we did not copy NES thresholds.

Three changes:

1. Recognize native enemies using `type === 'enemy'`, rather than a nonexistent
   `enemy` flag. The old raw scene still named Goombas, but lacked a useful enemy tag.
2. Supply visible body-edge distances, jump phase, ceiling clearance, floor gaps
   and takeoff windows. Use seven action choices. Ask again on a hazard, landing,
   apex/head bump, blockage, or after 64 frames. Local geometry ends an action;
   **the model still chooses every button combination**. Wrong actions are not corrected.
3. Stop an active cutscene only when resetting. Calling `stopCutscene()` while idle
   popped the engine argument needed by the flag animation. A run could reach the
   finish and then throw an exception instead of recording the win.

Geometry thresholds and prompt advice are hand-authored controller engineering,
not learned weights. No Mario fine-tuning was used. The same native game physics,
collisions and existing six-frame jump-command buffer are retained.

## Measured results

| Run | Result | Decisions | Game frames | Wall time | Median round trip |
|---|---|---:|---:|---:|---:|
| Previous fixed-step image, 8 or 16 frames | First-enemy collision | 15 / 8 | — | — | — |
| Previous fixed-step JSON, 8 frames | Died at x = 2,820 | 118 | — | — | 512 ms |
| New event-driven JSON, diagnostic runner | **Flag reached** | 84 | 1,437 | 44.7 s | See raw trace |
| New event-driven JSON, actual page at **16×** | **Flag reached** | 80 | 1,439 | **46.7 s** | **517 ms** |
| Replay of that exact successful UI run at 16× | **Flag reached** | 80 recorded | 1,439 | **2.4 s warm** | No inference |

Both final live runs started fresh and used actual model responses for all actions.
They are two development checks on World 1-1, not a broad reliability estimate.
Before the fixes, a prototype with missing enemy tags died at the first enemy;
another reached the flag but threw the cutscene error. These failures are retained
in the local experiment output. A clear means the native engine entered its
`Flagpole` cutscene, not that we inferred success from a large x coordinate.

The live UI run spent 41.96 seconds waiting for its 80 complete API responses.
Playback speed cannot remove those network waits. Event-driven sampling reduces
requests while preserving a frozen decision state. Real-time mode remains available
but can apply stale decisions; it is not the demonstrated successful configuration.

## Try it

For a new live attempt, select **Jev latest → Jev-style · fewer waits · JSON →
1 question → 16×**, connect your OpenRouter key, then Run model. The controls
choose JSON and adaptive frames automatically. API waits pause game time.

For a fast demonstration, select **Recorded Jev clear · no API**, then Watch
recorded clear. The [direct replay link](./mario.html?demo=jev) selects 16×.
The actual engine replays the saved actions and compares every before/after state.
A mismatch stops playback. Pause stops immediately; starting replay again begins
from World 1-1. Request/response JSON and original measured latencies stay visible
and are explicitly labelled recorded. Replay makes no API requests.

The [complete replay data](./mario-jev-clear.json) contains the original requests,
responses, model version, timing, actions and before/after states. Screenshots are
reconstructed during replay. Its provenance includes a SHA-256 of the complete
original export. It contains no API key or authentication headers.

Image input is still available with the Classroom or Real-time clock. These
JSON controller improvements **do not establish a vision-based level clear**.
Other models and the other 31 worlds have not been validated with this controller.

## Verification

- 72 JavaScript tests and 28 Python tests passed.
- 10 browser-native tests passed, including every map starting, held-button
  semantics, no wall-clock physics drift, real collisions, and two exact recorded
  clears across idle resets and restart after the flag cutscene.
- UI replay cleared twice, made zero OpenRouter requests, and passed pause/restart.
- The two live clear traces and all prototype failures are retained locally under
  `outputs/decisions-game/mario-controller-2026-10-15/`.
