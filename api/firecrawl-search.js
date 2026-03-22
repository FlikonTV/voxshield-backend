export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, limit } = req.body || {};
    if (!query) return res.json({ error: "No query provided" });

  try {
        const response = await fetch("https://api.firecrawl.dev/v2/search", {
                method: "POST",
                headers: {
                          "Content-Type": "application/json",
                          "Authorization": "Bearer " + process.env.FIRECRAWL_API_KEY
                },
                body: JSON.stringify({ query, limit: limit || 5 })
        });

      const data = await response.json();

      // Log the raw response for debugging
      console.log("[VoxShield] Firecrawl raw response keys:", Object.keys(data));
        console.log("[VoxShield] data.success:", data.success);

      if (!data.success) {
              return res.json({
                        error: "Firecrawl search failed",
                        details: data.error || data.message || JSON.stringify(data)
              });
      }

      // Handle ALL possible Firecrawl response shapes
      let rawResults = [];

      if (Array.isArray(data.data)) {
              // Shape: { success: true, data: [...] }
          rawResults = data.data;
      } else if (data.data && Array.isArray(data.data.web)) {
              // Shape: { success: true, data: { web: [...] } }
          rawResults = data.data.web;
      } else if (data.data && typeof data.data === "object") {
              // Shape: { success: true, data: { someKey: [...] } }
          // Try to find any array inside data.data
          const arrays = Object.values(data.data).filter(Array.isArray);
              if (arrays.length > 0) {
                        rawResults = arrays[0];
              }
      }

      const results = rawResults.map(item => ({
              title: item.title || "Untitled",
              url: item.url || "",
              description: item.description || "",
              content: (item.markdown || item.content || item.description || "").slice(0, 1500)
      }));

      console.log("[VoxShield] Found", results.length, "results for:", query);

      return res.json({ results, query, count: results.length });

  } catch (err) {
        console.error("[VoxShield] Error:", err.message);
        return res.json({ error: err.message });
  }
}
