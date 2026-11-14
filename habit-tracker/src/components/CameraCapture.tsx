import { useEffect, useRef, useState } from "react";

/**
 * In-page camera capture. Grabs a frame straight from the live video stream
 * into a canvas — it never hands off to the native Camera app, so nothing
 * is written to the device's camera roll / Photos library.
 */
export default function CameraCapture({
  onCapture,
  onClose,
}: {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Couldn't access the camera. Check camera permissions and try again."));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const maxDim = 1280;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 12 }}>
        {error ? (
          <p style={{ fontSize: 14, color: "var(--danger)", margin: "8px 0 16px" }}>{error}</p>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              borderRadius: 12,
              display: "block",
              marginBottom: 12,
              background: "#000",
              aspectRatio: "3 / 4",
              objectFit: "cover",
            }}
          />
        )}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          {!error && (
            <button className="btn primary" onClick={handleCapture}>
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pinch-to-zoom / double-tap-to-zoom / drag-to-pan image viewer, scoped to
 * just this element. The app locks out page-wide pinch zoom (to stop
 * accidental zoom on the rest of the UI), so this handles it manually with
 * pointer events instead of relying on native viewport zoom.
 */
