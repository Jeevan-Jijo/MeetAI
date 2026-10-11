import os
import sys
import gc
import math
from typing import List, Dict, Any, Tuple, Optional
from app.core.config import settings
from app.core.logging import logger

def _ensure_cuda_dll_paths():
    """Ensure Windows dynamic linker can find cublas64_12.dll for CTranslate2."""
    if sys.platform != "win32":
        return

    candidate_paths = [
        os.path.expanduser(r"~\AppData\Local\Programs\Ollama\lib\ollama\cuda_v12"),
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.0\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.1\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.2\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.3\bin",
        r"C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.4\bin",
    ]
    for p in candidate_paths:
        if os.path.isdir(p):
            try:
                os.add_dll_directory(p)
            except Exception:
                pass
            if p not in os.environ.get("PATH", ""):
                os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")

_ensure_cuda_dll_paths()

def detect_device_and_compute_type() -> Tuple[str, str]:
    """Detect appropriate device and compute type for faster-whisper via CTranslate2."""
    if settings.WHISPER_DEVICE == "cpu":
        return "cpu", "int8"
    
    try:
        import ctranslate2
        cuda_count = ctranslate2.get_cuda_device_count()
        if cuda_count > 0:
            supported = ctranslate2.get_supported_compute_types("cuda")
            compute_type = "float16" if "float16" in supported else "int8_float16"
            logger.info(f"CTranslate2 CUDA detected: {cuda_count} device(s), compute_type={compute_type}")
            return "cuda", compute_type
    except Exception as e:
        logger.warning(f"CTranslate2 CUDA check failed: {e}")

    try:
        import torch
        if torch.cuda.is_available():
            return "cuda", "float16"
    except Exception:
        pass
        
    return "cpu", "int8"

_CACHED_TRANSCRIBER_MODEL = None
_CACHED_MODEL_KEY = None

class Transcriber:
    def __init__(self, model_size_or_path: str = None):
        self.model_name = model_size_or_path or settings.WHISPER_MODEL
        self.device, self.compute_type = detect_device_and_compute_type()
        self.model = None

    def load_model(self):
        """Load or reuse the cached faster-whisper model."""
        global _CACHED_TRANSCRIBER_MODEL, _CACHED_MODEL_KEY
        
        current_key = (self.model_name, self.device, self.compute_type)
        if _CACHED_TRANSCRIBER_MODEL is not None and _CACHED_MODEL_KEY == current_key:
            self.model = _CACHED_TRANSCRIBER_MODEL
            return self.model
            
        from faster_whisper import WhisperModel
        try:
            logger.info(f"Loading faster-whisper model '{self.model_name}' on {self.device} ({self.compute_type})...")
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type
            )
            _CACHED_TRANSCRIBER_MODEL = self.model
            _CACHED_MODEL_KEY = current_key
            return self.model
        except Exception as e:
            logger.warning(
                f"Failed loading model '{self.model_name}' on {self.device}: {e}. "
                f"Falling back to '{settings.WHISPER_FALLBACK_MODEL}'..."
            )
            self.model_name = settings.WHISPER_FALLBACK_MODEL
            try:
                self.model = WhisperModel(
                    self.model_name,
                    device=self.device,
                    compute_type=self.compute_type
                )
            except Exception as e_cuda:
                logger.warning(f"Fallback on {self.device} failed ({e_cuda}); reverting to cpu/int8...")
                self.device = "cpu"
                self.compute_type = "int8"
                self.model = WhisperModel(
                    self.model_name,
                    device="cpu",
                    compute_type="int8"
                )
            _CACHED_TRANSCRIBER_MODEL = self.model
            _CACHED_MODEL_KEY = (self.model_name, self.device, self.compute_type)
            return self.model

    def transcribe(
        self,
        audio_path: str,
        language: str = "en",
        condition_on_previous_text: bool = False
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Transcribe audio file with word-level timestamps.
        Returns (segments_list, detected_language).
        Each segment contains: start, end, text, confidence, words.
        """
        model = self.load_model()
        logger.info(f"Starting faster-whisper transcription for {audio_path} on {self.device} ({self.compute_type})...")
        
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            language=language,
            condition_on_previous_text=condition_on_previous_text,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400),
            word_timestamps=True
        )
        
        detected_language = info.language or language
        logger.info(f"Language: {detected_language} (prob: {info.language_probability:.2f})")

        results = []
        for seg in segments:
            text = seg.text.strip()
            if not text:
                continue
            
            # Confidence proxy from avg_logprob: exp(avg_logprob) clamped [0.1, 1.0]
            confidence = max(0.1, min(1.0, math.exp(seg.avg_logprob))) if seg.avg_logprob is not None else 0.95
            
            word_list = []
            if seg.words:
                for w in seg.words:
                    word_list.append({
                        "word": w.word,
                        "start": round(w.start, 2),
                        "end": round(w.end, 2),
                        "probability": round(w.probability, 3) if w.probability is not None else 1.0
                    })

            results.append({
                "start": round(seg.start, 2),
                "end": round(seg.end, 2),
                "text": text,
                "confidence": round(confidence, 3),
                "avg_logprob": seg.avg_logprob,
                "words": word_list
            })
            
        logger.info(f"Transcription complete: {len(results)} segments generated.")
        return results, detected_language

    def unload(self):
        """Optionally unload cached model and free GPU VRAM."""
        global _CACHED_TRANSCRIBER_MODEL, _CACHED_MODEL_KEY
        self.model = None
        _CACHED_TRANSCRIBER_MODEL = None
        _CACHED_MODEL_KEY = None
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass
        logger.info("Transcriber model unloaded and memory cleared.")
