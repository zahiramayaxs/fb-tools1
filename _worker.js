export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API: MEMPROSES DAN MENYIMPAN BULK GENERATE LINK
    if (url.pathname === "/api/generate-links" && request.method === "POST") {
      try {
        const { links, count } = await request.json();
        if (!links || !Array.isArray(links) || links.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "Daftar link kosong." }), { status: 400 });
        }

        const variations = [];
        for (const targetUrl of links) {
          for (let i = 0; i < count; i++) {
            const karakter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let kodeAcak = "";
            for (let j = 0; j < 9; j++) {
              kodeAcak += karakter.charAt(Math.floor(Math.random() * karakter.length));
            }

            await env.DB.prepare("INSERT INTO link_rotators (random_code, target_url) VALUES (?, ?)")
              .bind(kodeAcak, targetUrl)
              .run();

            variations.push(kodeAcak);
          }
        }
        return new Response(JSON.stringify({ success: true, variations }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // 2. MAIN ENGINE: HALAMAN LOADING ESTETIK 3 DETIK SEBELUM REDIRECT
    if (url.pathname !== "/" && url.pathname !== "") {
      try {
        let kodeUrl = url.pathname.replace("/", "");

        if (kodeUrl.endsWith(".mp4")) {
          kodeUrl = kodeUrl.replace(".mp4", "");
        }

        const dataLink = await env.DB.prepare("SELECT target_url FROM link_rotators WHERE random_code = ?")
          .bind(kodeUrl)
          .first();

        if (dataLink && dataLink.target_url) {
          // JANGAN LANGSUNG REDIRECT! Kita kirim halaman HTML Loading yang estetik dulu ke browser pengunjung
          const loadingHtml = `
          <!DOCTYPE html>
          <html lang="id">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Memuat Video...</title>
              <style>
                  body {
                      margin: 0;
                      padding: 0;
                      background-color: #0e121a;
                      color: #ffffff;
                      font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      height: 100vh;
                      overflow: hidden;
                  }
                  .loading-container {
                      text-align: center;
                  }
                  /* Spinner Estetik Lingkaran Glow */
                  .spinner {
                      width: 60px;
                      height: 60px;
                      border: 4px solid rgba(24, 119, 242, 0.1);
                      border-left-color: #1877f2;
                      border-radius: 50%;
                      animation: spin 1s linear infinite;
                      margin: 0 auto 20px;
                      box-shadow: 0 0 15px rgba(24, 119, 242, 0.4);
                  }
                  .text {
                      font-size: 18px;
                      font-weight: 500;
                      letter-spacing: 0.5px;
                      color: #e4e6eb;
                      animation: pulse 1.5s ease-in-out infinite;
                  }
                  @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                  }
                  @keyframes pulse {
                      0%, 100% { opacity: 0.6; }
                      50% { opacity: 1; }
                  }
              </style>
          </head>
          <body>

          <div class="loading-container">
              <div class="spinner"></div>
              <div class="text">Menyiapkan video...</div>
          </div>

          <script>
              // Jeda waktu 3000 milidetik (3 detik) sebelum pindah ke link video asli
              setTimeout(function() {
                  window.location.href = "${dataLink.target_url}";
              }, 3000);
          </script>

          </body>
          </html>
          `;

          return new Response(loadingHtml, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });

        } else {
          return new Response("Waduh, link variasi ini tidak valid.", { status: 404 });
        }
      } catch (err) {
        return new Response("Terjadi kesalahan sistem pengalihan.", { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
