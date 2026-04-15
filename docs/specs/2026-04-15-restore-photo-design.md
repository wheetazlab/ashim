# Restore-Photo: State-of-the-Art Redesign

**Date:** 2026-04-15  
**Status:** Approved  
**Scope:** Full rewrite of the restore-photo pipeline and settings UI

---

## Overview

Replace the current restore-photo pipeline with a single, always-best-quality pipeline backed by state-of-the-art open-source models running fully locally inside the Docker container. No presets, no quality tiers — the pipeline always runs at maximum quality. GPU is used when available; CPU is always a supported fallback. Users control *which* steps run via toggles, not *how well*.

---

## Models

All models are ONNX (or TFLite for BlazeFace) and downloaded at Docker build time via `hf_hub_download`. If a model file is missing at runtime, the affected step is skipped gracefully with a logged warning.

| Model | Purpose | Format | Approx. Size | HuggingFace Source |
|---|---|---|---|---|
| `lama_fp32.onnx` | Inpainting fallback (when SD model absent) | ONNX fp32 | ~200 MB | Carve/LaMa-ONNX |
| `codeformer.onnx` | Face restoration (primary) | ONNX | ~170 MB | facefusion/models-3.0.0 |
| `gfpgan_1.4.onnx` | Face restoration fallback | ONNX | ~330 MB | facefusion/models-3.0.0 |
| `nafnet_denoise.onnx` | Neural denoising | ONNX | ~68 MB | Export from megvii-research/NAFNet official weights (NAFNet-SIDD-width32) |
| `ddcolor.onnx` | Colorization (shared with colorize tool) | ONNX | ~450 MB | existing |
| `ct2_colorization.onnx` | Higher-quality colorization | ONNX | ~850 MB | Export from shuchenweng/CT2 (ICCV 2023) official weights |
| `realesrgan_x2.onnx` | Super-resolution 2× (shared with upscale tool) | ONNX | ~65 MB | existing |
| `realesrgan_x4.onnx` | Super-resolution 4× (shared with upscale tool) | ONNX | ~65 MB | existing |
| `mediapipe_blazeface.tflite` | Face detection | TFLite float16 | ~2 MB | Google MediaPipe (existing) |
| `sd_inpaint_fp16.onnx` | Diffusion inpainting (primary) | ONNX fp16 | ~1.7 GB | runwayml/stable-diffusion-inpainting quantized |

**Total new model footprint:** ~3.9 GB. Models shared with other tools are not re-downloaded.

---

## Processing Pipeline

Stages run sequentially. Each stage is a self-contained function: takes image + config, returns modified image. GPU provider priority: `CUDAExecutionProvider` → `CoreMLExecutionProvider` → `CPUExecutionProvider`.

```
Input image
    │
    ▼
[1] Pre-processing
    - EXIF auto-orient
    - Detect grayscale (is_grayscale flag) — mean channel diff < 5.0
    - Compute adaptive tile size from image resolution
    │
    ▼
[2] Damage Detection  (always runs to produce mask for step 3)
    - 8-angle morphological line kernels (0°, 22.5°, 45°, 67.5°, 90°, 112.5°, 135°, 157.5°)
    - Laplacian-based stain/fade/water-damage detection layer (new)
    - Combines top-hat + black-hat transforms at full resolution
    - Output: damage_mask at full resolution
    │
    ▼
[3] Inpainting  (if scratchRemoval=true AND damage coverage ≥ 0.1%)
    Primary: SD-inpainting ONNX fp16
        - Overlapping tile-stitch (tile=512, stride=384)
        - Poisson-blend seam correction
    Fallback (if SD model absent): LaMa tiled
        - tile=768, stride=512, feathered Gaussian blend
    │
    ▼
[4] Face Enhancement  (if faceEnhancement=true)
    - MediaPipe BlazeFace detection (unchanged)
    - Skip faces < 48px
    - Crop with 80% expansion for context
    - CodeFormer at 512×512 (primary)
    - GFPGAN at 512×512 as fallback if CodeFormer output SSIM vs. original face crop < 0.6
    - Paste-back with face-aware feathered elliptical mask + color-transfer correction
    │
    ▼
[5] Denoising  (if denoise=true)
    - NAFNet ONNX, tiled at full resolution
    - denoiseStrength (0–100) maps to NAFNet sigma parameter
    - Falls back to NLMeans if NAFNet model absent
    │
    ▼
[6] Super Resolution  (if superResolution=true)
    - Real-ESRGAN x4 if input < 2 MP
    - Real-ESRGAN x2 if input ≥ 2 MP
    - Tiled inference with seam blending (reuse upscale tool implementation)
    │
    ▼
[7] Colorization  (if colorize=true)
    - CT2 tiled (tile=512, stride=384)
    - Falls back to DDColor tiled if CT2 model absent
    - colorizeStrength (0–100) controls LAB a/b blend intensity
    - Preserves original luminance channel
    │
    ▼
Output image
```

**Progress milestones** (stderr JSON `{"progress": N, "stage": "..."}`):

| % | Stage |
|---|---|
| 5 | Pre-processing |
| 10 | Damage detection |
| 25 | Inpainting |
| 45 | Face enhancement |
| 60 | Denoising |
| 75 | Super resolution |
| 90 | Colorization |
| 95 | Saving output |
| 100 | Complete (set by API route) |

---

## API Changes

### Removed
- `mode: "auto" | "light" | "heavy"` — removed entirely

### Unchanged
- `scratchRemoval: boolean` (default `true`)
- `faceEnhancement: boolean` (default `true`)
- `fidelity: number` 0–1 (default `0.7`) — CodeFormer fidelity
- `denoise: boolean` (default `true`)
- `denoiseStrength: number` 0–100 (default `40`)
- `colorize: boolean` (default `false`)

### Added
- `superResolution: boolean` (default `true`) — allow user to disable SR if they want original dimensions
- `colorizeStrength: number` 0–100 (default `85`) — was hardcoded `0.85` internally

### Timeout
Bridge timeout raised from 300s → 1200s to accommodate SD-inpainting on CPU for large images.

---

## Frontend Changes (`restore-photo-settings.tsx`)

- Remove 3-column mode button group (`auto / light / heavy`)
- Add **Super Resolution** checkbox (default on)
- Add **Colorize Strength** slider (0–100, step 5) — shown when `colorize` is on, same pattern as `fidelity` slider
- `denoiseStrength` slider remains; now controls NAFNet sigma rather than NLMeans h

No other UI changes. Settings panel stays compact.

---

## i18n Additions (`packages/shared/src/i18n/en.ts`)

```ts
superResolution: "Super Resolution",
colorizeStrength: "Colorize Strength",
```

Remove: `restoreMode`, `restoreModeAuto`, `restoreModeLight`, `restoreModeHeavy` (if present).

---

## Error Handling

| Scenario | Behavior |
|---|---|
| SD model missing | Fall back to LaMa tiled; log warning |
| CT2 model missing | Fall back to DDColor tiled; log warning |
| NAFNet model missing | Fall back to NLMeans; log warning |
| GFPGAN model missing | Skip GFPGAN fallback; CodeFormer only |
| No damage detected (< 0.1% coverage) | Skip inpainting entirely |
| Tiling dimension mismatch | Fall back to 512px single-pass for that stage; log warning |
| CUDA unavailable | Silently use CPU provider |
| SD-inpainting CPU timeout | Bridge timeout is 1200s; if exceeded, API returns 504 with clear message |

---

## Testing

### Unit (Vitest)
- API Zod schema accepts `superResolution` and `colorizeStrength`
- API schema rejects old `mode` field
- `colorizeStrength` default is 85

### Integration (Vitest)
- POST restore-photo with fixture image → assert output dimensions ≥ input (SR ran)
- POST with `superResolution: false` → assert output dimensions equal input
- POST with `colorize: true` → assert output is not identical to input

### Python (pytest)
- Each pipeline stage tested in isolation with small fixture image:
  - Damage detection returns a binary mask with same H×W as input
  - LaMa tiled returns same-shape image
  - NAFNet tiled returns same-shape image
  - Real-ESRGAN x2 returns 2× dimensions
  - CT2 tiled returns same-shape image

### E2E (Playwright)
- Upload fixture old photo → verify before-after slider renders with non-blank result
- Verify Super Resolution checkbox appears in settings panel

---

## File Paths Affected

| File | Change |
|---|---|
| `packages/ai/python/restore.py` | Full rewrite of pipeline |
| `packages/ai/python/download_models.py` | Add NAFNet, CT2, SD-inpainting, GFPGAN download entries |
| `packages/ai/src/restoration.ts` | Update `RestoreOptions` interface |
| `apps/api/src/routes/tools/restore-photo.ts` | Update Zod schema, raise timeout |
| `apps/web/src/components/tools/restore-photo-settings.tsx` | Remove mode group, add SR + colorizeStrength controls |
| `packages/shared/src/i18n/en.ts` | Add/remove i18n keys |
| `packages/shared/src/constants.ts` | Update tool timeout constant if applicable |
