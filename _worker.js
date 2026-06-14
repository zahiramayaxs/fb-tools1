export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API: MENAMBAH AKUN BARU
    if (url.pathname === "/api/add-account" && request.method === "POST") {
      try {
        const data = await request.json();
        const { accountName, cookieString } = data;

        if (!accountName || !cookieString) {
          return new Response(JSON.stringify({ success: false, error: "Data kurang lengkap." }), {
            status: 400, headers: { "Content-Type": "application/json" }
          });
        }

        await env.DB.prepare("INSERT INTO fb_accounts (account_name, cookies) VALUES (?, ?)")
          .bind(accountName, cookieString).run();

        return new Response(JSON.stringify({ success: true, message: `Akun '${accountName}' sukses didaftarkan!` }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500, headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. API: MENGAMBIL SEMUA AKUN YANG ADA DI DATABASE
    if (url.pathname === "/api/get-accounts" && request.method === "GET") {
      try {
        const { results } = await env.DB.prepare("SELECT id, account_name FROM fb_accounts WHERE status = 'active'").all();
        return new Response(JSON.stringify({ success: true, accounts: results }), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    // 3. API: FETCH DAFTAR GRUP DARI FACEBOOK MENGGUNAKAN COOKIE
    if (url.pathname === "/api/fetch-groups" && request.method === "POST") {
      try {
        const { accountId } = await request.json();
        
        // Ambil data cookie dari DB berdasarkan ID akun yang dipilih
        const account = await env.DB.prepare("SELECT cookies FROM fb_accounts WHERE id = ?").bind(accountId).first();
        if (!account) {
          return new Response(JSON.stringify({ success: false, error: "Akun tidak ditemukan." }), { status: 404 });
        }

        const cookieString = account.cookies;

        // Tembak ke mbasic Facebook bagian daftar grup
        const fbResponse = await fetch("https://mbasic.facebook.com/groups/?seemore", {
          headers: {
            "Cookie": cookieString,
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          }
        });

        const htmlText = await fbResponse.text();

        // Cek apakah cookie mati / terlempar ke halaman login
        if (htmlText.includes("login.php") || htmlText.includes("checkpoint")) {
          return new Response(JSON.stringify({ success: false, error: "Cookie akun ini sudah mati/checkpoint!" }), { status: 400 });
        }

        // Trick Regex Sederhana untuk mencabut ID Grup dan Nama Grup dari HTML mbasic
        // Pola link grup di mbasic biasanya: /groups/ID_GRUP/?refid=...
        const groupList = [];
        const regex = /<a href="\/groups\/([0-9]+)\/\?refid=[^"]+">([^<]+)<\/a>/g;
        let match;
        
        while ((match = regex.exec(htmlText)) !== null) {
          groupList.push({
            groupId: match[1],
            groupName: match[2]
          });
        }

        return new Response(JSON.stringify({ success: true, groups: groupList }), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
