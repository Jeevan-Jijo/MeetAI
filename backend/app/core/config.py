import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Settings
    PROJECT_NAME: str = "Meeting Intelligence System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Base Directories & Project-Local Storage (inside project backend/instance)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    MIS_DATA_DIR: Path = Path(os.getenv("MIS_DATA_DIR", str(BASE_DIR / "instance")))
    DATA_DIR: Path = MIS_DATA_DIR
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", str(MIS_DATA_DIR / "uploads")))
    PROCESSED_DIR: Path = Path(os.getenv("PROCESSED_DIR", str(MIS_DATA_DIR / "tmp")))
    VECTOR_DIR: Path = Path(os.getenv("VECTOR_DIR", str(MIS_DATA_DIR / "vectors")))
    EXPORTS_DIR: Path = Path(os.getenv("EXPORTS_DIR", str(MIS_DATA_DIR / "exports")))
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]
    
    # Database (project-local in backend/instance/mis.db)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{MIS_DATA_DIR / 'mis.db'}")
    
    # Ollama Local LLM
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen3:8b"
    OLLAMA_FALLBACK_MODELS: str = "qwen2.5:7b,llama3.2:3b,mistral:7b"
    OLLAMA_TEMPERATURE: float = 0.1
    OLLAMA_TIMEOUT_SECONDS: float = 180.0
    
    # faster-whisper Speech-to-Text
    WHISPER_MODEL: str = "base.en"
    WHISPER_FALLBACK_MODEL: str = "base.en"
    WHISPER_DEVICE: str = "auto"
    WHISPER_COMPUTE_TYPE: str = "float16"
    
    # pyannote Speaker Diarization
    HF_TOKEN: str = ""
    DIARIZATION_MODEL: str = "pyannote/speaker-diarization-3.1"
    
    # Embeddings & Vector Store
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DEVICE: str = "cpu"
    
    # Processing Chunks
    CHUNK_TOKEN_SIZE: int = 1200
    CHUNK_OVERLAP_TOKENS: int = 150
    MAX_WORKERS: int = 2

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()

# Ensure directories exist
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.PROCESSED_DIR, exist_ok=True)
os.makedirs(settings.VECTOR_DIR, exist_ok=True)
os.makedirs(settings.EXPORTS_DIR, exist_ok=True)

