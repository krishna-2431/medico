"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { Pill } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What are the side effects of Ibuprofen?",
  "Can I take Paracetamol on an empty stomach?",
  "How does Amoxicillin work?",
];

export default function MedicinePage() {
  return (
    <FeatureChat
      title="Medicine Info"
      description="Ask about uses, dosages, and side effects of medications."
      icon={Pill}
      promptType="medicine"
      suggestedPrompts={SUGGESTED_PROMPTS}
      placeholder="E.g., What should I know about taking Aspirin?"
    />
  );
}
