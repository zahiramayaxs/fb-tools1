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
            // Membuat kombinasi huruf besar dan angka acak agar mirip id file cdn asli (misal: N0WI0O0O1)
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

    // 2. MAIN ENGINE: PENGALIHAN (REDIRECT) DENGAN PEMBERSIHAN .MP4
    if (url.pathname !== "/" && url.pathname !== "") {
      try {
        // Ambil kode unik dari url, buang tanda "/"
        let kodeUrl = url.pathname.replace("/", "");

        // PENTING: Jika di belakangnya ada teks .mp4, kita potong/buang teks .mp4 tersebut
        if (kodeUrl.endsWith(".mp4")) {
          kodeUrl = kodeUrl.replace(".mp4", "");
        }

        // Cari kode murni hasil potongan tadi ke database D1
        const dataLink = await env.DB.prepare("SELECT target_url FROM link_rotators WHERE random_code = ?")
          .bind(kodeUrl)
          .first();

        if (dataLink && dataLink.target_url) {
          return Response.redirect(dataLink.target_url, 302);
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
