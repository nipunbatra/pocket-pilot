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
