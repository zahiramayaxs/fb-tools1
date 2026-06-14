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

    // 3. API: FETCH DAFTAR GRUP (VERSI FINAL SUKSES)
    if (url.pathname === "/api/fetch-groups" && request.method === "POST") {
      try {
        const { accountId } = await request.json();
        const account = await env.DB.prepare("SELECT cookies FROM fb_accounts WHERE id = ?").bind(accountId).first();
        if (!account) return new Response(JSON.stringify({ success: false, error: "Akun tidak ditemukan." }), { status: 404 });

        // Tembak halaman daftar grup mbasic yang paling standar dan rapi
        const fbResponse = await fetch("https://mbasic.facebook.com/groups/?seemore", {
          headers: {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "accept-language": "id-ID,id;q=0.9",
            "Cookie": account.cookies,
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          }
        });

        const htmlText = await fbResponse.text();

        const groupList = [];
        
        // Pola penangkap ID dan Nama grup yang paling akurat untuk mbasic Facebook
        const regex = /\/groups\/([0-9]+)\/\?refid=[^"]+">([^<]+)<\/a>/g;
        let match;
        
        while ((match = regex.exec(htmlText)) !== null) {
          if (!groupList.some(g => g.groupId === match[1])) {
            groupList.push({
              groupId: match[1],
              groupName: match[2]
            });
          }
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
