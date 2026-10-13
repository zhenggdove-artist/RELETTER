# RELETTER 雙人花園

公開遊戲：**https://reletter-garden.zhenggdove-artist.workers.dev/**。入場密碼 `RAE1210` 或 `rae1210`。部署使用已確認的 Cloudflare Workers Free 帳號方案與 RELETTER 專屬 SQLite-backed Durable Object。

以提供的 webar-meatball-game-framework 場景、動畫與植物系統為基礎。來源資料庫、資料紀錄、Git 歷史、部署流程與環境變數未複製。

## 本機啟動

需要 Node.js 22.20 或更新的 Node.js 22 版本。

```powershell
npm ci
npm start
```

瀏覽 `http://localhost:3000`，輸入 `RAE1210`，選擇 Ely 或 Rae。兩位玩家使用同一個模型；Rae 是牽牛花紫。另一台電腦可在同一網路開啟這台電腦的 IP 位址加上 `:3000`（須允許防火牆連線）。

密碼不區分大小寫，也接受 `rae1210`。請用 `npm start` 啟動完整伺服器；直接開啟 HTML 或透過純靜態網站預覽，無法提供登入、資料庫與雙人連線。

## GitHub Pages 與公開遊戲網址

GitHub Pages 只提供靜態網頁，不會執行 `server/index.js`。把專案推到 Pages 不等於部署遊戲後端；Pages 的 `/api/login` 會回傳 HTML 錯誤頁。

免費公開部署使用下方的 Cloudflare Workers 方案，前端、登入、資料庫與雙人連線都在同一個 HTTPS 網址。若想保留現有 GitHub Pages 網址作入口，將 `hosting-config.js` 的 `RELETTER_SERVER_URL` 填成部署成功後的 HTTPS 遊戲網址，再更新 Pages；它會導向完整遊戲，不需要把密碼或登入 Cookie 跨站傳送。

- 留文字、畫畫或上傳圖片後按 PLANT，沿用原本動畫種成植物。
- 色輪、明暗滑桿、顏色選擇器與 1–48 px 筆頭可自由搭配；圖片接受 PNG、JPG、WebP，最大 10 MB，上傳前自動縮到最長邊 1024 px。
- 滑鼠經過植物顯示文字、作者、塗鴉和圖片。
- 按 Enter 開啟聊天，再按 Enter 傳送；Esc 關閉。雙方訊息出現在左下角，最多保留最近 100 則。
- 每個角色只有一個在線席位。另一位的位置、朝向及動畫會即時同步；斷線會嘗試重新連線。

## 獨立資料庫

未設定 `RELETTER_DATABASE_URL` 時，伺服器自動建立本專案的 `data/reletter.sqlite`。這是全新資料庫，不會請求原網站 Supabase。植物、文字、塗鴉和圖片由伺服器保存；聊天與在線位置只保留在目前連線期間。

## 免費 Cloudflare 部署

Cloudflare Workers 免費方案支援 SQLite-backed Durable Objects。RELETTER 專用的 `ReletterGarden` 包含持久 SQLite 資料庫、獨立登入 Session 與雙人 WebSocket 房間。資料庫在初次使用時自動建立；不使用原 Supabase，也不需要 PostgreSQL 或 R2 帳號。

```powershell
npm ci
npx wrangler login
npx wrangler whoami
npm run deploy:cloud
```

Wrangler 發布成功後會印出實際的 `https://…workers.dev` 遊戲網址。完成部署後，可以用 `npx wrangler secret put GAME_PASSWORD` 把既有入場密碼存成伺服器 Secret。未設定時沿用專案的 `RAE1210`；密碼大小寫皆可。

`wrangler.jsonc` 的 `new_sqlite_classes` 建立全新的 RELETTER 儲存命名空間。請勿把它改成原網站的資源，也不要刪除 migration 或變更 room 名稱，避免切換到不同花園。更新程式不會清除已種植的內容。

圖像分成小區塊儲存，登入後才可讀取。植物列表只回傳媒體網址，不會每次下載全部圖片。位置透過可休眠 WebSocket 傳送，停在同一位置時不重複傳送；聊天仍使用登入後的 API。

免費額度目前包含每日 100,000 Durable Object 計費請求、每日 100,000 SQLite 寫入列及帳號合計 5 GB 儲存。WebSocket 訊息以 20:1 計入請求數，靜態模型、音樂與字型走免費資產服務。免費方案超額時服務會拒絕操作，不會自動升級。方案限制見 [Durable Objects 官方定價](https://developers.cloudflare.com/durable-objects/platform/pricing/) 與 [Workers 靜態資產定價](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)。這些額度與同一帳號的其他 Workers 共用；不需開啟付費方案。

本機模擬及測試：

```powershell
npm run dev:cloud
# 另一個終端機
npm run test:cloud
$env:RELETTER_TEST_URL='http://127.0.0.1:8787'
node tests/browser.mjs
```

另保留 `render.yaml` 作為舊有的可選付費部署設定；這次免費部署不執行它。Render 免费資料庫會在 30 天後過期，因此不作為長期免費花園方案。

Node 本機版本仍可用 `npm start` 和 `data/reletter.sqlite`。只有另行選擇 PostgreSQL 時才設定 `RELETTER_DATABASE_URL`；自訂本機 PostgreSQL 可用 `DB_SSL=false`。

資料庫檔案、環境變數和後端原始碼不會透過靜態檔案路由公開。密碼在伺服器驗證，登入 Cookie 為 HttpOnly。正式環境需 HTTPS。

## 驗證與維護

```powershell
npm test
node tests/browser.mjs
```

瀏覽器測試需先 `npm start`，並安裝對應的 Playwright Chromium（`npx playwright install chromium`）。測試圖片放在忽略版控的 `output/`。

`index.html` 保留原場景程式。新增功能的原始片段位於 `game-additions.js`；修改後執行 `node sync-game.mjs` 同步至主頁。修改頁面布局直接編輯 `index.html`。
