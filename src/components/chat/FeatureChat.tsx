"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2, StopCircle, LucideIcon, Download, Upload, CheckCircle, FileImage } from "lucide-react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { fetchAIStream, SystemPromptType } from "@/services/ai";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  timeStr?: string;
}

interface FeatureChatProps {
  title: string;
  description: string;
  icon: LucideIcon;
  promptType: SystemPromptType;
  placeholder?: string;
  suggestedPrompts: string[];
}

function processImageFile(file: File, callback: (base64: string) => void) {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1400;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL("image/jpeg", 0.88));
      } else {
        callback(e.target?.result as string);
      }
    };
    img.onerror = () => {
      callback(e.target?.result as string);
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export function FeatureChat({
  title,
  description,
  icon: Icon,
  promptType,
  placeholder = "Type your message...",
  suggestedPrompts
}: FeatureChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load from localStorage first, then sync with database for multi-device persistence
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(async () => {
      let initialMessages: Message[] = [];
      const saved = localStorage.getItem(`chat_history_${promptType}`);
      if (saved) {
        try {
          initialMessages = JSON.parse(saved);
        } catch {
          // ignore corrupt data
        }
      }
      if (isMounted && initialMessages.length > 0) {
        setMessages(initialMessages);
      }
      setIsInitialized(true);

      // Fetch cloud history for logged-in user (syncs from another device)
      try {
        const res = await fetch(`/api/chat/save?promptType=${promptType}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.messages) && data.messages.length > 0) {
            // If local storage was empty (e.g. new phone or fresh browser), hydrate from cloud
            if (initialMessages.length === 0 || data.messages.length >= initialMessages.length) {
              setMessages(data.messages);
              localStorage.setItem(`chat_history_${promptType}`, JSON.stringify(data.messages));
            }
          }
        }
      } catch (err) {
        // Offline or unauthenticated fallback
        console.warn("Could not sync cloud chat history:", err);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [promptType]);

  // Persist messages to both local storage and database
  useEffect(() => {
    if (!isInitialized) return;

    // Fast local save (never store large base64 images in localStorage)
    const toStore = messages.map(m => ({ ...m, image: undefined }));
    localStorage.setItem(`chat_history_${promptType}`, JSON.stringify(toStore));

    // When message stream finishes and messages exist, sync to database
    if (!isTyping && messages.length > 0) {
      const syncTimer = setTimeout(() => {
        fetch("/api/chat/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: toStore,
            promptType,
            title: `${title} Consultation`
          })
        }).catch(() => {});
      }, 500);

      return () => clearTimeout(syncTimer);
    }
  }, [messages, promptType, isInitialized, isTyping, title]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, (optimizedBase64) => {
        setSelectedImage(optimizedBase64);
      });
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.indexOf("image") === 0) {
          const file = item.getAsFile();
          if (file) {
            processImageFile(file, (optimizedBase64) => {
              setSelectedImage(optimizedBase64);
            });
            e.preventDefault();
            break;
          }
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file, (optimizedBase64) => {
        setSelectedImage(optimizedBase64);
      });
    }
  };

  const handleSend = useCallback(async (text: string, image?: string | null) => {
    if (!text.trim() && !image) return;

    // Generate unique IDs using crypto.randomUUID() — pure and stable, not Date.now()
    const userMsgId = crypto.randomUUID();
    const aiMsgId = crypto.randomUUID();
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const userMsg: Message = {
      id: userMsgId,
      role: "user",
      content: text,
      image: image || undefined,
      timeStr: now
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setSelectedImage(null);
    setIsTyping(true);

    setMessages(prev => [...prev, { id: aiMsgId, role: "assistant", content: "", timeStr: now }]);

    abortControllerRef.current = new AbortController();

    try {
      // Capture snapshot of history before the new messages
      const history = messages.map(m => ({ role: m.role, content: m.content, image: m.image }));
      await fetchAIStream(
        promptType,
        text,
        image || undefined,
        (chunk) => {
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
          ));
        },
        history,
        abortControllerRef.current.signal
      );
    } catch (error: unknown) {
      const err = error as Error;
      if (err.name === "AbortError") {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: m.content + " [Stopped by user]" } : m
        ));
      } else {
        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, content: m.content + "\n\n*Sorry, I encountered an error connecting to the AI. Please try again.*" } : m
        ));
      }
    } finally {
      setIsTyping(false);
    }
  }, [messages, promptType]);

  const handleClear = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setMessages([]);
    localStorage.removeItem(`chat_history_${promptType}`);
    fetch(`/api/chat/save?promptType=${promptType}`, { method: "DELETE" }).catch(() => {});
  };

  const handleExport = () => {
    if (messages.length === 0) return;
    const textContent = messages.map(m => `${m.role === "user" ? "You" : "HealthAI"}: ${m.content}`).join("\n\n");
    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HealthAI-${promptType}-chat.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = useCallback(() => {
    if (messages.length < 2 || isTyping) return;

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIndex = i;
        break;
      }
    }

    if (lastUserIndex === -1) return;

    const lastUserMessage = messages[lastUserIndex];
    const newMessages = messages.slice(0, lastUserIndex);
    setMessages(newMessages);

    setTimeout(() => {
      handleSend(lastUserMessage.content, lastUserMessage.image);
    }, 50);
  }, [messages, isTyping, handleSend]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-[calc(100vh-60px)] w-full max-w-4xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-muted-foreground text-sm">{description}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={messages.length === 0 || isTyping}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={messages.length === 0 || isTyping}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      <div
        className="flex-1 overflow-hidden flex flex-col bg-card rounded-2xl border border-border shadow-sm relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-background/85 backdrop-blur-xs border-2 border-dashed border-primary rounded-2xl z-30 flex flex-col items-center justify-center p-6 text-center pointer-events-none animate-in fade-in-50">
            <div className="p-4 bg-primary/10 rounded-full text-primary mb-3 animate-bounce">
              <Upload className="h-8 w-8" />
            </div>
            <p className="font-semibold text-base">Drop your lab report image here</p>
            <p className="text-xs text-muted-foreground mt-1">Our AI will automatically read and analyze all clinical parameters</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
          {!isInitialized ? (
            <div className="h-full flex items-center justify-center opacity-50">
              <span className="text-sm">Loading history...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-80 mt-6">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">How can I help with {title.toLowerCase()}?</h2>
              <p className="text-xs text-muted-foreground max-w-md">
                {promptType === "lab"
                  ? "Upload a photo or screenshot of your lab report to transcribe and evaluate your results, or choose a prompt below."
                  : description}
              </p>

              {promptType === "lab" && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 mb-4 w-full max-w-md p-5 border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-2 group"
                >
                  <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-sm">Upload Lab Report or Test Photo</p>
                  <p className="text-xs text-muted-foreground text-center">Click or drag & drop blood test, lipid panel, or metabolic report</p>
                </button>
              )}

              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {suggestedPrompts.map(prompt => (
                  <Button
                    key={prompt}
                    variant="secondary"
                    size="sm"
                    className="rounded-full text-xs"
                    onClick={() => handleSend(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col pb-4">
              {messages.map((m, index) => (
                <ChatBubble
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  image={m.image}
                  timeStr={m.timeStr}
                  isStreaming={isTyping && index === messages.length - 1 && m.role === "assistant"}
                  onRegenerate={(!isTyping && m.role === "assistant" && index === messages.length - 1) ? handleRegenerate : undefined}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-4 bg-background border-t">
          {selectedImage && (
            <div className="mb-3 flex items-center gap-3 p-2 bg-muted/60 rounded-xl border border-border w-fit max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedImage} alt="Preview" className="h-14 w-14 object-cover rounded-lg border shadow-xs shrink-0" />
              <div className="flex flex-col pr-2 min-w-0">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {promptType === "lab" ? "Lab Report Attached" : "Image Attached"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  Ready. Click Send or type questions below.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-muted-foreground hover:text-destructive p-1 rounded-full hover:bg-muted ml-auto cursor-pointer"
                title="Remove image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input, selectedImage); }}
            className="relative flex items-center"
          >
            <label
              title="Attach medical image or lab report"
              className="absolute left-2 text-muted-foreground hover:text-primary cursor-pointer p-2 rounded-full hover:bg-muted transition-colors"
            >
              <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isTyping} />
              <FileImage className="h-5 w-5" />
            </label>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              placeholder={selectedImage ? "Add questions about this report (or press Enter to analyze)..." : placeholder}
              className="pl-12 pr-12 py-6 rounded-full bg-muted/50 focus-visible:ring-1"
              disabled={isTyping}
            />
            {isTyping ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 rounded-full h-10 w-10 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setIsTyping(false);
                  if (abortControllerRef.current) abortControllerRef.current.abort();
                }}
              >
                <StopCircle className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                className="absolute right-2 rounded-full h-10 w-10"
                disabled={(!input.trim() && !selectedImage)}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
