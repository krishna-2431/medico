"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { HeartPulse } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What is a healthy morning routine?",
  "How can I manage work-related stress?",
  "Give me tips for better posture at my desk.",
];

export default function TipsPage() {
  return (
    <FeatureChat
      title="Health Tips"
      description="Get personalized health, wellness, and lifestyle tips."
      icon={HeartPulse}
      promptType="tips"
      suggestedPrompts={SUGGESTED_PROMPTS}
      placeholder="E.g., How can I stay hydrated during winter?"
    />
  );
}
