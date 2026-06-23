# API Reference

FastAPI service mounted at `/api/v1`.  All paths return JSON unless noted; SSE
endpoints stream `text/event-stream`.  Every response includes an
`X-Request-ID` header that is also bound to the structured backend log.

## Operational

| Method | Path                | Description                                                    |
| ------ | ------------------- | -------------------------------------------------------------- |
| `GET`  | `/api/v1/health`    | Liveness + which subsystems loaded (generator, pipeline).      |
| `GET`  | `/api/v1/config`    | UI-facing limits, design-mode catalogue, defaults.             |
| `GET`  | `/api/v1/metrics`   | In-process counters and latency histograms (uptime, per-path). |

## Generation

| Method | Path                       | Description                                                       |
| ------ | -------------------------- | ----------------------------------------------------------------- |
| `POST` | `/api/v1/generate`         | Sample SMILES with optional property filters.                     |
| `POST` | `/api/v1/design`           | Synchronous closed-loop design (single / restarts / evolutionary).|
| `POST` | `/api/v1/design/stream`    | SSE stream of iteration events terminating with `done`/`error`.   |
| `GET`  | `/api/v1/molecule/svg`     | Render any SMILES to SVG (query params: `smiles`, `width`, `height`). |

## Design request payload (`/api/v1/design`)

```json
{
  "target_success": 0.3,
  "max_iterations": 10,
  "candidates_per_iteration": 250,
  "top_k": 40,
  "safety_threshold": 0.2,
  "require_no_structural_alerts": false,
  "property_targets": {"logp": [2.0, 5.0], "mw": 500, "qed": 0.5},
  "seed_smiles": null,
  "use_rl_model": false,
  "selection_mode": "phase_weighted",
  "design_mode": "single",
  "ensure_target": false,
  "use_reranker": false
}
```

`ensure_target: true` cascades `single -> restarts(5) -> diversity-restarts(5)`
and returns the strongest run (`_strategy_used` reports which path was kept).

## Logging & metrics

- Structured logs are emitted via `loguru`. Configure via env:
  - `SAFEMOLGEN_LOG_LEVEL` (default `INFO`)
  - `SAFEMOLGEN_LOG_FILE`  (rotating, 10 MB x 5)
  - `SAFEMOLGEN_LOG_JSON=1` (one JSON object per line)
- `SAFEMOLGEN_CORS_ORIGINS` (comma-separated) overrides the dev defaults for
  production deployment.
