"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { ShieldAlert } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "I have severe chest pain that's spreading to my arm.",
  "I'm feeling very dizzy and having trouble speaking.",
  "What should I do for a deep cut that won't stop bleeding?",
];

export default function EmergencyPage() {
  return (
    <FeatureChat
      title="Emergency Assistant"
      description="Assess critical symptoms. IF YOU HAVE A MEDICAL EMERGENCY, CALL 911 OR YOUR LOCAL EMERGENCY NUMBER IMMEDIATELY."
      icon={ShieldAlert}
      promptType="emergency"
      suggestedPrompts={SUGGESTED_PROMPTS}
      placeholder="Describe the emergency..."
    />
  );
}
