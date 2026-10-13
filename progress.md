Original prompt: 複製指定 webar-meatball-game-framework 到 RELETTER，以它為架構，獨立新資料庫，密碼 RAE1210，Ely 與牽牛花紫 Rae 同模型選角，畫板、筆頭尺寸、色輪、圖片上傳及植物浮動框，最多兩人同步與 Enter 即時聊天。

- Copied original scene/model/music/assets into the existing nested RELETTER Git repository; excluded source Git, source deployment, source database and cached output.
- Replaced Supabase browser persistence with authenticated same-origin API. Created a new local SQLite database; PostgreSQL deployment uses independent RELETTER table and Blueprint resources.
- Added server password gate, unique character seats, SSE state/plant/chat updates, cloned remote model, painting and resized uploads, attached plant media and reload persistence.
- Server integration test passes: authentication, two seats, state/chat events, safe media, independent storage, deletion, blocked private routes.
- Browser gate screenshot reviewed. End-to-end two-browser testing is ongoing; software WebGL requires longer loading times.
- Cloud provisioning is not performed: no hosting account was supplied. Deployment instructions are in README.md.
- Final server tests PASS, including idempotent persistence and ignoring an unrelated DATABASE_URL.
- Final two-browser verification PASS: correct/wrong password, Ely/Rae seats, both directions of chat, typing isolation, drawing plus upload, shared plant and remote position, real raycast hover showing two media images within the viewport, persisted reload, and disconnect reducing online count to one. Browser page errors: none.
- Fixed tooltip placement after asynchronous image loads using ResizeObserver. Reviewed final gate, drawing and gameplay screenshots.
- Automated fixture plants removed after verification; local database remains ready for player content.
- Cloud PostgreSQL configuration prepared and checked against Render documentation; actual cloud deployment remains pending hosting-account setup.
