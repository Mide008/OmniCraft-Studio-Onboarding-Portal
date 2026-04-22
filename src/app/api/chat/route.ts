// src/app/api/chat/route.ts
import { NextRequest } from 'next/server';

// Simple, realistic fallback responses (no API key needed)
const creativeReplies = [
  "I hear a strong desire for architectural minimalism. Could you share three visual references that resonate with your brand soul?",
  "That’s an interesting emotional direction. Would you say the brand should feel warm & human or precise & authoritative?",
  "Let’s define your brand pillars. What are the two non‑negotiable feelings a user must have after interacting with your product?",
  "I’m picking up a sense of depth and quiet confidence. Do you lean toward a restrained monochromatic palette or a bold, vibrant accent?",
  "Tell me about the ‘enemy’ – what existing clichés in your industry do you want to avoid at all costs?",
];

const engineeringReplies = [
  "Let’s outline the system boundaries. What’s your expected monthly active user scale and data sensitivity?",
  "For a scalable foundation, we should discuss whether a serverless or containerised architecture fits your growth model. Any preference?",
  "What third‑party services (payments, analytics, CRM) must the system integrate with from day one?",
  "We should plan for a flexible API layer. Will you have external developers or only your internal team consuming the API?",
  "Let’s talk about data residency and compliance. Are there specific regulations (GDPR, CCPA, etc.) that apply to your users?",
];

function getFallbackResponse(mode: string, userMessage: string): string {
  const arr = mode === 'creative' ? creativeReplies : engineeringReplies;
  // Use a deterministic but varied response based on message length
  const index = userMessage.length % arr.length;
  return arr[index];
}

export async function POST(req: NextRequest) {
  try {
    const { message, projectId, messages: history } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message' }), { status: 400 });
    }

    // Determine mode from the last assistant message or default to creative
    let mode = 'creative';
    if (history && history.length > 0) {
      const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
      if (lastAssistant && lastAssistant.content.includes('engineering')) mode = 'engineering';
    }

    const fallbackText = getFallbackResponse(mode, message);

    // Create a ReadableStream that sends tokens one by one
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const words = fallbackText.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = (i === 0 ? words[i] : ' ' + words[i]);
          controller.enqueue(encoder.encode(chunk));
          await new Promise(r => setTimeout(r, 40)); // Simulate typing
        }
        controller.close();
      },
    });

    // Set headers for streaming + pass projectId back (frontend expects X-Project-Id)
    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set('Transfer-Encoding', 'chunked');
    if (projectId) headers.set('X-Project-Id', projectId);
    headers.set('X-Detected-Modes', mode);

    return new Response(stream, { headers });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}