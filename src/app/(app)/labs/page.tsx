"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { FileText } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "My Hemoglobin is 11.5 g/dL. Is that normal?",
  "What does a high TSH level mean?",
  "My LDL cholesterol is 150. What should I do?",
];

export default function LabsPage() {
  return (
    <FeatureChat
      title="Lab Report Analyzer"
      description="Enter your lab results to understand what they mean."
      icon={FileText}
      promptType="lab"
      suggestedPrompts={SUGGESTED_PROMPTS}
      placeholder="E.g., My Fasting Blood Sugar is 110 mg/dL..."
    />
  );
}
