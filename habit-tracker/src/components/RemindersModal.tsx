import { useEffect, useState } from "react";
import {
  enablePush,
  getExistingSubscription,
  pushSupported,
  sendTestNotification,
} from "../lib/push";

interface Props {
  onClose: () => void;
}

export default function RemindersModal({ onClose }: Props) {
  const [subscription, setSubscription] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    getExistingSubscription().then(setSubscription).catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      const sub = await enablePush();
      setSubscription(sub);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!subscription) return;
    try {
      await navigator.clipboard.writeText(subscription);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy automatically — select the text and copy it manually.");
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Daily reminders">
        <h2>Daily reminders</h2>

        {!supported && (
          <p className="reminder-note">
            This device or browser doesn't support notifications. On iPhone, open
            this app from your <strong>Home Screen</strong> (not Safari) to enable them.
          </p>
        )}

        {supported && !subscription && (
          <>
            <p className="reminder-note">
              Get a nudge at <strong>8:00 AM</strong>, <strong>1:00 PM</strong>, and{" "}
              <strong>9:00 PM</strong> to check in on your habits. Tap below and allow
              notifications.
            </p>
            <button className="btn primary block" onClick={handleEnable} disabled={busy}>
              {busy ? "Enabling…" : "Enable reminders on this device"}
            </button>
          </>
        )}

        {supported && subscription && (
          <>
            <p className="reminder-note">
              ✅ Notifications are on for this device. <strong>One last step</strong> to
              start the daily reminders — copy the code below and paste it into your
              repo's GitHub secret named <code>PUSH_SUBSCRIPTION</code>.
            </p>
            <textarea
              className="reminder-code"
              readOnly
              value={subscription}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="modal-actions">
              <button className="btn" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy code"}
              </button>
              <button className="btn ghost" onClick={() => sendTestNotification()}>
                Send a test
              </button>
            </div>
          </>
        )}

        {error && <p className="reminder-error">{error}</p>}

        <div className="modal-actions" style={{ marginTop: 8 }}>
          <button className="btn ghost block" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
