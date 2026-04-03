import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/track", async (req, res) => {
    try {
      const { code, apiKey } = req.body;
      console.log("Request body:", JSON.stringify({ code, apiKey: apiKey ? '***' : 'missing' }, null, 2));

      if (!code || !apiKey) {
        return res.status(400).json({ error: "Missing code or apiKey" });
      }

      const response = await fetch('https://api-labs.wonca.com.br/wonca.labs.v1.LabsService/Track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Apikey ${apiKey}`
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({ 
          error: errorData.message || `Erro na requisição: ${response.status} ${response.statusText}` 
        });
      }

      const data = await response.json();
      console.log("API response:", JSON.stringify(data, null, 2));
      
      if (data.json) {
        try {
          const parsedJson = JSON.parse(data.json);
          res.json({ 
            ...parsedJson, 
            events: parsedJson.eventos, 
            carrier: data.carrier 
          });
        } catch (e) {
          console.error("Error parsing nested JSON:", e);
          res.json(data);
        }
      } else {
        res.json(data);
      }
    } catch (error: any) {
      console.error("Tracking API error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
