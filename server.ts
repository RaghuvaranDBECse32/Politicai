import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for exponential backoff with jitter (429 rate limit resilience)
  async function runWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const errStr = String(err?.message || err || "").toLowerCase();
        const isRateLimit =
          err?.status === 429 ||
          errStr.includes("429") ||
          errStr.includes("quota") ||
          errStr.includes("rate limit") ||
          errStr.includes("resource exhausted");

        if (isRateLimit && attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 500;
          console.warn(`[Gemini API] 429 Rate Limit. Retrying in ${delay.toFixed(0)}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw err;
        }
      }
    }
    return fn();
  }

  function parseGeminiError(err: any): string {
    if (!err) return "An unknown error occurred.";
    let message = err.message || "";
    
    if (typeof message === "string") {
      const cleanStr = message.replace(/^ApiError:\s*/i, "").trim();
      try {
        const topObj = JSON.parse(cleanStr);
        if (topObj?.error?.message) {
          message = topObj.error.message;
        }
      } catch (_) {
        const jsonStart = cleanStr.indexOf("{");
        if (jsonStart !== -1) {
          try {
            const subObj = JSON.parse(cleanStr.substring(jsonStart));
            if (subObj?.error?.message) {
              message = subObj.error.message;
            }
          } catch (_) {}
        }
      }
    }

    if (typeof message === "string") {
      message = message.trim();
      if (message.startsWith("{")) {
        try {
          const nestedObj = JSON.parse(message);
          if (nestedObj?.error?.message) {
            message = nestedObj.error.message;
          }
        } catch (_) {}
      }
    }

    let finalMsg = message ? String(message) : String(err);
    const lowerMsg = finalMsg.toLowerCase();

    if (lowerMsg.includes("quota") || lowerMsg.includes("429") || lowerMsg.includes("resource_exhausted") || lowerMsg.includes("rate limit")) {
      finalMsg = `### ⚠️ Gemini API Quota Exhausted (429)

The active Gemini API Key has exceeded its rate limit or project quota.

#### How to Resolve:
1. Open the **Settings** or **Secrets** menu in **Google AI Studio** (usually found in the top-right gears icon or bottom-left of the window).
2. Enter your own personal \`GEMINI_API_KEY\` in your variables.
3. The server will pick it up on your next request, giving you a full, fresh personal quota!`;
    }

    return finalMsg;
  }

  // SSE (Server-Sent Events) Chat Stream Endpoint
  app.post("/api/chat-stream", async (req, res) => {
    try {
      const { messages: rawMessages, systemInstruction, model, temperature, enableGoogleSearch } = req.body;

      if (!rawMessages || !Array.isArray(rawMessages)) {
        return res.status(400).json({ error: "Invalid messages format. Expected array." });
      }

      // Convert messages to GenAI contents structure
      const contents = rawMessages.map((msg: any) => ({
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: msg.content }],
      }));

      const modelName = model || "gemini-3.5-flash";

      // Configure headers for Event Stream / SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Initialize GoogleGenAI SDK with appropriate fallback and headers
      const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6Ic8KMANKmxu40NMZN9XBGp3BQofwIJI30xt55fKNlZ4Q";
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Stream call with 429 retry safety
      const responseStream = await runWithRetry(async () => {
        const config: any = {
          systemInstruction: systemInstruction || "You are a helpful assistant.",
          temperature: temperature !== undefined ? Number(temperature) : 0.4,
        };

        if (enableGoogleSearch) {
          config.tools = [{ googleSearch: {} }];
        }

        return ai.models.generateContentStream({
          model: modelName,
          contents: contents,
          config: config,
        });
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
        if (text || groundingMetadata) {
          res.write(`data: ${JSON.stringify({ 
            text: text || "", 
            groundingMetadata: groundingMetadata || null 
          })}\n\n`);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("Error in gemini chat stream API:", err);
      const errMsg = parseGeminiError(err);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: errMsg });
      }
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server startup failure:", err);
  process.exit(1);
});
