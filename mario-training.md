# A small Mario decision-model experiment

Status: controller repaired; paired review data prepared. **No Mario fine-tune has
been trained yet.** Road checkpoints cannot serve as Mario action policies.

The first experiment should predict one of the game's existing 13 action labels.
Use the same decision-head training approach as the road, without generating text.
Start with the original Liquid `d1-omni-600M`, then compare the previous 0.8B
decision-head recipe if needed. Train JSON and images as **separate models** on
paired scenes and the same reviewed labels.

## Why a successful online demo can look different

The public [typesafe-mario controller](https://github.com/fhshaik/typesafe-mario)
reads emulator RAM into structured JSON, including jump phase, velocity,
enemy-contact timing and takeoff deadlines. It is not evidence that the same
model can drive from an isolated screenshot with a minimal prompt. Its seven
actions and NES physics also differ from our HTML5 engine and 13 actions, so its
trajectories cannot be copied directly as labels.

Our vision input now includes the actual on-screen player marker and motion
strip. Call this **annotated vision**, not raw-pixel-only control. A raw screenshot
ablation can be added once the first policy is working.

## First dataset: four short skills

Proposed starting budget: 50–100 short demonstration episodes, sampled every
8 frames, aiming for roughly 2,000–5,000 reviewed state/action pairs. These are
planning targets, not collected-data counts or a promised accuracy.

1. Approach and clear one Goomba, at several approach speeds.
2. Jump onto and over one pipe. Include backing up when Mario is too close.
3. Cross one gap with enough momentum and a safe landing.
4. Recover: release a jump, brake, land, or retreat from a bad approach.

Record human play or a separately verified teacher. Mix successful trajectories
with expert corrections to states reached by the current model. After the first
fine-tune, let it play, correct the states it gets wrong, and train another round.
This addresses mistakes that compound during play rather than only recognising
frames from expert demonstrations. Do not automatically label a survived frame
as optimal: a mistake may only cause a collision several decisions later.

Use `mario-command-v2`: model jump commands can wait six frames for landing, and
each new grounded jump command is re-armed. Manual control retains native button
holds, so consecutive manual jump holds must be replay-checked before being used
as model-command labels. Keep old `legacy-hold-v1` traces for diagnosis only.

## Prepare local review material

Export a run with **Export run**. From the project root:

```sh
python3 decisions-game/training/mario/prepare_review.py \
  outputs/decisions-game/mario-json-clock-v2-run.json \
  --output outputs/decisions-game/mario-review-new
```

The directory contains `review.jsonl`, deduplicated PNGs, and a summary. Every
`reviewed_action` starts as `null`; the model's `recorded_action` is never promoted
to gold. Exact before-state and PNG are paired. After-state/outcome are review
information, never model input. Request headers and provider responses are not
copied. There are no model downloads or API calls.

Keep an entire episode in one split, e.g. 70% train, 15% calibration, 15% test.
Do not randomly split neighbouring frames. Use a second, level-held-out test to
check generalisation. Image and JSON runs must share the exact split manifest.

## Training and evaluation gates

Reuse rank-16 LoRA plus the existing decision head from `../train_liquid.py`,
initially three epochs, with the vision tower frozen for the image comparison.
The current road trainer still has `lane` and `legacy22` assumptions: adapt those
to the `action` question and a Mario regression set **before launching**. No GPU
training command is presented as ready until that adaptation and data review pass.
Check every prompt fits the model's context; do not silently truncate terrain or
action choices. Keep labels, filenames, future state and teacher hints out of input.

Compare original and tuned models on identical held-out scenes, then let them
actually play. Report action accuracy and confusion, but use successful obstacle
clearances, level completions, distance travelled and deaths as the primary
gameplay measures. Report attempts and failures, not just the best video.

Test frozen 8-frame classroom control first. Then test real time at 1× with full
capture→answer→application timing, p50/p95 latency and observation age in frames.
At 418 ms, a 60 Hz world advances about 25 frames at 1× and 401 frames at 16×
during one answer. Training for lower latency does not remove delayed-control
problems automatically. Export to WebGPU only after native/ONNX/browser action
and probability parity checks; time image preprocessing and the encoder too.

## Observed diagnostic run, 9 October 2026

One fresh Luna JSON run (one question, 8-frame classroom actions) reached world
x=1,796 after 88 decisions and then lost a life; median round trip was 418 ms.
The older supplied JSON trace lost at x≈549. These are different individual runs
with changed prompts and question counts, **not an ablation or a win-rate estimate**.
Replaying the older choices with the new buffer produces a real jump after
landing but still collides: that sequence also jumps too late. Controller repair
and policy improvement are separate requirements.

The separate annotated-vision run reached the same x=1,796 but stalled against
a pipe; it was paused after 144 calls (463 ms median). A real-time JSON run at
1× lost at x≈530 after six calls (537 ms median); applied answers were already
13–36 simulation frames old. Continuous playback works, but it did not improve
the policy. These are individual diagnostic attempts, not aggregate benchmarks.
