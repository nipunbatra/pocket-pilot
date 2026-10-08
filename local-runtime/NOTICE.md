# Liquid d1 local runtime

The model is **LiquidAI/d1-omni-600M**, copyright Liquid AI, Inc., under the
**LFM Open License v1.0**. Read MODEL-LICENSE.txt, including its commercial-use
threshold. The weights are downloaded on demand, not redistributed in this site.

Browser export: onnx-community/d1-omni-600M-ONNX, pinned to
`4ebc1b97bf1477485371c79d1cf8d5e4e8eebfa0`. This derivative export uses a q8
trunk/decision head, a q4 embedding table, and an fp16 vision encoder.
https://huggingface.co/onnx-community/d1-omni-600M-ONNX

Runtime: Transformers.js 4.3.1 (tokenization/image preparation) and ONNX Runtime Web
1.31.0-dev.20260914-8d85527a0. See THIRD-PARTY-LICENSES.txt.
The prompt contract follows Liquid's published prompt.py. LFM2-VL's initial
fixed-square resize is disabled to retain Liquid's aspect-preserving smart resize.
Questions are evaluated sequentially; the image encoder is reused within a call.
No output text is generated. Some operators use WebAssembly within the WebGPU runtime.

This is an experimental teaching option. Warm performance does not measure model
downloads, initial session setup, or cold shader compilation. A three-scene road
check is a smoke test, not a general accuracy benchmark. Inputs and results remain
in the browser; initial downloads contact Hugging Face and its model CDN.

## Pocket Pilot task-specific fine-tunes

Two independent derivatives adapt the Liquid language trunk with LoRA and train
its original decision head on road JSON or screenshots. LoRA is merged before
q8 ONNX export. Fine-tuning does not use answer correction. The 202 frozen vision
and token-embedding tensors are checked against the original at float16 training
precision before reusing the pinned community q4 embedding/fp16 vision assets.
Fine-tuned decoder weights come from the selected Nipun/pocket-pilot-liquid-600m-*
repository at the exact revision in source/checkpoints.mjs. Each modality has
separate weights, cache keys and runtime metadata. The original model is retained
as an explicitly labelled baseline. All weights retain the LFM Open License v1.0.
Browser test accuracy and timing are reported in ../liquid-finetuned.html.
