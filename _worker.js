export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Jalur (Route) khusus untuk menerima kiriman data form akun baru
    if (url.pathname === "/api/add-account" && request.method === "POST") {
      try {
        // 1. Ambil data JSON yang dikirim oleh index.html
        const data = await request.json();
        const { accountName, cookieString } = data;

        // 2. Validasi ulang data di sisi server
        if (!accountName || !cookieString) {
          return new Response(JSON.stringify({ success: false, error: "Data kurang lengkap." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }

        // 3. Masukkan data ke dalam database Cloudflare D1 yang bernama 'DB'
        await env.DB.prepare(
          "INSERT INTO fb_accounts (account_name, cookies) VALUES (?, ?)"
        )
        .bind(accountName, cookieString)
        .run();

        // 4. Kirim respon balik ke browser bahwa data berhasil disimpan
        return new Response(JSON.stringify({ success: true, message: `Akun '${accountName}' sukses didaftarkan!` }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        // Jika ada error internal server atau database gagal konek
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // Jika user mengakses halaman selain API (misal akses web biasa), oper ke halaman HTML bawaan Cloudflare Pages
    return env.ASSETS.fetch(request);
  }
};
