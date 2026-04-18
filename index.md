## ashim Helm Chart

Self-hosted image processing with background removal, inpainting, upscaling,
face enhancement, colorization, and OCR.

### Install

```bash
helm repo add ashim https://ashim-hq.github.io/ashim
helm repo update
helm install ashim ashim/ashim --namespace ashim --create-namespace
```

### GPU variants

```bash
# NVIDIA
helm install ashim ashim/ashim --set image.tag=latest-cuda
# AMD
helm install ashim ashim/ashim --set image.tag=latest-rocm
```

### Source

[github.com/ashim-hq/ashim](https://github.com/ashim-hq/ashim)
