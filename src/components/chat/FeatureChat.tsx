"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Trash2,
  StopCircle,
  LucideIcon,
  Download,
  Upload,
  CheckCircle,
  FileImage,
  Plus,
  History,
  MessageSquare,
  Clock,
  ChevronRight,
  PanelLeftClose,
  PanelLeft
} from "lucide-react";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { fetchAIStream, SystemPromptType } from "@/services/ai";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  timeStr?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  type: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface FeatureChatProps {
  title: string;
  description: string;
  icon: LucideIcon;
  promptType: SystemPromptType;
  placeholder?: string;
  suggestedPrompts: string[];
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
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

  // Load messages for a specific session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setIsLoadingSession(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.session && Array.isArray(data.session.messages)) {
          setMessages(data.session.messages);
        }
      }
    } catch (err) {
      console.warn("Failed to load session messages:", err);
    } finally {
      setIsLoadingSession(false);
      setIsInitialized(true);
    }
  }, []);

  const initialMountDoneRef = useRef(false);

  // Refresh sessions list (e.g. after a message is saved)
  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/sessions?type=${promptType}`);
      if (res.ok) {
        const data = await res.json();
        const loadedSessions: ChatSession[] = data.sessions || [];
        setSessions(loadedSessions);
        return loadedSessions;
      }
    } catch (err) {
      console.warn("Could not load chat sessions:", err);
    }
    return [];
  }, [promptType]);

  // Initial mount: load sessions and select first session if available
  useEffect(() => {
    let isMounted = true;
    initialMountDoneRef.current = false;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/chat/sessions?type=${promptType}`);
        if (!isMounted) return;
        if (res.ok) {
          const data = await res.json();
          const loadedSessions: ChatSession[] = data.sessions || [];
          setSessions(loadedSessions);

          // Only select first session on cold page load
          if (!initialMountDoneRef.current && loadedSessions.length > 0) {
            initialMountDoneRef.current = true;
            const firstId = loadedSessions[0].id;
            setActiveSessionId(firstId);
            loadSessionMessages(firstId);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to load initial sessions:", err);
      } finally {
        if (isMounted) setIsInitialized(true);
      }
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [promptType, loadSessionMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Start a fresh, clean ChatGPT-style session
  const handleNewChat = () => {
    if (isTyping && abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }
    abortControllerRef.current = null;
    setIsTyping(false);
    setActiveSessionId(null);
    setMessages([]);
    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Switch to an existing session
  const handleSelectSession = (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    if (isTyping && abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }
    abortControllerRef.current = null;
    setIsTyping(false);
    setActiveSessionId(sessionId);
    loadSessionMessages(sessionId);
    setInput("");
    setSelectedImage(null);
  };

  // Delete a specific session
  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

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
    e.stopPropagation();
    if (promptType === "lab" && !isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file, (optimizedBase64) => {
        setSelectedImage(optimizedBase64);
      });
    }
  };

  const handleSend = useCallback(async (contentToSend?: string, imageToSend?: string | null) => {
    const text = contentToSend !== undefined ? contentToSend : input;
    const img = imageToSend !== undefined ? imageToSend : selectedImage;

    if (!text.trim() && !img) return;
    if (isTyping) return;

    const userMsgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();

    const newMsg: Message = {
      id: userMsgId,
      role: "user",
      content: text,
      image: img || undefined,
      timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const initialAiMsg: Message = {
      id: aiMsgId,
      role: "assistant",
      content: "",
      timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    const updatedMessages = [...messages, newMsg, initialAiMsg];
    setMessages(updatedMessages);
    setInput("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsTyping(true);

    abortControllerRef.current = new AbortController();

    // Prepare full conversation history for context-aware RAG and LLM
    const historyPayload = messages.map(m => ({
      role: m.role,
      content: m.content,
      image: m.image
    }));

    try {
      let fullResponseText = "";
      await fetchAIStream(
        promptType,
        text,
        img || undefined,
        (chunk: string) => {
          fullResponseText += chunk;
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: fullResponseText } : m
          ));
        },
        historyPayload,
        abortControllerRef.current.signal
      );

      // Sync final state to database session
      const finalMessages = updatedMessages.map(m =>
        m.id === aiMsgId ? { ...m, content: fullResponseText } : m
      );

      // Save to database session
      try {
        const saveRes = await fetch("/api/chat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activeSessionId || undefined,
            type: promptType,
            messages: finalMessages
          })
        });

        if (saveRes.ok) {
          const savedData = await saveRes.json();
          if (savedData.session?.id) {
            setActiveSessionId(savedData.session.id);
            // Refresh sessions list in sidebar to reflect new title/time
            refreshSessions();
          }
        }
      } catch (saveErr) {
        console.warn("Failed to save session to DB:", saveErr);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
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
  }, [input, selectedImage, isTyping, messages, promptType, activeSessionId, refreshSessions]);

  const handleClearCurrentSession = () => {
    if (isTyping && abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
    }
    abortControllerRef.current = null;
    setIsTyping(false);
    if (activeSessionId) {
      fetch(`/api/chat/sessions/${activeSessionId}`, { method: "DELETE" }).catch(() => {});
      setSessions(prev => prev.filter(s => s.id !== activeSessionId));
    }
    handleNewChat();
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
    <div className="flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-60px)] w-full max-w-7xl mx-auto p-2 md:p-4 gap-3">
      {/* ChatGPT-style History Sidebar */}
      <div
        className={`${
          showHistory ? "w-72 md:w-80 flex" : "hidden"
        } flex-col bg-card rounded-2xl border border-border shadow-xs shrink-0 overflow-hidden transition-all duration-200`}
      >
        <div className="p-3 border-b flex items-center justify-between gap-2 bg-muted/30">
          <Button
            onClick={handleNewChat}
            variant="default"
            size="sm"
            className="flex-1 justify-start gap-2 shadow-xs rounded-xl font-medium"
          >
            <Plus className="h-4 w-4" />
            New Consultation
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowHistory(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Hide history sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-2 border-b bg-muted/10 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-3">
          <History className="h-3.5 w-3.5" />
          Consultation History ({sessions.length})
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No saved sessions yet. Start asking questions to build your medical history!
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectSession(sess.id)}
                  className={`group relative flex items-start gap-2.5 p-2.5 rounded-xl cursor-pointer text-left transition-all border ${
                    isActive
                      ? "bg-primary/10 border-primary/30 text-foreground font-medium shadow-2xs"
                      : "hover:bg-muted/60 border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className={`h-4 w-4 mt-0.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/70"}`} />
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs truncate font-medium leading-snug">
                      {sess.title || "Consultation"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/80">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(sess.updatedAt)}
                      </span>
                      <span>•</span>
                      <span>{sess.messageCount} msg{sess.messageCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(e, sess.id)}
                    className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-background rounded-md transition-all cursor-pointer"
                    title="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
        {/* Workspace Top Header */}
        <div className="flex items-center justify-between p-3 md:px-5 border-b bg-card">
          <div className="flex items-center gap-2.5 min-w-0">
            {!showHistory && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowHistory(true)}
                className="h-8 w-8 rounded-lg"
                title="Open history sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base md:text-lg font-bold tracking-tight truncate flex items-center gap-2">
                {title}
                {activeSessionId && (
                  <span className="text-xs font-normal text-muted-foreground truncate hidden sm:inline">
                    — {sessions.find(s => s.id === activeSessionId)?.title}
                  </span>
                )}
              </h1>
              <p className="text-xs text-muted-foreground truncate hidden md:block">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="text-xs rounded-xl h-8"
              title="Start a new consultation"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={messages.length === 0 || isTyping}
              className="text-xs rounded-xl h-8 hidden sm:flex"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCurrentSession}
              disabled={messages.length === 0 || isTyping}
              className="text-xs rounded-xl h-8 text-muted-foreground hover:text-destructive"
              title="Clear current session"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Chat Messages Viewport */}
        <div
          className="flex-1 overflow-hidden flex flex-col relative"
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
            {!isInitialized || isLoadingSession ? (
              <div className="h-full flex flex-col items-center justify-center opacity-60 gap-2">
                <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Loading consultation session...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-85 my-auto">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
                  <Icon className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-1.5">How can I assist you with {title.toLowerCase()}?</h2>
                <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
                  {promptType === "lab"
                    ? "Upload a photo of your laboratory test report to extract values and check clinical ranges, or choose a prompt below."
                    : description}
                </p>

                {promptType === "lab" && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mb-6 w-full max-w-md p-5 border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded-2xl cursor-pointer transition-all flex flex-col items-center gap-2 group"
                  >
                    <div className="p-3 bg-primary/10 rounded-full text-primary group-hover:scale-110 transition-transform">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="font-semibold text-sm">Upload Lab Report or Test Photo</p>
                    <p className="text-xs text-muted-foreground text-center">Click or drag & drop blood test, lipid panel, or metabolic report</p>
                  </button>
                )}

                <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                  {suggestedPrompts.map(prompt => (
                    <Button
                      key={prompt}
                      variant="secondary"
                      size="sm"
                      className="rounded-full text-xs hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1"
                      onClick={() => handleSend(prompt)}
                    >
                      <span>{prompt}</span>
                      <ChevronRight className="h-3 w-3 opacity-60" />
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

          {/* Bottom Message Input Bar */}
          <div className="p-3 md:p-4 bg-background/80 backdrop-blur-xs border-t">
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
                className="pl-12 pr-12 py-6 rounded-full bg-muted/50 focus-visible:ring-1 text-sm"
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
    </div>
  );
}
