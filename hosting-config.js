// When the independent RELETTER backend is deployed, set its HTTPS root URL here.
// GitHub Pages then redirects to the complete game (API and database included).
// Leave empty for local development. Never enter the original game's URL.
window.RELETTER_SERVER_URL = 'https://reletter-garden.zhenggdove-artist.workers.dev/';
if(location.hostname.endsWith('.github.io')&&window.RELETTER_SERVER_URL){
  const destination=new URL(window.RELETTER_SERVER_URL);
  if(destination.protocol==='https:'&&!destination.hostname.endsWith('.github.io'))location.replace(destination.href);
}
