
const HTML = String.raw`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Form Laporan</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
*{box-sizing:border-box}
body{
  margin:0;padding:20px;
  background:#f3f5f9;color:#202938;
  font-family:Arial,sans-serif
}
.container{
  max-width:520px;margin:auto;
  background:white;padding:22px;
  border-radius:16px
}
h2{margin:0 0 6px}
.sub{color:#718096;font-size:13px;margin-bottom:24px}
label{display:block;font-weight:600;margin:16px 0 7px}
input,select,textarea{
  width:100%;padding:13px;
  border:1px solid #dce1e8;border-radius:9px;
  font-size:15px;background:white
}
textarea{min-height:100px;resize:vertical}
input:focus,select:focus,textarea:focus{
  outline:2px solid #b8d9ff;border-color:#229ed9
}
button{
  width:100%;padding:15px;margin-top:22px;
  border:0;border-radius:10px;
  background:#229ed9;color:white;
  font-size:16px;font-weight:bold
}
button:disabled{opacity:.6}
.note{font-size:12px;color:#718096;margin-top:8px}
#status{margin-top:15px;font-size:14px}
</style>
</head>
<body>
<div class="container">
<h2>Form Laporan</h2>
<div class="sub">Silakan lengkapi seluruh informasi laporan.</div>

<form id="reportForm">

<label>Nama Pelapor *</label>
<input name="nama" required maxlength="100"
placeholder="Masukkan nama lengkap">

<label>Site *</label>
<input name="site" required maxlength="100"
placeholder="Masukkan nama site">

<label>Pilihan Laporan *</label>
<select name="jenis" required>
<option value="">Pilih kategori</option>
<option value="Barang">Barang</option>
<option value="Dokumen">Dokumen</option>
<option value="Jasa">Jasa</option>
</select>

<label>Nomor Dokumen</label>
<input name="no_dokumen" maxlength="100"
placeholder="Masukkan nomor dokumen">

<label>Tanggal *</label>
<input type="date" name="tanggal" required>

<label>Upload Foto / Video</label>
<input type="file" name="files" id="files"
accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
multiple>
<div class="note">
Maksimal 5 file, ukuran maksimal 15 MB per file,
dan total maksimal 40 MB.
</div>

<label>Keterangan Keluhan *</label>
<textarea name="keterangan" required maxlength="3000"
placeholder="Tuliskan detail keluhan..."></textarea>

<button id="submitBtn" type="submit">
KIRIM LAPORAN
</button>

<div id="status"></div>
</form>
</div>

<script>
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const form = document.getElementById("reportForm");
const btn = document.getElementById("submitBtn");
const statusBox = document.getElementById("status");

form.addEventListener("submit", async function(e){
  e.preventDefault();

  const files = document.getElementById("files").files;
  const allowed = [
    "image/jpeg","image/png","image/webp",
    "video/mp4","video/quicktime"
  ];

  if(files.length > 5){
    statusBox.textContent = "Maksimal 5 file.";
    return;
  }

  let total = 0;
  for(const file of files){
    total += file.size;

    if(!allowed.includes(file.type)){
      statusBox.textContent =
        "Format file tidak didukung: " + file.name;
      return;
    }

    if(file.size > 15 * 1024 * 1024){
      statusBox.textContent =
        "Ukuran file maksimal 15 MB: " + file.name;
      return;
    }
  }

  if(total > 40 * 1024 * 1024){
    statusBox.textContent = "Total file maksimal 40 MB.";
    return;
  }

  const data = new FormData(form);
  data.delete("files");

  for(const file of files){
    data.append("files",file);
  }

  data.append("initData",tg.initData);

  btn.disabled = true;
  btn.textContent = "MENGIRIM...";
  statusBox.textContent = "Sedang menyimpan laporan...";

  try{
    const response = await fetch("/api/submit",{
      method:"POST",
      body:data
    });

    const result = await response.json();

    if(!response.ok){
      throw new Error(result.error || "Gagal mengirim laporan");
    }

    statusBox.textContent =
      "Laporan berhasil disimpan. ID: " + result.reportId;

    btn.textContent = "BERHASIL";
    tg.HapticFeedback.notificationOccurred("success");

    setTimeout(function(){
      tg.close();
    },1800);

  }catch(error){
    statusBox.textContent = error.message;
    btn.disabled = false;
    btn.textContent = "COBA KIRIM KEMBALI";
    tg.HapticFeedback.notificationOccurred("error");
  }
});
</script>
</body>
</html>`;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

function b64url(input) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC", key, new TextEncoder().encode(message)
    )
  );
}

async function validateInitData(initData, botToken) {
  if (!initData || initData.length > 10000) {
    throw new Error("Data Telegram tidak ditemukan.");
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new Error("Hash Telegram tidak valid.");
  }

  params.delete("hash");
  params.delete("signature");

  const dataCheck = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => k + "=" + v)
    .join("\n");

  const secret = await hmac(
    new TextEncoder().encode("WebAppData"),
    botToken
  );

  const calculated = hex(await hmac(
    secret,
    dataCheck
  ));

  if (calculated !== receivedHash.toLowerCase()) {
    throw new Error("Autentikasi Telegram gagal.");
  }

  const authDate = Number(params.get("auth_date"));

  if (!authDate || Date.now() / 1000 - authDate > 86400 ||
      authDate > Date.now() / 1000 + 60) {
    throw new Error("Sesi Telegram sudah kedaluwarsa.");
  }

  const user = JSON.parse(params.get("user") || "{}");

  if (!user.id) {
    throw new Error("Identitas pengguna tidak ditemukan.");
  }

  return user;
}

function pemToBytes(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binary = atob(clean);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function googleToken(env) {
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({
    alg: "RS256",
    typ: "JWT"
  }));

  const claims = b64url(JSON.stringify({
    iss: env.GOOGLE_CLIENT_EMAIL,
    scope:
      "https://www.googleapis.com/auth/drive " +
      "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));

  const unsigned = header + "." + claims;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(env.GOOGLE_PRIVATE_KEY),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  const assertion = unsigned + "." + b64url(signature);

  const response = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type:
          "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error("Google authentication gagal: " +
      JSON.stringify(result));
  }

  return result.access_token;
}

async function uploadDrive(file, token, env, reportId) {
  const boundary = "----WorkerBoundary" + crypto.randomUUID();

  const safeName = file.name.replace(/[^\w.\- ]/g, "_");

  const metadata = {
    name: reportId + "_" + safeName,
    mimeType: file.type,
    parents: [env.DRIVE_FOLDER_ID]
  };

  const fileBytes = await file.arrayBuffer();

  const body = new Blob([
    "--" + boundary + "\r\n",
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata) + "\r\n",
    "--" + boundary + "\r\n",
    "Content-Type: " + file.type + "\r\n\r\n",
    fileBytes,
    "\r\n--" + boundary + "--"
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "multipart/related; boundary=" + boundary
      },
      body
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error("Upload Drive gagal: " +
      JSON.stringify(result));
  }

  return {
    name: result.name,
    url: result.webViewLink ||
      "https://drive.google.com/file/d/" + result.id + "/view"
  };
}

async function appendSheet(token, env, row) {
  const range = encodeURIComponent("'Laporan'!A:J");

  const response = await fetch(
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    env.SPREADSHEET_ID +
    "/values/" + range +
    ":append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [row]
      })
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error("Google Sheets gagal: " +
      JSON.stringify(result));
  }

  return result;
}

async function telegram(env, method, data) {
  const response = await fetch(
    "https://api.telegram.org/bot" +
    env.BOT_TOKEN + "/" + method,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error("Telegram API: " +
      JSON.stringify(result));
  }

  return result;
}

async function handleWebhook(request, env) {
  const secret = request.headers.get(
    "X-Telegram-Bot-Api-Secret-Token"
  );

  if (secret !== env.WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = await request.json();
  const message = update.message;

  if (!message || !message.text) {
    return json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  if (text === "/start") {
    await telegram(env, "sendMessage", {
      chat_id: chatId,
      text:
        "Selamat datang di Report Automation Bot.\n\n" +
        "Silakan tekan tombol di bawah untuk mengisi laporan.",
      reply_markup: {
        keyboard: [[{
          text: "📝 Isi Form Laporan",
          web_app: {
            url: env.APP_URL
          }
        }]],
        resize_keyboard: true
      }
    });
  }

  return json({ ok: true });
}

async function handleSubmit(request, env) {
  const form = await request.formData();

  const user = await validateInitData(
    form.get("initData"),
    env.BOT_TOKEN
  );

  const nama = String(form.get("nama") || "").trim();
  const site = String(form.get("site") || "").trim();
  const jenis = String(form.get("jenis") || "").trim();
  const noDokumen = String(
    form.get("no_dokumen") || ""
  ).trim();
  const tanggal = String(form.get("tanggal") || "").trim();
  const keterangan = String(
    form.get("keterangan") || ""
  ).trim();

  if (!nama || !site || !jenis || !tanggal || !keterangan) {
    return json({
      error: "Lengkapi seluruh field wajib."
    }, 400);
  }

  if (!["Barang", "Dokumen", "Jasa"].includes(jenis)) {
    return json({ error: "Jenis laporan tidak valid." }, 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) ||
      Number.isNaN(Date.parse(tanggal + "T00:00:00Z"))) {
    return json({ error: "Tanggal tidak valid." }, 400);
  }

  const files = form.getAll("files")
    .filter(f => f instanceof File && f.size > 0);

  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime"
  ];

  if (files.length > 5) {
    return json({ error: "Maksimal 5 file." }, 400);
  }

  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size;

    if (!allowed.includes(file.type)) {
      return json({ error: "Format file tidak didukung." }, 400);
    }

    if (file.size > 15 * 1024 * 1024) {
      return json({ error: "File maksimal 15 MB." }, 400);
    }
  }

  if (totalSize > 40 * 1024 * 1024) {
    return json({ error: "Total file maksimal 40 MB." }, 400);
  }

  const reportId =
    "RPT-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  try {
    const token = await googleToken(env);

    const uploaded = [];

    for (const file of files) {
      const result = await uploadDrive(
        file, token, env, reportId
      );
      uploaded.push(result);
    }

    const fileLinks = uploaded
      .map(f => f.name + ": " + f.url)
      .join("\n");

    const row = [
      reportId,
      new Date().toISOString(),
      nama,
      site,
      jenis,
      noDokumen,
      tanggal,
      fileLinks,
      keterangan,
      String(user.id)
    ];

    await appendSheet(token, env, row);

    await telegram(env, "sendMessage", {
      chat_id: user.id,
      text:
        "✅ LAPORAN BERHASIL DISIMPAN\n\n" +
        "ID Laporan: " + reportId + "\n" +
        "Nama: " + nama + "\n" +
        "Site: " + site + "\n" +
        "Jenis: " + jenis + "\n" +
        "Jumlah lampiran: " + uploaded.length + "\n\n" +
        "Data sudah masuk ke Google Sheets.\n" +
        "Terima kasih."
    });

    return json({
      success: true,
      reportId,
      files: uploaded.length
    });

  } catch (error) {
    console.error("SUBMIT ERROR:", error);

    return json({
      error:
        "Laporan belum berhasil disimpan. " +
        "Silakan coba kembali atau hubungi admin."
    }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return new Response(HTML, {
          headers: {
            "Content-Type": "text/html; charset=UTF-8",
            "Cache-Control": "no-store"
          }
        });
      }

      if (request.method === "POST" &&
          url.pathname === "/telegram/webhook") {
        return await handleWebhook(request, env);
      }

      if (request.method === "POST" &&
          url.pathname === "/api/submit") {
        return await handleSubmit(request, env);
      }

      return new Response("Not Found", { status: 404 });

    } catch (error) {
      console.error(error);
      return json({ error: "Terjadi kesalahan server." }, 500);
    }
  }
};
