from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    anthropic_api_key: str = ""
    elevenlabs_api_key: str = ""
    google_api_key: str = ""
    openrouter_api_key: str = ""
    openai_api_key: str = ""  # accepts a raw OpenAI secret; if present it takes precedence

    voice_id_male_a: str = "pNInz6obpgDQGcFmaJgB"
    voice_id_male_b: str = "VR6AewLTigWG4xSOukaG"
    voice_id_female_a: str = "EXAVITQu4vr4xnSDxMaL"
    voice_id_female_b: str = "MF3mGyEYCl7XYWbV9V6O"

    upload_dir: Path = Path("./uploads")
    output_dir: Path = Path("./outputs")
    audio_assets_dir: Path = Path("./audio_assets")

    max_pdf_size_mb: int = 50
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    def voice_ids_for_pair(self, pair: str) -> tuple[str, str]:
        mapping = {
            "MM": (self.voice_id_male_a, self.voice_id_male_b),
            "FM": (self.voice_id_female_a, self.voice_id_male_b),
            "FF": (self.voice_id_female_a, self.voice_id_female_b),
        }
        return mapping.get(pair, mapping["FM"])

    def ensure_dirs(self):
        for d in (self.upload_dir, self.output_dir, self.audio_assets_dir):
            d.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()

    # warn about placeholder voice IDs which will cause every TTS call to fail
    placeholder_ids = {
        "male_a": "pNInz6obpgDQGcFmaJgB",
        "male_b": "VR6AewLTigWG4xSOukaG",
        "female_a": "EXAVITQu4vr4xnSDxMaL",
        "female_b": "MF3mGyEYCl7XYWbV9V6O",
    }
    for name, vid in placeholder_ids.items():
        if getattr(s, f"voice_id_{name}") == vid:
            import logging
            logging.getLogger(__name__).warning(
                f"VOICE_ID_{name.upper()} is still set to the sample value ({vid}). "
                "Replace it with a real ElevenLabs voice ID in .env."
            )

    return s
