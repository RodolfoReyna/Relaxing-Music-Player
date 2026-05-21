# Focus Sound Machine

**Capstone label:** Mini-Project -- Focus Sound Player

A client/server web app for relaxing focus audio: generated white and brown noise, ambience loops, volume and pan controls, a sleep timer, and a sound-credits page. Built for CSC394 / IS376 **Five Mini Projects** requirements.

## Capstone alignment

| Requirement | How this project meets it |
|-------------|---------------------------|
| MP labeling | **Mini-Project -- Focus Sound Player** (course); app title **Focus Sound Machine** |
| Client/server | Browser client + FastAPI / uvicorn server |
| User input in browser | Sound source, tone, volume, pan, timer |
| Server-side processing | `POST /api/session/config` validates and normalizes all session settings |
| AI collaboration | Documented in `docs/MP1-project-manual.md` |
| Prompt archive | `prompts/` directory |

## Features

- **Generated sounds:** White noise and brown noise (Web Audio API, built in the browser)
- **Ambience loops:** Ocean, rain, air conditioning, cozy fireplace, train passing by (MP3 files from `/audio`)
- **Tone:** Low-pass filter slider (enabled only for generated white/brown noise; greyed out for ambience)
- **Volume:** 0–100% with server-side gain limiting (50% output attenuation)
- **Pan:** Balance audio left (−100) through center (0) to right (+100)
- **Timer:** Optional auto-stop in minutes with live countdown
- **Credits:** `/credits` page with Pixabay attributions and AI-generated noise credits

## Sound sources

| Menu label | Type | Audio file |
|------------|------|------------|
| Generated White Noise | Generated in browser | — |
| Generated Brown Noise | Generated in browser | — |
| Ocean Ambience | MP3 loop | `audio/ocean-ambience.mp3` |
| Rain Ambience | MP3 loop | `audio/rain-ambience.mp3` |
| Air Conditioning Unit | MP3 loop | `audio/air-conditioning-unit.mp3` |
| Cozy Fireplace | MP3 loop | `audio/cozy-fireplace.mp3` |
| Train Passingby | MP3 loop | `audio/train-passingby.mp3` |

Add or change sources in `server/config.py` (`TRACK_CATALOG`). Generated sources use `file: None` and ids listed in `GENERATED_NOISE_IDS`.

## Project structure

```
├── client/
│   ├── index.html      # Main mixer UI
│   ├── credits.html    # Sound attributions
│   ├── app.js          # Web Audio playback + API calls
│   └── styles.css
├── server/
│   ├── main.py         # FastAPI routes
│   ├── config.py       # Track catalog and defaults
│   └── services/
│       └── session.py  # Session validation logic
├── audio/              # Ambience MP3 files
├── prompts/            # Archived AI prompts (required)
├── docs/
│   └── MP1-project-manual.md
└── requirements.txt
```

## Run locally

From the project root (Windows example without activating the venv):

```powershell
cd "c:\Users\rudyr\Documents\Mini Project Idea One"
py -3 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\uvicorn.exe server.main:app --reload --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** in your browser.

Do not open `client/index.html` directly — the app requires the FastAPI API and audio routes.

If PowerShell blocks `activate`, use `.venv\Scripts\uvicorn.exe` as shown above.

## Pages

| URL | Description |
|-----|-------------|
| `/` | Main mixer |
| `/credits` | Sound credits and attributions |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/tracks` | Sound source catalog |
| POST | `/api/session/config` | Validate settings; return playback parameters |
| GET | `/audio/{filename}` | Serve ambience MP3 files |

**`POST /api/session/config` body:**

```json
{
  "sound_source": "noise",
  "frequency_hz": 740,
  "volume_percent": 20,
  "pan_percent": 0,
  "timer_minutes": 0
}
```

**Response fields used by the client:** `effective_gain`, `filter_type`, `filter_frequency_hz`, `pan_value`, `tone_control_enabled`, `track_label`, `timer_duration_ms`, and related metadata.

## Documentation

- **Project Manual:** `docs/MP1-project-manual.md`
- **Prompt archive:** `prompts/README.md`
- **In-app credits:** http://127.0.0.1:8000/credits

## Safety

Use headphones at moderate volume. The server applies 20% output attenuation on top of the volume slider. Browser autoplay rules require a user click before audio starts.
