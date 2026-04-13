# Neon Grid: Polarity Crash

A lightweight HTML5 canvas brawler prototype focused on performance and simple rendering.

## Run locally

Because the game uses ES modules, run a small static server from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Files

- `characters.json`, `levels.json`: compact data for entities and stage boundaries.
- `core.js`: main loop, object pools, player/enemy update pipeline.
- `level_layout.js`: primitive `fillRect` stage renderer for Security Hub.
- `engine_update.js`: AABB collision, delayed surveillance echo, weapon geometry.
- `ui_renderer.js`: Vortex Meter + Nate radio overlay text.
- `nate_radio_generator.py`: optional offline audio generation script.
