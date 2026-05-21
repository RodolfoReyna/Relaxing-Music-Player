# Prompt archive entry

- **Date:** 2026-05-19
- **Mini-project:** Mini-Project -- Focus Sound Player
- **Purpose:** design, code, documentation
- **Tool:** Cursor

## Prompt (verbatim)

```
Restructure the project so that it follows these guidelines
```

(Context: CSC394 / IS376 Five Mini Projects requirements — client/server with browser client, FastAPI server, server-side processing of user input, MP labeling, prompt archiving, Project Manual AI documentation.)

## Notable response / outcome

- Split into `client/` (browser UI) and `server/` (FastAPI + uvicorn).
- Added `POST /api/session/config` so tone, volume, timer, and track choices are validated and normalized on the server.
- Added `GET /api/tracks` and `/audio` static serving from the backend.
- Added `prompts/` archive and `docs/MP1-project-manual.md` for formal documentation.
