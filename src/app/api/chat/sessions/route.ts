import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/sessions?type=... — Lists all conversation sessions for the logged-in user
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const whereClause: { userId: string; type?: string } = { userId: user.id };
    if (type) {
      whereClause.type = type;
    }

    const chats = await prisma.chat.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        messages: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const sessions = chats.map(c => {
      let preview = "";
      let messageCount = 0;
      try {
        const parsed = JSON.parse(c.messages || "[]");
        if (Array.isArray(parsed)) {
          messageCount = parsed.length;
          const lastMsg = parsed[parsed.length - 1];
          if (lastMsg && typeof lastMsg.content === "string") {
            preview = lastMsg.content.slice(0, 80);
          }
        }
      } catch {
        preview = "";
      }

      return {
        id: c.id,
        title: c.title,
        type: c.type,
        preview,
        messageCount,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      };
    });

    return NextResponse.json({ sessions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/chat/sessions — Creates or updates a conversation session
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, title, type, messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cleanType = type || "chat";

    // Strip heavy base64 images from persistent database storage
    const sanitizedMessages = messages.map(m => {
      if (m && typeof m === "object") {
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          timeStr: m.timeStr
        };
      }
      return m;
    });

    const serialized = JSON.stringify(sanitizedMessages);

    // Auto-generate title from first user message if title not provided
    let smartTitle = title;
    if (!smartTitle || smartTitle.trim() === "") {
      const firstUserMsg = sanitizedMessages.find((m: { role: string; content?: string }) => m.role === "user");
      if (firstUserMsg && typeof firstUserMsg.content === "string") {
        smartTitle = firstUserMsg.content.slice(0, 42).trim();
        if (firstUserMsg.content.length > 42) smartTitle += "...";
      } else {
        smartTitle = `${cleanType.toUpperCase()} Session`;
      }
    }

    let chat;
    if (id) {
      // Update existing session
      const existing = await prisma.chat.findUnique({ where: { id } });
      if (existing && existing.userId === user.id) {
        chat = await prisma.chat.update({
          where: { id },
          data: {
            messages: serialized,
            title: smartTitle,
            type: cleanType
          }
        });
      } else {
        // Create if ID not found for this user
        chat = await prisma.chat.create({
          data: {
            userId: user.id,
            title: smartTitle,
            type: cleanType,
            messages: serialized
          }
        });
      }
    } else {
      // Create new session
      chat = await prisma.chat.create({
        data: {
          userId: user.id,
          title: smartTitle,
          type: cleanType,
          messages: serialized
        }
      });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
        updatedAt: chat.updatedAt
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error saving chat session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
