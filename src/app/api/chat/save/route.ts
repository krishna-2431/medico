import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const chat = await prisma.chat.create({
      data: {
        userId: user.id,
        title: title || "New Consultation",
        type: promptType || "chat",
        messages: JSON.stringify(messages)
      }
    });

    return NextResponse.json({ success: true, chatId: chat.id }, { status: 200 });

  } catch (error) {
    console.error("Error saving chat:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
