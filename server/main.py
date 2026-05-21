from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from server.config import AUDIO_DIR, CLIENT_DIR
from server.services.session import list_tracks, process_session_config

app = FastAPI(
    title="Focus Sound Machine",
    description="Mini-Project capstone client/server relaxing noise and ambience mixer.",
    version="1.0.0",
)


class SessionConfigRequest(BaseModel):
    sound_source: str = "noise"
    frequency_hz: float = Field(default=740.0, ge=200.0, le=20_000.0)
    volume_percent: float = Field(default=20.0, ge=0.0, le=100.0)
    timer_minutes: int = Field(default=0, ge=0, le=999)
    pan_percent: float = Field(default=0.0, ge=-100.0, le=100.0)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "project": "Focus Sound Machine",
        "capstone": "Mini-Project -- Focus Sound Player",
    }


@app.get("/api/tracks")
def get_tracks() -> dict:
    return {"tracks": list_tracks()}


@app.post("/api/session/config")
def create_session_config(payload: SessionConfigRequest) -> dict:
    try:
        return process_session_config(
            sound_source=payload.sound_source,
            frequency_hz=payload.frequency_hz,
            volume_percent=payload.volume_percent,
            timer_minutes=payload.timer_minutes,
            pan_percent=payload.pan_percent,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


if AUDIO_DIR.is_dir():
    app.mount("/audio", StaticFiles(directory=str(AUDIO_DIR)), name="audio")

if CLIENT_DIR.is_dir():
    app.mount("/static", StaticFiles(directory=str(CLIENT_DIR)), name="static")


@app.get("/")
def index() -> FileResponse:
    index_path = CLIENT_DIR / "index.html"
    if not index_path.is_file():
        raise HTTPException(status_code=500, detail="Client index.html not found")
    return FileResponse(index_path)


@app.get("/credits")
def credits() -> FileResponse:
    credits_path = CLIENT_DIR / "credits.html"
    if not credits_path.is_file():
        raise HTTPException(status_code=500, detail="Client credits.html not found")
    return FileResponse(credits_path)


@app.get("/{resource}")
def client_assets(resource: str) -> FileResponse:
    if resource.startswith("api/") or resource.startswith("audio/"):
        raise HTTPException(status_code=404)

    candidate = (CLIENT_DIR / resource).resolve()
    if not candidate.is_file() or CLIENT_DIR.resolve() not in candidate.parents:
        raise HTTPException(status_code=404)

    return FileResponse(candidate)
