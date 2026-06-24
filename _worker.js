export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API: BULK GENERATE LINK
    if (url.pathname === "/api/generate-links" && request.method === "POST") {
      try {
        const { links, count } = await request.json();
        if (!links || !Array.isArray(links) || links.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "Daftar link kosong." }), { status: 400 });
        }

        const variations = [];
        const statements = [];
        const insertStmt = env.DB.prepare("INSERT INTO link_rotators (random_code, target_url) VALUES (?, ?)");

        for (const targetUrl of links) {
          for (let i = 0; i < count; i++) {
            const karakter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let kodeAcak = "";
            for (let j = 0; j < 9; j++) {
              kodeAcak += karakter.charAt(Math.floor(Math.random() * karakter.length));
            }
            statements.push(insertStmt.bind(kodeAcak, targetUrl));
            variations.push(kodeAcak);
          }
        }

        if (statements.length > 0) {
          await env.DB.batch(statements);
        }

        return new Response(JSON.stringify({ success: true, variations }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // 2. MAIN ENGINE: REDIRECT ANTI-LIMIT REQUEST
    if (
      url.pathname !== "/" && 
      url.pathname !== "" && 
      !url.pathname.endsWith(".html") && 
      !url.pathname.includes("tool") && 
      !url.pathname.startsWith("/api/")
    ) {
      try {
        let kodeUrl = url.pathname.replace("/", "");
        if (kodeUrl.endsWith(".mp4")) {
          kodeUrl = kodeUrl.replace(".mp4", "");
        }

        // --- FILTER 1: CLOAKING BOT (Hemat Request Server) ---
        const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
        const isBot = 
          userAgent.includes("facebookexternalhit") || 
          userAgent.includes("facebot") || 
          userAgent.includes("facebookplatform") ||
          userAgent.includes("googlebot") || 
          userAgent.includes("twitterbot") || 
          userAgent.includes("bot") || 
          userAgent.includes("crawl") || 
          userAgent.includes("spider");

        if (isBot) {
          // Kasih halaman kosongan super ringan biar kuota CPU edge-mu awet 0.00ms
          return new Response("Server Active", { 
            headers: { 
              "Content-Type": "text/plain",
              "Cache-Control": "public, max-age=86400" // Bot disuruh ingat halaman ini selama 24 jam! Gak usah balik-balik lagi.
            } 
          });
        }

        // --- FILTER 2: AMBIL DATA DARI D1 ---
        const dataLink = await env.DB.prepare("SELECT target_url FROM link_rotators WHERE random_code = ?")
          .bind(kodeUrl)
          .first();

        if (dataLink && dataLink.target_url) {
          const loadingHtml = `
          <!DOCTYPE html>
          <html lang="id">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Memuat Video...</title>
              <style>
                  body { margin: 0; background-color: #0e121a; color: #ffffff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; }
                  .loading-container { text-align: center; }
                  .spinner { width: 50px; height: 50px; border: 4px solid rgba(24, 119, 242, 0.1); border-left-color: #1877f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              </style>
          </head>
          <body>
          <div class="loading-container">
              <div class="spinner"></div>
              <div>Menyiapkan video...</div>
          </div>
          <script>
              window.location.replace("${dataLink.target_url}");
          </script>
          </body>
          </html>
          `;
          
          return new Response(loadingHtml, { 
            headers: { 
              "Content-Type": "text/html; charset=utf-8",
              // TRIK UTAMA: Paksa Browser Pengunjung Meng-cache Request Ini Selama 12 Jam
              "Cache-Control": "public, max-age=43200, stale-while-revalidate=60"
            } 
          });

        } else {
          return new Response("Link tidak valid.", { status: 404 });
        }
      } catch (err) {
        return new Response("Terjadi kesalahan sistem.", { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
