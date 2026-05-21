from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CLIENT_DIR = BASE_DIR / "client"
AUDIO_DIR = BASE_DIR / "audio"

OUTPUT_ATTENUATION = 0.5
DEFAULT_FREQUENCY_HZ = 740.0
DEFAULT_VOLUME_PERCENT = 20.0
DEFAULT_PAN_PERCENT = 0.0

GENERATED_NOISE_IDS = frozenset({"noise", "brown-noise"})

TRACK_CATALOG = [
    {"id": "noise", "label": "Generated White Noise", "file": None},
    {"id": "brown-noise", "label": "Generated Brown Noise", "file": None},
    {"id": "ocean", "label": "Ocean Ambience", "file": "ocean-ambience.mp3"},
    {"id": "rain", "label": "Rain Ambience", "file": "rain-ambience.mp3"},
    {"id": "air-conditioning", "label": "Air Conditioning Unit", "file": "air-conditioning-unit.mp3"},
    {"id": "cozy-fireplace", "label": "Cozy Fireplace", "file": "cozy-fireplace.mp3"},
    {"id": "train-passingby", "label": "Train Passingby", "file": "train-passingby.mp3"},
]
