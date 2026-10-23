export interface Reminder {
  id: string;
  title: string;
  time: string; // "HH:mm" (24-hour format)
  type: "medication" | "appointment" | "general";
  notes?: string;
  completedToday?: boolean;
  lastCompletedDate?: string;
}

export const REMINDERS_STORAGE_KEY = "health_reminders";
export const REMINDERS_EVENT_NAME = "health_reminders_updated";
export const ALARM_TRIGGER_EVENT = "health_alarm_triggered";

// Converts "HH:mm" (24h) to "hh:mm AM/PM" (12h)
export function formatTime12h(time24: string): string {
  if (!time24 || !time24.includes(":")) return time24;
  const [hStr, mStr] = time24.split(":");
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);
  if (isNaN(hours) || isNaN(minutes)) return time24;

  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMins = String(minutes).padStart(2, "0");
  return `${paddedHours}:${paddedMins} ${ampm}`;
}

// Formats as "02:30 PM (14:30)"
export function formatTimeBoth(time24: string): string {
  const t12 = formatTime12h(time24);
  return `${t12} (${time24})`;
}

// Get current local "HH:mm"
export function getCurrentTimeStr(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${mins}`;
}

// Today's local date string "YYYY-MM-DD"
export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Single persistent Web Audio Context
let sharedAudioCtx: AudioContext | null = null;
let cachedWavDataUri: string | null = null;

export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  return sharedAudioCtx;
}

// Unlocks audio context on user gesture
export function unlockAudio(): void {
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

// Pre-synthesize an embedded 0.6s PCM WAV chime data URI for dual HTML5 Audio fallback
function getChimeWavDataUri(): string {
  if (cachedWavDataUri) return cachedWavDataUri;
  try {
    const sampleRate = 22050;
    const duration = 0.6;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Uint8Array(44 + numSamples);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) buffer[offset + i] = str.charCodeAt(i);
    };
    const writeUint32 = (offset: number, val: number) => {
      buffer[offset] = val & 0xff;
      buffer[offset + 1] = (val >> 8) & 0xff;
      buffer[offset + 2] = (val >> 16) & 0xff;
      buffer[offset + 3] = (val >> 24) & 0xff;
    };
    const writeUint16 = (offset: number, val: number) => {
      buffer[offset] = val & 0xff;
      buffer[offset + 1] = (val >> 8) & 0xff;
    };

    writeString(0, "RIFF");
    writeUint32(4, 36 + numSamples);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    writeUint32(16, 16);
    writeUint16(20, 1);
    writeUint16(22, 1);
    writeUint32(24, sampleRate);
    writeUint32(28, sampleRate);
    writeUint16(32, 1);
    writeUint16(34, 8);
    writeString(36, "data");
    writeUint32(40, numSamples);

    // 2-tone melodic ping (587Hz -> 880Hz)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t < 0.22 ? 587.33 : 880.0;
      const decay = Math.max(0, 1 - t / duration);
      const sample = Math.sin(2 * Math.PI * freq * t) * decay * 0.45;
      buffer[44 + i] = Math.floor((sample + 1) * 127.5);
    }

    let binary = "";
    for (let i = 0; i < buffer.length; i++) binary += String.fromCharCode(buffer[i]);
    cachedWavDataUri = "data:audio/wav;base64," + btoa(binary);
    return cachedWavDataUri;
  } catch {
    return "";
  }
}

// Plays a clear, pleasant 3-tone chime with dual-engine fallback (Web Audio + HTML5 Audio)
export function playReminderChime(): void {
  if (typeof window === "undefined") return;

  // Dual engine 1: Web Audio API Oscillator
  try {
    const ctx = getOrCreateAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // 3-note melodic sequence: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz)
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.15);
      osc.frequency.setValueAtTime(783.99, now + 0.32);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.85);
    }
  } catch (err) {
    console.warn("Web Audio chime failed, falling back to HTML5 Audio:", err);
  }

  // Dual engine 2: HTML5 Audio with synthesized WAV
  try {
    const wavUri = getChimeWavDataUri();
    if (wavUri) {
      const audio = new Audio(wavUri);
      audio.volume = 0.5;
      audio.play().catch(() => {
        // Autoplay may be blocked if no user gesture yet
      });
    }
  } catch {
    // Ignore fallback failures
  }
}

// Requests browser permission for desktop notifications
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  const perm = await Notification.requestPermission();
  unlockAudio();
  return perm;
}

// Shows a desktop notification
export function showDesktopNotification(title: string, body: string): void {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon: "/favicon.ico",
        requireInteraction: true, // Keep notification visible until dismissed
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch {
      // Ignore background notification restrictions
    }
  }
}

// --- SYNCHRONIZED STORAGE HELPERS ---

export function getStoredReminders(): Reminder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REMINDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredReminders(reminders: Reminder[]): void {
  if (typeof window === "undefined") return;
  try {
    if (reminders.length > 0) {
      localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
    } else {
      localStorage.removeItem(REMINDERS_STORAGE_KEY);
    }
    // Broadcast change across tabs and local components
    window.dispatchEvent(new CustomEvent(REMINDERS_EVENT_NAME, { detail: reminders }));
  } catch (err) {
    console.error("Failed to save reminders:", err);
  }
}

export function markReminderTaken(id: string): void {
  const today = getTodayDateStr();
  const list = getStoredReminders();
  const updated = list.map(r =>
    r.id === id ? { ...r, completedToday: true, lastCompletedDate: today } : r
  );
  saveStoredReminders(updated);
}

export function snoozeReminder(id: string, minutes = 5): void {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  const newHours = String(now.getHours()).padStart(2, "0");
  const newMins = String(now.getMinutes()).padStart(2, "0");
  const snoozedTime = `${newHours}:${newMins}`;

  const list = getStoredReminders();
  const updated = list.map(r =>
    r.id === id ? { ...r, time: snoozedTime, completedToday: false } : r
  );
  saveStoredReminders(updated);
}

export function deleteStoredReminder(id: string): void {
  const list = getStoredReminders();
  const updated = list.filter(r => r.id !== id);
  saveStoredReminders(updated);
}

// --- React 18/19 useSyncExternalStore Helpers (Zero-mismatch) ---

export function subscribeToReminders(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(REMINDERS_EVENT_NAME, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(REMINDERS_EVENT_NAME, callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedRemindersRaw = "";
let cachedRemindersList: Reminder[] = [];

export function getRemindersClientSnapshot(): Reminder[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(REMINDERS_STORAGE_KEY) || "";
  if (raw !== cachedRemindersRaw) {
    cachedRemindersRaw = raw;
    try {
      const parsed = JSON.parse(raw);
      cachedRemindersList = Array.isArray(parsed) ? parsed : [];
    } catch {
      cachedRemindersList = [];
    }
  }
  return cachedRemindersList;
}

const SERVER_SNAPSHOT: Reminder[] = [];
export function getRemindersServerSnapshot(): Reminder[] {
  return SERVER_SNAPSHOT;
}

// Auto-register gesture unlock on module load
if (typeof window !== "undefined") {
  const handleInteraction = () => {
    unlockAudio();
    window.removeEventListener("pointerdown", handleInteraction);
    window.removeEventListener("keydown", handleInteraction);
    window.removeEventListener("click", handleInteraction);
  };
  window.addEventListener("pointerdown", handleInteraction, { once: true, passive: true });
  window.addEventListener("keydown", handleInteraction, { once: true, passive: true });
  window.addEventListener("click", handleInteraction, { once: true, passive: true });
}
