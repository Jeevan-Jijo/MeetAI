from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.core.logging import setup_logging, logger
from app.api.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Setup logging & ensure database tables
    setup_logging()
    logger.info("Initializing Meeting Intelligence System backend...")
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database schema verified at {settings.DATABASE_URL}")

    # Startup recovery: remove stale temporary WAV files from PROCESSED_DIR
    try:
        if settings.PROCESSED_DIR.exists():
            for tmp_file in settings.PROCESSED_DIR.glob("*_norm.wav"):
                if tmp_file.is_file():
                    try:
                        tmp_file.unlink()
                        logger.info(f"Startup recovery removed stale intermediate WAV: {tmp_file.name}")
                    except Exception as clean_err:
                        logger.warning(f"Failed to remove stale file {tmp_file.name}: {clean_err}")
    except Exception as e:
        logger.warning(f"Error checking temporary files in {settings.PROCESSED_DIR}: {e}")

    yield
    # Shutdown
    logger.info("Meeting Intelligence System shutting down...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="100% Local-First AI Meeting Intelligence System API",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs"
    }
