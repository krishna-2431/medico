"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, MessageSquare, Pill, Stethoscope, Clock, ShieldAlert, Calendar } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { useSyncExternalStore } from "react";
import {
  formatTime12h,
  subscribeToReminders,
  getRemindersClientSnapshot,
  getRemindersServerSnapshot,
} from "@/lib/reminders";

const QUICK_ACTIONS = [
  { name: "Symptom Checker", icon: Activity, href: "/symptoms", color: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400" },
  { name: "Chat with AI", icon: MessageSquare, href: "/chat", color: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400" },
  { name: "Medicine Info", icon: Pill, href: "/medicine", color: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400" },
  { name: "Find Doctor", icon: Stethoscope, href: "/doctors", color: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400" },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const emptySubscribe = () => () => {};

export default function DashboardPage() {
  const { data: session } = useSession();
  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const rawReminders = useSyncExternalStore(
    subscribeToReminders,
    getRemindersClientSnapshot,
    getRemindersServerSnapshot
  );

  const reminders = isMounted ? rawReminders : [];

  // Derive display name: use session name, or email prefix, or fallback
  const displayName = session?.user?.name
    || session?.user?.email?.split("@")[0]
    || "there";

  const todayReminders = reminders.slice(0, 3);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Greeting */}
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()}, <span className="text-primary capitalize">{displayName}</span> 👋
        </h1>
        <p className="text-muted-foreground">Here is your health overview for today.</p>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <motion.div key={action.name} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href={action.href}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
                    <div className={`p-3 rounded-full ${action.color}`}>
                      <action.icon className="h-6 w-6" />
                    </div>
                    <span className="font-medium text-sm">{action.name}</span>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Dashboard Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Upcoming Reminders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Upcoming Reminders
            </CardTitle>
            <CardDescription>Your schedule for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayReminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No reminders set yet.</p>
                <Link href="/reminders">
                  <Button variant="outline" size="sm" className="mt-3">
                    Add Your First Reminder
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                {todayReminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        reminder.type === "medication"
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                          : reminder.type === "appointment"
                          ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                          : "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400"
                      }`}>
                        {reminder.type === "medication" ? <Pill className="h-5 w-5" /> : <Stethoscope className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{reminder.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{reminder.type}</p>
                      </div>
                    </div>
                    <p className="font-bold text-sm bg-muted px-2.5 py-1 rounded-md">{formatTime12h(reminder.time)}</p>
                  </div>
                ))}
                <Link href="/reminders" className="inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 h-8 gap-1.5 px-2.5 hover:bg-muted aria-expanded:bg-muted dark:hover:bg-muted/50 w-full text-sm text-primary font-medium rounded-lg">
                  View All Reminders →
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Emergency & AI Quick Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Emergency
            </CardTitle>
            <CardDescription>In case of a medical emergency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">🚨 Emergency?</p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80">
                If you have a medical emergency, call <strong>112 / 911</strong> or your local emergency number immediately.
              </p>
            </div>
            <Link href="/emergency">
              <Button variant="destructive" size="sm" className="w-full gap-2">
                <ShieldAlert className="h-4 w-4" />
                Open Emergency Assistant
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="outline" size="sm" className="w-full">
                Ask AI Health Question
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
