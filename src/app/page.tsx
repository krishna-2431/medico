"use client";

import { motion } from "framer-motion";
import { ArrowRight, HeartPulse, Zap, Stethoscope, Clock } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: <HeartPulse className="h-6 w-6 text-primary" />,
    title: "AI Symptom Checker",
    description: "Get instant, personalized medical insights based on your symptoms.",
  },
  {
    icon: <Stethoscope className="h-6 w-6 text-primary" />,
    title: "Doctor Recommendations",
    description: "Find the right specialist for your condition instantly.",
  },
  {
    icon: <Clock className="h-6 w-6 text-primary" />,
    title: "Smart Reminders",
    description: "Never miss a pill or appointment with our intelligent timeline.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold tracking-tight">HealthAI</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition">Features</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition">How it Works</Link>
            <Link href="#testimonials" className="hover:text-foreground transition">Testimonials</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:inline-flex text-sm font-medium hover:text-foreground transition">Sign In</Link>
            <Link href="/register" className="inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 h-8 gap-1.5 px-2.5 bg-primary text-primary-foreground hover:bg-primary/80 rounded-full shadow-lg">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              <Zap className="mr-2 h-4 w-4" />
              Powered by Advanced OpenRouter AI
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold tracking-tight text-foreground"
            >
              Your Personal <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                Healthcare Assistant
              </span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl text-muted-foreground leading-relaxed"
            >
              Experience the future of healthcare. Get instant symptom analysis, analyze lab reports, and manage your health seamlessly with AI.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <Link href="/register" className="inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/80 rounded-full h-14 px-8 text-base shadow-xl">
                  Start Your Journey <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </motion.div>
          </div>

          {/* AI Preview Window */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-20 relative max-w-5xl mx-auto"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 bottom-0 h-40 top-auto" />
            <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden relative z-0">
              <div className="h-12 border-b border-border flex items-center px-4 bg-muted/30">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
              </div>
              <div className="p-8 pb-20 grid md:grid-cols-3 gap-8">
                {features.map((feature, i) => (
                  <div key={i} className="flex flex-col gap-3 p-6 rounded-2xl bg-background border border-border shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
