"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Shield, Download, Moon, Sun, Trash2, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSession, signOut } from "next-auth/react";

const CHAT_KEYS = [
  "chat_history_symptom",
  "chat_history_medicine",
  "chat_history_lab",
  "chat_history_doctor",
  "chat_history_tips",
  "chat_history_emergency",
  "chat_history_chat",
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  const { data: session } = useSession();

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", newTheme);
    toast.success(`Switched to ${newTheme} mode`);
  };

  const handleExportData = () => {
    const exportData: Record<string, unknown> = {};
    exportData.reminders = JSON.parse(localStorage.getItem("health_reminders") || "[]");
    CHAT_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) exportData[key] = JSON.parse(val);
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "healthai_data_export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("All data exported successfully!");
  };

  const handleClearData = () => {
    if (confirm("Are you sure you want to clear ALL your local data including all chat histories and reminders? This cannot be undone.")) {
      // Clear reminders
      localStorage.removeItem("health_reminders");
      // Clear ALL chat histories — not just one
      CHAT_KEYS.forEach(key => localStorage.removeItem(key));
      toast.success("All local data cleared completely.");
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your preferences and account settings.</p>
      </div>

      <div className="grid gap-6">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profile Information
            </CardTitle>
            <CardDescription>Your account details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input value={session?.user?.email || "Not signed in"} readOnly type="email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Display Name</label>
              <Input value={session?.user?.name || ""} readOnly placeholder="Set via registration" />
            </div>
            <p className="text-xs text-muted-foreground">
              Profile editing is managed through account settings. Sign out and re-register to change credentials.
            </p>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === "light" ? <Sun className="h-5 w-5 text-primary" /> : <Moon className="h-5 w-5 text-primary" />}
              Appearance
            </CardTitle>
            <CardDescription>Manage how the app looks.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Currently: <span className="font-semibold capitalize">{theme}</span> mode
                </p>
              </div>
              <Button variant="outline" onClick={toggleTheme} className="gap-2">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                Switch to {theme === "light" ? "Dark" : "Light"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Data &amp; Privacy
            </CardTitle>
            <CardDescription>Manage your locally stored health data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" className="flex-1" onClick={handleExportData}>
                <Download className="h-4 w-4 mr-2" /> Export All Data
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleClearData}>
                <Trash2 className="h-4 w-4 mr-2" /> Clear All Local Data
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clearing data removes all reminders and chat histories from this browser. AI prompts are sent securely to OpenRouter for processing and are not stored on our servers.
            </p>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="h-5 w-5" />
              Sign Out
            </CardTitle>
            <CardDescription>End your current session securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out of HealthAI
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
