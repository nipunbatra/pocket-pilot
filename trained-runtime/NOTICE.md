# Pocket Pilot trained JSON decisions

Model: Nipun/pocket-pilot-json-decisions-0.8b on Hugging Face.
Base: unsloth/Qwen3.5-0.8B at 23c69c53358a07516b5827588b3fdb12ae78fd65.
The weights retain Apache-2.0; see MODEL-LICENSE.txt. This is a narrow task-specific
adaptation, not the generic chat model. No answer tokens are generated.

The browser uses the exact trained LoRA updates and Clef-style decision head.
Native NF4 weights are dequantized, LoRA is added, and the backbone is materialized
as float16. The trained decision head uses float32. No additional 4-bit browser
requantization is used. Inputs and outputs remain on the visitor's device.

Architecture templates (all learned initializers replaced with trained weights):
- onnx-community/Qwen3.5-0.8B-ONNX, d1ea95774d40a29f0479bf9138cdf488a0394b6b
- onnx-community/Qwen3.5-0.8B-ONNX-OPT, 969350d5f4647ec9ac277110f8974c65d8c10e4b
The optimized graph uses LinearAttention/CausalConvWithState kernels instead of
Scan loops. Old template weights are retained only as a byte-verified storage
layout. The ordinary LM output projection is removed.

Schema packing and joint head math follow Cloudflare's Apache-2.0 Clef reference,
as vendored by Unsloth at 20cdc23470263c13f7e6f1eda6d01a62b9b64aeb. Native training
and export depend on Unsloth (AGPL-3.0); its software license remains applicable.
The export scripts and parity evidence are included in the Hugging Face repository.

Tokenizer: Transformers.js 4.3.1 (Apache-2.0).
Execution: ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0 (MIT), WebGPU plus
WebAssembly shape/control operations. Shared runtime files and third-party license
text are in ../local-runtime/. The runtime needs WebGPU with shader-f16 support.

One-time download is approximately 1.38 GB, cached if the browser permits.
The 1/2/3-question road schemas are supported. Input is never silently truncated.
Browser timing includes tokenization and readback, excluding model download/setup.
