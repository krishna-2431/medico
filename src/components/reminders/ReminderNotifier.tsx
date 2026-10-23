"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Reminder,
  playReminderChime,
  showDesktopNotification,
  getCurrentTimeStr,
  getTodayDateStr,
  formatTime12h,
  getStoredReminders,
  markReminderTaken,
  snoozeReminder,
  subscribeToReminders,
  getRemindersClientSnapshot,
  getRemindersServerSnapshot,
} from "@/lib/reminders";
import { BellRing, Check, Clock, Volume2, X, Pill, Activity, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReminderNotifier() {
  const [activeAlarm, setActiveAlarm] = useState<Reminder | null>(null);
  const reminders = useSyncExternalStore(
    subscribeToReminders,
    getRemindersClientSnapshot,
    getRemindersServerSnapshot
  );
  const lastTriggeredRef = useRef<Record<string, boolean>>({});
  const alarmSoundIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalTitleRef = useRef<string>("");

  const handleMarkTaken = useCallback((reminder: Reminder) => {
    markReminderTaken(reminder.id);
    setActiveAlarm(null);
    toast.success(`✓ Marked "${reminder.title}" as taken! Great job staying on track.`);
  }, []);

  const handleSnooze = useCallback((reminder: Reminder) => {
    snoozeReminder(reminder.id, 5);
    setActiveAlarm(null);
    toast.info(`⏰ Snoozed "${reminder.title}" for 5 minutes.`);
  }, []);

  const handleDismiss = useCallback(() => {
    setActiveAlarm(null);
    toast.info("Alarm dismissed for now.");
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      originalTitleRef.current = document.title;
    }
  }, []);

  // Loop alarm sound when an active alarm modal is open
  useEffect(() => {
    if (activeAlarm) {
      playReminderChime();

      let toggle = false;
      const titleInterval = setInterval(() => {
        toggle = !toggle;
        document.title = toggle
          ? `🔔 MEDICINE DUE: ${activeAlarm.title}`
          : originalTitleRef.current || "HealthAI";
      }, 1000);

      alarmSoundIntervalRef.current = setInterval(() => {
        playReminderChime();
      }, 4000);

      return () => {
        if (alarmSoundIntervalRef.current) clearInterval(alarmSoundIntervalRef.current);
        clearInterval(titleInterval);
        document.title = originalTitleRef.current || "HealthAI";
      };
    }
  }, [activeAlarm]);

  // Main Background Interval: Checks every 5 seconds
  useEffect(() => {
    const checkSchedule = () => {
      try {
        const currentList = getStoredReminders();
        if (!Array.isArray(currentList) || currentList.length === 0) return;

        const currentTimeStr = getCurrentTimeStr();
        const todayStr = getTodayDateStr();

        for (const reminder of currentList) {
          if (reminder.completedToday && reminder.lastCompletedDate === todayStr) {
            continue;
          }

          const triggerKey = `${reminder.id}_${todayStr}_${reminder.time}`;

          if (reminder.time === currentTimeStr && !lastTriggeredRef.current[triggerKey]) {
            lastTriggeredRef.current[triggerKey] = true;

            setActiveAlarm(reminder);

            const timeFormatted = formatTime12h(reminder.time);
            const notifTitle = `⏰ Medication Reminder: ${reminder.title}`;
            const notifBody = `It's ${timeFormatted}. ${reminder.notes || `Time for your scheduled ${reminder.type}.`}`;
            showDesktopNotification(notifTitle, notifBody);

            toast.warning(notifTitle, {
              description: notifBody,
              duration: 20000,
              action: {
                label: "Take Now",
                onClick: () => {
                  handleMarkTaken(reminder);
                },
              },
            });

            break;
          }
        }
      } catch (err) {
        console.error("Reminder check failed:", err);
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 5000);
    return () => clearInterval(interval);
  }, [reminders, handleMarkTaken]);

  if (!activeAlarm) return null;

  const timeFormatted = formatTime12h(activeAlarm.time);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-card border-2 border-primary/40 rounded-3xl shadow-2xl p-6 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <BellRing className="h-6 w-6 animate-bounce text-primary" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                Alarm Ringing Now
              </span>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Time for your {activeAlarm.type}
              </h2>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground rounded-full p-1.5 hover:bg-muted transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reminder Details Box */}
        <div className="my-5 p-4 rounded-2xl bg-muted/50 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeAlarm.type === "medication" && <Pill className="h-4 w-4 text-primary" />}
              {activeAlarm.type === "appointment" && <Calendar className="h-4 w-4 text-amber-500" />}
              {activeAlarm.type === "general" && <Activity className="h-4 w-4 text-green-500" />}
              <span className="font-semibold text-lg text-foreground">{activeAlarm.title}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-background rounded-xl border border-border shadow-2xs font-mono font-bold text-sm text-primary">
              <Clock className="h-3.5 w-3.5" />
              {timeFormatted}
            </div>
          </div>

          {activeAlarm.notes ? (
            <p className="text-xs text-muted-foreground bg-background/80 p-2.5 rounded-xl border border-border/60">
              <span className="font-medium text-foreground">Instructions:</span> {activeAlarm.notes}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Please take your scheduled dose as prescribed by your doctor.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            size="lg"
            variant="default"
            onClick={() => handleMarkTaken(activeAlarm)}
            className="col-span-2 bg-green-600 hover:bg-green-700 text-white font-semibold shadow-md gap-2 h-12 rounded-xl text-base"
          >
            <Check className="h-5 w-5 stroke-[2.5]" />
            Mark as Taken
          </Button>

          <Button
            size="default"
            variant="outline"
            onClick={() => handleSnooze(activeAlarm)}
            className="gap-1.5 rounded-xl"
          >
            <Clock className="h-4 w-4" />
            Snooze 5 Min
          </Button>

          <Button
            size="default"
            variant="secondary"
            onClick={handleDismiss}
            className="gap-1.5 rounded-xl"
          >
            <X className="h-4 w-4" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
