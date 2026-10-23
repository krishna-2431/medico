import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const promptType = searchParams.get("promptType") || "chat";

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chat = await prisma.chat.findFirst({
      where: { userId: user.id, type: promptType },
      orderBy: { updatedAt: "desc" }
    });

    if (!chat || !chat.messages) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    try {
      const messages = JSON.parse(chat.messages);
      return NextResponse.json({ messages: Array.isArray(messages) ? messages : [] }, { status: 200 });
    } catch {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, title, promptType } = await req.json();

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

    const cleanType = promptType || "chat";
    // Strip heavy base64 images from persistent database records to keep DB lean and fast
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

    // Upsert or update existing chat for this prompt type so each feature maintains its history
    const existingChat = await prisma.chat.findFirst({
      where: { userId: user.id, type: cleanType },
      orderBy: { updatedAt: "desc" }
    });

    let chat;
    if (existingChat) {
      chat = await prisma.chat.update({
        where: { id: existingChat.id },
        data: {
          messages: serialized,
          title: title || existingChat.title
        }
      });
    } else {
      chat = await prisma.chat.create({
        data: {
          userId: user.id,
          title: title || `${cleanType.toUpperCase()} Consultation`,
          type: cleanType,
          messages: serialized
        }
      });
    }

    return NextResponse.json({ success: true, chatId: chat.id }, { status: 200 });
  } catch (error) {
    console.error("Error saving chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const promptType = searchParams.get("promptType") || "chat";

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.chat.deleteMany({
      where: { userId: user.id, type: promptType }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
