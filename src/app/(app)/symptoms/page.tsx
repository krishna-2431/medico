"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { Activity } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "I have a headache and a mild fever since yesterday.",
  "My stomach hurts after eating dairy.",
  "I've been feeling very fatigued lately.",
];

export default function SymptomsPage() {
  return (
    <FeatureChat
      title="Symptom Checker"
      description="Describe your symptoms to get potential insights."
      icon={Activity}
      promptType="symptom"
      suggestedPrompts={SUGGESTED_PROMPTS}
      placeholder="E.g., I have a persistent cough and sore throat..."
    />
  );
}
