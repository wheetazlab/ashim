# Getting started

## Run with Docker

The fastest way to get ashim running:

```bash
docker run -d \
  --name ashim \
  -p 1349:1349 \
  -v ashim-data:/data \
  ashimhq/ashim:latest
```

Open `http://localhost:1349` in your browser. Log in with `admin` / `admin`.

::: tip GPU acceleration
Have an NVIDIA GPU? Add `--gpus all` to accelerate background removal (2.7x), upscaling (3x), and OCR (1.5x):

```bash
docker run -d --gpus all -p 1349:1349 -v ashim-data:/data ashimhq/ashim:latest
```

Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html). Falls back to CPU if no GPU is found. See [Docker Tags](./docker-tags) for details and benchmarks.
:::

## Run with Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  ashim:
    image: ashimhq/ashim:latest
    container_name: ashim
    ports:
      - "1349:1349"
    volumes:
      - ashim-data:/data
      - ashim-workspace:/tmp/workspace
    environment:
      - AUTH_ENABLED=true
      - DEFAULT_USERNAME=admin
      - DEFAULT_PASSWORD=admin
    restart: unless-stopped

volumes:
  ashim-data:
  ashim-workspace:
```

```bash
docker compose up -d
```

See [Configuration](./configuration) for the full list of environment variables.

## Build from source

Requirements: Node.js 22+, pnpm 9+, Python 3.10+

```bash
git clone https://github.com/ashim-hq/ashim.git
cd ashim
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

This starts both the API server and the React frontend. Open `http://localhost:1349` in your browser.

## What you can do

The sidebar lists every tool. Pick one, upload an image, tweak the settings, download the result.

Some things to try first:

- Resize an image to specific dimensions or a percentage
- Remove a background with the AI tool
- Compress a photo before uploading it somewhere
- Convert between formats (JPEG, PNG, WebP, AVIF, TIFF, HEIC)
- Batch process a folder of images through any tool
- Save results to the Files page for later

Every tool is also available through the [REST API](../api/rest), so you can script workflows or plug ashim into other systems.
