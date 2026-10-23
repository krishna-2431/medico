export type SystemPromptType = "symptom" | "medicine" | "lab" | "doctor" | "tips" | "emergency" | "chat";

export async function fetchAIStream(
  promptType: SystemPromptType,
  userMessage: string,
  image: string | undefined,
  onChunk: (chunk: string) => void,
  history: { role: "user" | "assistant"; content: string; image?: string }[] = [],
  signal?: AbortSignal
) {
  try {
    // Send only the minimal payload — the server owns and constructs the system prompt
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({ promptType, userMessage, image, history }),
      signal
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let done = false;
    let buffer = "";
    let receivedAnyContent = false;

    try {
      while (reader && !done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(trimmed.slice(6));

                if (parsed.error) {
                  throw new Error(parsed.error.message || "OpenRouter Stream Error");
                }

                const content = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.delta?.text ?? "";
                if (content) {
                  receivedAnyContent = true;
                  onChunk(content);
                }
              } catch (e: unknown) {
                const err = e as Error;
                if (err.message && err.message !== "Unexpected end of JSON input") {
                  throw e;
                }
              }
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim().startsWith("data: ") && buffer.trim() !== "data: [DONE]") {
        try {
          const parsed = JSON.parse(buffer.trim().slice(6));
          if (parsed.error) throw new Error(parsed.error.message || "Stream Error");
          const content = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.delta?.text ?? "";
          if (content) {
            receivedAnyContent = true;
            onChunk(content);
          }
        } catch (e: unknown) {
          const err = e as Error;
          if (err.message && !err.message.includes("JSON")) throw e;
        }
      }

      if (!receivedAnyContent) {
        throw new Error("No response received from AI model. Rate limits or upstream error.");
      }
    } finally {
      reader?.releaseLock();
    }
  } catch (error) {
    if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) {
      // User intentionally cancelled or switched chats — return cleanly
      return;
    }
    console.error("AI Service Error:", error);
    throw error;
  }
}
