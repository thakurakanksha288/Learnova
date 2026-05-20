import { jsonError, jsonSuccess } from "@/lib/api-response";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_MESSAGE_LENGTH = 2000;

export async function POST(request) {
  try {
    const { message, userMessage } = await request.json();
    const rawMessage = typeof message === "string" ? message : userMessage;
    const trimmedMessage = rawMessage?.trim();

    if (!trimmedMessage) {
      return jsonError("Message is required", 400);
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return jsonError("Message is too long", 400);
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return jsonError("Groq API key is not configured", 500);
    }

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "You are Nova, the friendly AI assistant for Learnova - a Smart Student Engagement Ecosystem. You help with questions about attendance automation, smart activities, security features, analytics, and educational technology. Always be helpful, informative, and encouraging. Keep responses concise but comprehensive.",
          },
          { role: "user", content: trimmedMessage },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return jsonError(
        errorBody?.error?.message || "Groq request failed",
        response.status,
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return jsonError("Groq response was empty", 502);
    }

    return jsonSuccess({ message: content });
  } catch (error) {
    console.error("Groq API route error:", error);
    return jsonError("Internal server error", 500);
  }
}
