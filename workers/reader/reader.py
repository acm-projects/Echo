"""Long-lived IndexTTS 2.5 CPU worker.

The parent Node process sends one JSON job per line on stdin. Progress and
results are emitted as JSON lines on stdout so jobs can be resumed or retried.
"""
from __future__ import annotations

import json
import os
import sys
import traceback
from contextlib import redirect_stdout
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "indextts"


def emit(payload: dict) -> None:
    print(json.dumps(payload), flush=True)


def main() -> None:
    sys.path.insert(0, str(MODEL_DIR))
    from indextts.infer_v2_5 import IndexTTS2, QwenEmotion

    emit({"type": "status", "status": "loading"})
    with redirect_stdout(sys.stderr):
        # QwenEmotion (text-to-emotion) is a separate language model. Book narration always sends an explicit
        # emotion vector and never uses it, so it's loaded only when a job first asks for emotion from text.
        tts = IndexTTS2(
            cfg_path=str(MODEL_DIR / "checkpoints" / "config.yaml"),
            model_dir=str(MODEL_DIR / "checkpoints"),
            use_bf16=False,
            use_qwen_emo=False,
        )
    emit({"type": "status", "status": "ready"})

    def ensure_qwen_emotion() -> None:
        if tts.qwen_emo is None:
            with redirect_stdout(sys.stderr):
                tts.qwen_emo = QwenEmotion(os.path.join(tts.model_dir, tts.cfg.qwen_emo_path))

    for line in sys.stdin:
        if not line.strip():
            continue
        job = json.loads(line)
        job_id = job["jobId"]
        output_path = Path(job["outputPath"])
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = output_path.with_name(f"{output_path.stem}.tmp{output_path.suffix}")
        try:
            emit({"type": "progress", "jobId": job_id, "value": 0.1})
            emotion_vector = job.get("emotionVector")
            if emotion_vector:
                # Explicit [happy, angry, sad, afraid, disgusted, melancholic, surprised, calm]
                # weights skip QwenEmotion; apply the same bias and 0.8 cap as the IndexTTS web UI.
                emotion_args = {"emo_vector": tts.normalize_emo_vec([float(v) for v in emotion_vector], apply_bias=True)}
            elif job.get("emotion"):
                ensure_qwen_emotion()
                # IndexTTS recommends emo_alpha around 0.6 for text-derived emotion.
                emotion_args = {"emo_text": job["emotion"], "use_emo_text": True, "emo_alpha": 0.6}
            else:
                emotion_args = {}
            # durationFactor below 1 speaks faster at the same pitch; maxMelTokens (50 per second of speech) stops
            # the model running on past the words, which it tends to do on very short lines.
            pacing_args = {"duration_factor": float(job.get("durationFactor", 1.0))}
            if job.get("maxMelTokens"):
                pacing_args["max_mel_tokens"] = int(job["maxMelTokens"])
            # numBeams: IndexTTS defaults to a 3-beam search in its autoregressive step; 1 is much faster.
            if job.get("numBeams"):
                pacing_args["num_beams"] = int(job["numBeams"])
            with redirect_stdout(sys.stderr):
                tts.infer(
                    spk_audio_prompt=job["referencePath"],
                    text=job["text"],
                    lang=job.get("language", "EN"),
                    output_path=str(temporary_path),
                    use_random=False,
                    verbose=False,
                    **emotion_args,
                    **pacing_args,
                )
            os.replace(temporary_path, output_path)
            emit({"type": "result", "jobId": job_id, "outputPath": str(output_path)})
        except Exception as error:
            if temporary_path.exists():
                temporary_path.unlink()
            emit({
                "type": "error",
                "jobId": job_id,
                "message": str(error),
                "traceback": traceback.format_exc(),
            })


if __name__ == "__main__":
    main()
