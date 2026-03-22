export default async function handler(req, res) {
  // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

          if (req.method === "OPTIONS") {
              return res.status(200).end();
                }

                  if (req.method !== "POST") {
                      return res.status(405).json({ error: "Method not allowed" });
                        }

                          const { query, limit } = req.body || {};

                            if (!query) {
                                return res.json({ error: "No query provided" });
                                  }

                                    console.log("[VoxShield] Searching:", query);

                                      try {
                                          const response = await fetch("https://api.firecrawl.dev/v2/search", {
                                                method: "POST",
                                                      headers: {
                                                              "Content-Type": "application/json",
                                                                      "Authorization": "Bearer " + process.env.FIRECRAWL_API_KEY
                                                                            },
                                                                                  body: JSON.stringify({
                                                                                          query: query,
                                                                                                  limit: limit || 5
                                                                                                        })
                                                                                                            });
                                                                                                            
                                                                                                                const data = await response.json();
                                                                                                                
                                                                                                                    if (!data.success) {
                                                                                                                          return res.json({ error: "Search failed", details: data });
                                                                                                                              }
                                                                                                                              
                                                                                                                                  const results = (data.data || []).map(item => ({
                                                                                                                                        title: item.title || "Untitled",
                                                                                                                                              url: item.url || "",
                                                                                                                                                    description: item.description || "",
                                                                                                                                                          content: (item.markdown || item.description || "").slice(0, 1500)
                                                                                                                                                              }));
                                                                                                                                                              
                                                                                                                                                                  console.log("[VoxShield] Found", results.length, "results");
                                                                                                                                                                      return res.json({ results, query, count: results.length });
                                                                                                                                                                      
                                                                                                                                                                        } catch (err) {
                                                                                                                                                                            console.error("[VoxShield] Error:", err.message);
                                                                                                                                                                                return res.json({ error: err.message });
                                                                                                                                                                                  }
                                                                                                                                                                                  }
