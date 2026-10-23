"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { Stethoscope } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What specialist should I see for chronic back pain?",
  "I have a persistent skin rash, who should I consult?",
  "What does an endocrinologist do?",
];

export default function DoctorsPage() {
  return (
    <FeatureChat
      title="Find a Doctor"
      description="Get recommendations for which medical specialist to consult."
      icon={Stethoscope}
      promptType="doctor"
      suggestedPrompts={SUGGESTED_PROMPTS}
      placeholder="E.g., I have blurry vision and frequent headaches..."
    />
  );
}
