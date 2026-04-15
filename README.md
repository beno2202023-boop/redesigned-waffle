# river city tweaker

A lightweight HTML5 canvas brawler prototype focused on performance and simple rendering for **river city tweaker**.

## Run locally

Because the game uses ES modules, run a small static server from this folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Files

- `core.js`: class-based engine bootstrap (`RCTweakerEngine`) with game loop, ghost-input buffer, combat updates, and rendering.
- `input_handler.js`: centralized key state tracking for movement + J/K/L combat controls.
- `ui_renderer.js`: HUD class that draws the Vortex meter and Nate radio text box.
- `level_layout.js`: primitive `fillRect` stage renderer for Security Hub visuals.
- `engine_update.js`: AABB collision helpers, gravity/friction resolver, delayed echo buffer, and weapon rendering.
- `levels.json`: stage metadata (`security_hub`) including edges and exits.
- `characters.json`: character roster/stats (`jax`, `boss_dan`).
- `radio_track.json`: optional track movement metadata for synchronized radio mood styling.
- `nate_radio_generator.py`: optional offline audio generation script.
