"use client";

import { FeatureChat } from "@/components/chat/FeatureChat";
import { MessageSquare } from "lucide-react";

const SUGGESTED_PROMPTS = [
  "What are the early signs of a cold?",
  "How can I improve my sleep quality?",
  "What should I eat for better heart health?",
];

export default function ChatPage() {
  return (
    <FeatureChat
      title="AI Assistant"
      description="Ask any health-related questions."
      icon={MessageSquare}
      promptType="chat"
      suggestedPrompts={SUGGESTED_PROMPTS}
    />
  );
}
