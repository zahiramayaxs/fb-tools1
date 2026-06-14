export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API: MENAMBAH AKUN BARU
    if (url.pathname === "/api/add-account" && request.method === "POST") {
      try {
        const data = await request.json();
        const { accountName, cookieString } = data;
        if (!accountName || !cookieString) {
          return new Response(JSON.stringify({ success: false, error: "Data kurang lengkap." }), { status: 400 });
        }
        await env.DB.prepare("INSERT INTO fb_accounts (account_name, cookies) VALUES (?, ?)")
          .bind(accountName, cookieString).run();
        return new Response(JSON.stringify({ success: true, message: `Akun '${accountName}' sukses didaftarkan!` }));
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // 2. API: MENGAMBIL SEMUA AKUN
    if (url.pathname === "/api/get-accounts" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare("SELECT id, account_name FROM fb_accounts WHERE status = 'active'").all();
        return new Response(JSON.stringify({ success: true, accounts: results }));
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // 3. API: FETCH DAFTAR GRUP (VERSI ANTI BLOCK)
    if (url.pathname === "/api/fetch-groups" && request.method === "POST") {
      try {
        const { accountId } = await request.json();
        const account = await env.DB.prepare("SELECT cookies FROM fb_accounts WHERE id = ?").bind(accountId).first();
        if (!account) return new Response(JSON.stringify({ success: false, error: "Akun tidak ditemukan." }), { status: 404 });

        // Tembak halaman grup membership mbasic dengan headers lengkap layaknya browser asli
        const fbResponse = await fetch("https://mbasic.facebook.com/groups/?category=membership", {
          headers: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "cache-control": "max-age=0",
            "sec-ch-ua": '"Not A;Brand";v="99", "Chromium";v="120"',
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": '"Android"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "Cookie": account.cookies,
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          }
        });

        const htmlText = await fbResponse.text();

        // Kembalikan teks HTML asli untuk kita periksa lagi reaksinya
        return new Response(JSON.stringify({ success: true, debugHtml: htmlText }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
