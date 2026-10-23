import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/chat/sessions/[id] — Loads the full message history for a specific session
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chat = await prisma.chat.findUnique({
      where: { id }
    });

    if (!chat || chat.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let parsedMessages = [];
    try {
      parsedMessages = JSON.parse(chat.messages || "[]");
    } catch {
      parsedMessages = [];
    }

    return NextResponse.json({
      session: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
        messages: parsedMessages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error loading chat session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/chat/sessions/[id] — Deletes a specific session
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chat = await prisma.chat.findUnique({
      where: { id }
    });

    if (!chat || chat.userId !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await prisma.chat.delete({
      where: { id }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting chat session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
