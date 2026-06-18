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
        
        // Loop untuk setiap tautan/link tujuan yang dimasukkan user
        for (const targetUrl of links) {
          for (let i = 0; i < count; i++) {
            // Membuat kombinasi teks acak unik 8 karakter
            const randomString = Math.random().toString(36).substring(2, 10);
            
            // Kumpulan kata variasi biar di mata FB terlihat natural dan ramah diklik manusia
            const teksVariasi = ["video-viral", "nonton-gratis", "update-hari-ini", "film-terbaru", "cek-disini"];
            const acakKata = teksVariasi[Math.floor(Math.random() * teksVariasi.length)];
            
            const kodeUnik = `${acakKata}-${randomString}`;

            // Simpan data ke dalam database Cloudflare D1
            await env.DB.prepare("INSERT INTO link_rotators (random_code, target_url) VALUES (?, ?)")
              .bind(kodeUnik, targetUrl)
              .run();

            variations.push(kodeUnik);
          }
        }

        return new Response(JSON.stringify({ success: true, variations }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // 2. MAIN ENGINE: PENGALIHAN (REDIRECT) OTOMATIS
    if (url.pathname !== "/" && url.pathname !== "") {
      try {
        // Mengambil kode unik dengan membuang tanda garis miring "/"
        const kodeUrl = url.pathname.replace("/", "");

        // Cek ke database D1 apakah kode unik ini terdaftar
        const dataLink = await env.DB.prepare("SELECT target_url FROM link_rotators WHERE random_code = ?")
          .bind(kodeUrl)
          .first();

        if (dataLink && dataLink.target_url) {
          // Jika ditemukan, langsung belokkan browser ke link video asli (Redirect 302)
          return Response.redirect(dataLink.target_url, 302);
        } else {
          return new Response("Waduh, link variasi ini tidak valid atau sudah kedaluwarsa.", { status: 404 });
        }
      } catch (err) {
        return new Response("Terjadi kesalahan sistem pengalihan.", { status: 500 });
      }
    }

    // Jika mengakses halaman utama biasa, tampilkan aset frontend (index.html)
    return env.ASSETS.fetch(request);
  }
};
