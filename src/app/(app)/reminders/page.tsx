"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Clock,
  Plus,
  Trash2,
  Pill,
  Activity,
  Calendar,
  Bell,
  BellRing,
  Volume2,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Reminder,
  playReminderChime,
  requestNotificationPermission,
  showDesktopNotification,
  formatTime12h,
  getStoredReminders,
  saveStoredReminders,
  deleteStoredReminder,
  getCurrentTimeStr,
  getTodayDateStr,
  unlockAudio,
  subscribeToReminders,
  getRemindersClientSnapshot,
  getRemindersServerSnapshot,
} from "@/lib/reminders";

const emptySubscribe = () => () => {};

export default function RemindersPage() {
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const rawReminders = useSyncExternalStore(
    subscribeToReminders,
    getRemindersClientSnapshot,
    getRemindersServerSnapshot
  );

  const todayStr = getTodayDateStr();
  const reminders = isMounted
    ? rawReminders.map(r => {
        if (r.completedToday && r.lastCompletedDate && r.lastCompletedDate !== todayStr) {
          return { ...r, completedToday: false };
        }
        return r;
      })
    : [];

  const [permissionVersion, setPermissionVersion] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newType, setNewType] = useState<Reminder["type"]>("medication");
  const [newNotes, setNewNotes] = useState("");
  const [currentTime12, setCurrentTime12] = useState("");
  const [currentTime24, setCurrentTime24] = useState("");

  const notificationPermission = isMounted && typeof window !== "undefined" && "Notification" in window
    ? (permissionVersion ? Notification.permission : Notification.permission)
    : "default";

  // Keep live clock updated every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime12(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
      );
      const h24 = String(now.getHours()).padStart(2, "0");
      const m24 = String(now.getMinutes()).padStart(2, "0");
      const s24 = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime24(`${h24}:${m24}:${s24}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestPermission = async () => {
    unlockAudio();
    const result = await requestNotificationPermission();
    setPermissionVersion(v => v + 1);
    if (result === "granted") {
      toast.success("Desktop popups enabled! You'll receive system alerts even when away.");
    } else {
      toast.error("Notification permission denied. In-app alarms and audio chimes remain active.");
    }
  };

  const handleTestAlert = () => {
    unlockAudio();
    playReminderChime();
    showDesktopNotification("🔔 Test Reminder Alarm", "Audio chime and notification are working perfectly!");
    toast.info("🔔 Test Reminder Alarm", {
      description: "Audio chime and notification system are working properly!",
      duration: 5000,
    });
  };

  const handleSetQuickTime = (minutesAhead: number) => {
    unlockAudio();
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutesAhead);
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const timeVal = `${h}:${m}`;
    setNewTime(timeVal);
    toast.success(`Set time to ${formatTime12h(timeVal)} (${minutesAhead}m from now)`);
  };

  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTime) return;

    unlockAudio();

    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      time: newTime,
      type: newType,
      notes: newNotes.trim() || undefined,
      completedToday: false,
    };

    const currentList = getStoredReminders();
    const updated = [...currentList, newReminder].sort((a, b) => a.time.localeCompare(b.time));
    saveStoredReminders(updated);

    setNewTitle("");
    setNewTime("");
    setNewNotes("");

    const displayTime = formatTime12h(newReminder.time);
    toast.success(`Scheduled alarm for "${newReminder.title}" at ${displayTime}!`);
  };

  const handleToggleComplete = (id: string) => {
    const currentList = getStoredReminders();
    const updated = currentList.map(r => {
      if (r.id === id) {
        const nextState = !r.completedToday;
        if (nextState) {
          toast.success(`Marked "${r.title}" as taken today!`);
        }
        return {
          ...r,
          completedToday: nextState,
          lastCompletedDate: nextState ? todayStr : undefined,
        };
      }
      return r;
    });
    saveStoredReminders(updated);
  };

  const handleDelete = (id: string) => {
    const target = reminders.find(r => r.id === id);
    deleteStoredReminder(id);
    if (target) {
      toast.info(`Deleted reminder for "${target.title}"`);
    }
  };

  const getIcon = (type: string) => {
    if (type === "medication") return <Pill className="h-5 w-5" />;
    if (type === "appointment") return <Calendar className="h-5 w-5" />;
    return <Activity className="h-5 w-5" />;
  };

  const getColor = (type: string) => {
    if (type === "medication") return "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400";
    if (type === "appointment") return "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400";
    return "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400";
  };

  const currentHHMM = getCurrentTimeStr();
  const overdueReminders = isMounted
    ? reminders.filter(r => !r.completedToday && r.time < currentHHMM)
    : [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Header & Live Device Time */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Medication & Health Reminders</h1>
          <p className="text-muted-foreground text-sm">
            Set alarms for medicines, water, and clinic visits with automated audio & desktop alerts.
          </p>
        </div>
        {isMounted && currentTime12 && (
          <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-2xl shadow-xs w-fit text-sm">
            <Clock className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-muted-foreground text-xs">Device Time:</span>
            <span className="font-mono font-bold text-foreground">{currentTime12}</span>
            <span className="text-[11px] font-mono text-muted-foreground">({currentTime24.slice(0, 5)})</span>
          </div>
        )}
      </div>

      {/* Overdue Alert Banner if Any */}
      {isMounted && overdueReminders.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 animate-bounce" />
            <div>
              <p className="text-sm font-bold">
                {overdueReminders.length} Overdue Dose{overdueReminders.length > 1 ? "s" : ""} Today
              </p>
              <p className="text-xs text-muted-foreground">
                {overdueReminders.map(r => `${r.title} (${formatTime12h(r.time)})`).join(", ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const currentList = getStoredReminders();
                const updated = currentList.map(r =>
                  r.time < currentHHMM ? { ...r, completedToday: true, lastCompletedDate: todayStr } : r
                );
                saveStoredReminders(updated);
                toast.success("Marked all overdue doses as taken!");
              }}
              className="text-xs h-8 bg-background border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Mark All as Taken
            </Button>
          </div>
        </div>
      )}

      {/* Alert Banner / Notification Controls */}
      <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
            {isMounted && notificationPermission === "granted" ? (
              <BellRing className="h-5 w-5 text-green-600 dark:text-green-400" />
            ) : (
              <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Automated Alarm Engine</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                  isMounted && notificationPermission === "granted"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {isMounted && notificationPermission === "granted" ? "Desktop & Audio Active" : "In-App Audio Active"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alarms automatically chime and pop up when the reminder time arrives.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(!isMounted || notificationPermission !== "granted") && (
            <Button size="sm" variant="outline" onClick={handleRequestPermission}>
              <Bell className="h-4 w-4 mr-1.5" />
              Enable Desktop Popups
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleTestAlert}>
            <Volume2 className="h-4 w-4 mr-1.5" />
            Test Sound & Alert
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Add Reminder Card */}
        <Card className="md:col-span-1 h-fit shadow-xs">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Add Reminder
            </CardTitle>
            <CardDescription>Schedule a dose or medical alert</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddReminder} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Medicine / Task Title
                </label>
                <Input
                  placeholder="e.g. Metformin 500mg, Eye Drops"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Time (24h or AM/PM)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetQuickTime(1)}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      +1 min (Test)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetQuickTime(2)}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      +2 min
                    </button>
                  </div>
                </div>
                <Input
                  type="time"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  required
                />
                {newTime && (
                  <p className="text-xs font-medium text-primary">
                    Selected: {formatTime12h(newTime)} ({newTime})
                  </p>
                )}
                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setNewTime("08:00")}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground font-medium cursor-pointer"
                  >
                    08:00 AM (Morning)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTime("13:00")}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground font-medium cursor-pointer"
                  >
                    01:00 PM (Afternoon)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTime("20:00")}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground font-medium cursor-pointer"
                  >
                    08:00 PM (Night)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={newType}
                  onChange={e => setNewType(e.target.value as Reminder["type"])}
                >
                  <option value="medication">Medication</option>
                  <option value="appointment">Doctor Appointment</option>
                  <option value="general">General (Water, Walk)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Dosage / Instructions (Optional)
                </label>
                <Input
                  placeholder="e.g. 1 tablet after lunch with water"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full mt-2 h-11 text-sm font-semibold">
                <Plus className="h-4 w-4 mr-1.5" /> Schedule Reminder
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Schedule List */}
        <Card className="md:col-span-2 shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Your Daily Schedule
                </CardTitle>
                <CardDescription>
                  {!isMounted
                    ? "Loading schedule..."
                    : reminders.length === 0
                    ? "No reminders scheduled yet"
                    : `${reminders.length} reminder${reminders.length > 1 ? "s" : ""} scheduled`}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!isMounted ? (
              <div className="py-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 animate-spin text-primary" />
                Loading your schedule...
              </div>
            ) : reminders.length === 0 ? (
              <div className="text-center p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
                  <Bell className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-base mb-1">No Reminders Yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Add your prescription or appointment schedule on the left to receive timely audio alarms and alerts.
                </p>
                <Button size="sm" variant="outline" onClick={() => handleSetQuickTime(1)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Try a 1-Minute Test Reminder
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {reminders.map(reminder => {
                  const isOverdue = !reminder.completedToday && reminder.time < currentHHMM;
                  return (
                    <div
                      key={reminder.id}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        reminder.completedToday
                          ? "bg-muted/40 border-border opacity-70"
                          : isOverdue
                          ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50"
                          : "bg-card border-border hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(reminder.id)}
                          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            reminder.completedToday
                              ? "bg-green-600 text-white shadow-xs"
                              : `${getColor(reminder.type)} hover:ring-2 hover:ring-primary/40`
                          }`}
                          title={reminder.completedToday ? "Mark as pending" : "Mark as taken today"}
                        >
                          {reminder.completedToday ? (
                            <Check className="h-5 w-5 stroke-[2.5]" />
                          ) : (
                            getIcon(reminder.type)
                          )}
                        </button>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p
                              className={`font-semibold text-sm truncate ${
                                reminder.completedToday ? "line-through text-muted-foreground" : ""
                              }`}
                            >
                              {reminder.title}
                            </p>
                            {reminder.completedToday && (
                              <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded-full font-semibold">
                                Taken Today
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {reminder.notes || (
                              <span className="capitalize">{reminder.type} schedule</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-sm bg-muted/80 px-2.5 py-1 rounded-lg">
                            {formatTime12h(reminder.time)}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                            {reminder.time} 24h
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            unlockAudio();
                            playReminderChime();
                            toast.info(`🔔 Alarm chime for "${reminder.title}" (${formatTime12h(reminder.time)})`);
                          }}
                          className="text-muted-foreground hover:text-primary h-8 w-8"
                          title="Test chime sound"
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(reminder.id)}
                          className="text-muted-foreground hover:text-destructive h-8 w-8"
                          title="Delete reminder"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
