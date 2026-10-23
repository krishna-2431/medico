"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, RefreshCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  image?: string;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  timeStr?: string;
}

export function ChatBubble({ role, content, image, isStreaming, onRegenerate, timeStr }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const isUser = role === "user";

  const DOCTOR_IMAGES = [
    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=200&h=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?q=80&w=200&h=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1594824436998-d8869c414169?q=80&w=200&h=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=200&h=200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1537368910025-700350fe46c7?q=80&w=200&h=200&auto=format&fit=crop"
  ];

  return (
    <div className={cn("flex gap-4 w-full mb-6 group font-chat", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="h-8 w-8 mt-1 shrink-0">
        {isUser ? (
          <>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>U</AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">AI</AvatarFallback>
        )}
      </Avatar>

      <div className={cn(
        "flex flex-col gap-2 max-w-[85%] md:max-w-[75%]",
        isUser ? "items-end" : "items-start"
      )}>
        <div className={cn(
          "px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border rounded-tl-sm"
        )}>
          {isUser ? (
            <div className="whitespace-pre-wrap">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="User upload" className="max-w-full rounded-lg mb-2 max-h-64 object-contain" />
              )}
              {content || (image ? "Please analyze this attached report." : "")}
            </div>
          ) : (
            isStreaming && content.length === 0 ? (
              <div className="flex gap-2 items-center h-6 px-1 text-xs text-muted-foreground">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                <span className="ml-1 text-xs font-medium animate-pulse">Reading report and analyzing clinical values...</span>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-pre:border-border">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ src, alt, ...props }) => {
                      // Compute a stable hash from the alt or src string to pick a doctor image
                      const str = String(alt || src || "");
                      let hash = 0;
                      for (let i = 0; i < str.length; i++) {
                        hash = str.charCodeAt(i) + ((hash << 5) - hash);
                      }
                      const finalSrc = DOCTOR_IMAGES[Math.abs(hash) % DOCTOR_IMAGES.length];

                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          {...props}
                          src={finalSrc}
                          alt={alt}
                          className="w-16 h-16 rounded-full object-cover shadow-sm border-2 border-primary/10 inline-block mr-4 mb-2 align-middle"
                        />
                      );
                    },
                    a: ({ ...props }) => {
                      const text = props.children?.toString().toLowerCase() || "";
                      if (text.includes("book") || text.includes("appointment")) {
                        return (
                          <a {...props} className="inline-block mt-2 mb-2 px-4 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-full text-xs font-semibold transition-colors cursor-pointer no-underline" target="_blank" />
                        );
                      }
                      return <a {...props} className="text-primary font-medium hover:underline" target="_blank" />;
                    }
                  }}
                >
                  {content}
                </ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
            )
          )}
        </div>

        {/* Actions for Assistant Messages */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleCopy} title="Copy">
              {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
            </Button>
            {onRegenerate && (
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={onRegenerate} title="Regenerate">
                <RefreshCcw className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
            {timeStr && (
              <span className="text-[10px] text-muted-foreground ml-2">
                {timeStr}
              </span>
            )}
          </div>
        )}

        {/* Timestamp for User Messages */}
        {isUser && timeStr && (
          <span className="text-[10px] text-muted-foreground mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {timeStr}
          </span>
        )}
      </div>
    </div>
  );
}
