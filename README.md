# RELETTER 雙人花園

以提供的 webar-meatball-game-framework 場景、動畫與植物系統為基礎。來源資料庫、資料紀錄、Git 歷史、部署流程與環境變數未複製。

## 本機啟動

需要 Node.js 22.20 或更新的 Node.js 22 版本。

```powershell
npm ci
npm start
```

瀏覽 `http://localhost:3000`，輸入 `RAE1210`，選擇 Ely 或 Rae。兩位玩家使用同一個模型；Rae 是牽牛花紫。另一台電腦可在同一網路開啟這台電腦的 IP 位址加上 `:3000`（須允許防火牆連線）。

- 留文字、畫畫或上傳圖片後按 PLANT，沿用原本動畫種成植物。
- 色輪、明暗滑桿、顏色選擇器與 1–48 px 筆頭可自由搭配；圖片接受 PNG、JPG、WebP，最大 10 MB，上傳前自動縮到最長邊 1024 px。
- 滑鼠經過植物顯示文字、作者、塗鴉和圖片。
- 按 Enter 開啟聊天，再按 Enter 傳送；Esc 關閉。雙方訊息出現在左下角，最多保留最近 100 則。
- 每個角色只有一個在線席位。另一位的位置、朝向及動畫會即時同步；斷線會嘗試重新連線。

## 獨立資料庫

未設定 `RELETTER_DATABASE_URL` 時，伺服器自動建立本專案的 `data/reletter.sqlite`。這是全新資料庫，不會請求原網站 Supabase。植物、文字、塗鴉和圖片由伺服器保存；聊天與在線位置只保留在目前連線期間。

`render.yaml` 可建立獨立的 `reletter-game` 服務和 `reletter-db` PostgreSQL。部署時填入 `GAME_PASSWORD=RAE1210`，資料庫連線由 Blueprint 自動注入。此設定尚未替你在雲端帳號建立資源；需在 Render 匯入這個 Git 專案。所選方案會產生費用，部署前依帳號介面確認。

Blueprint 欄位與方案名稱已核對 [Render 官方文件](https://render.com/docs/blueprint-spec)。

部署只啟動一個伺服器實例：双人連線狀態保留在該實例記憶體中。SQLite 適合本機；沒有持久磁碟的雲端環境請使用 PostgreSQL。請勿填入原網站的 `RELETTER_DATABASE_URL`。自訂 PostgreSQL 可用 `DB_SSL=false` 連本機資料庫。

資料庫檔案、環境變數和後端原始碼不會透過靜態檔案路由公開。密碼在伺服器驗證，登入 Cookie 為 HttpOnly。正式環境需 HTTPS。

## 驗證與維護

```powershell
npm test
node tests/browser.mjs
```

瀏覽器測試需先 `npm start`，並安裝對應的 Playwright Chromium（`npx playwright install chromium`）。測試圖片放在忽略版控的 `output/`。

`index.html` 保留原場景程式。新增功能的原始片段位於 `game-additions.js`；修改後執行 `node sync-game.mjs` 同步至主頁。修改頁面布局直接編輯 `index.html`。
