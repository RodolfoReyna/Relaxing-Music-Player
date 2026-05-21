from server.config import (
    DEFAULT_FREQUENCY_HZ,
    DEFAULT_PAN_PERCENT,
    DEFAULT_VOLUME_PERCENT,
    GENERATED_NOISE_IDS,
    OUTPUT_ATTENUATION,
    TRACK_CATALOG,
)


def get_track_by_id(track_id: str) -> dict | None:
    return next((track for track in TRACK_CATALOG if track["id"] == track_id), None)


def list_tracks() -> list[dict]:
    return [
        {
            "id": track["id"],
            "label": track["label"],
            "file": track["file"],
            "audio_url": f"/audio/{track['file']}" if track["file"] else None,
        }
        for track in TRACK_CATALOG
    ]


def process_session_config(
    sound_source: str,
    frequency_hz: float,
    volume_percent: float,
    timer_minutes: int,
    pan_percent: float = DEFAULT_PAN_PERCENT,
) -> dict:
    track = get_track_by_id(sound_source)
    if track is None:
        raise ValueError(f"Unknown sound source: {sound_source}")

    frequency_hz = max(200.0, min(20_000.0, float(frequency_hz)))
    volume_percent = max(0.0, min(100.0, float(volume_percent)))
    timer_minutes = max(0, min(999, int(timer_minutes)))
    pan_percent = max(-100.0, min(100.0, float(pan_percent)))
    pan_value = round(pan_percent / 100.0, 4)

    is_generated = track["id"] in GENERATED_NOISE_IDS
    effective_gain = (volume_percent / 100.0) * OUTPUT_ATTENUATION

    return {
        "sound_source": track["id"],
        "track_label": track["label"],
        "track_file": track["file"],
        "audio_url": f"/audio/{track['file']}" if track["file"] else None,
        "frequency_hz": frequency_hz if is_generated else DEFAULT_FREQUENCY_HZ,
        "volume_percent": volume_percent,
        "pan_percent": pan_percent,
        "pan_value": pan_value,
        "effective_gain": round(effective_gain, 4),
        "filter_type": "lowpass" if is_generated else "allpass",
        "filter_frequency_hz": frequency_hz if is_generated else 20_000.0,
        "tone_control_enabled": is_generated,
        "timer_minutes": timer_minutes,
        "timer_duration_ms": timer_minutes * 60 * 1000,
        "defaults": {
            "frequency_hz": DEFAULT_FREQUENCY_HZ,
            "volume_percent": DEFAULT_VOLUME_PERCENT,
            "pan_percent": DEFAULT_PAN_PERCENT,
        },
    }
