const crypto=require('node:crypto');
const {validOAuthUrl}=require('./mcp-oauth.cjs');
function createOAuthWindow({BrowserWindow,getParent=()=>null}){
  return async(url,{signal,redirectUri,serverUrl,onClose})=>{
    validOAuthUrl(url,serverUrl);let disposed=false;
    const parent=getParent(),window=new BrowserWindow({width:680,height:780,minWidth:520,minHeight:620,show:false,parent:parent&&!parent.isDestroyed()?parent:undefined,title:'Scodex授权 · '+new URL(url).origin,autoHideMenuBar:true,backgroundColor:'#ffffff',webPreferences:{partition:'scodex-oauth-'+crypto.randomUUID(),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,devTools:false,spellcheck:false}});
    const contents=window.webContents,session=contents.session;window.setMenu(null);
    session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));session.setPermissionCheckHandler(()=>false);session.on('will-download',event=>event.preventDefault());contents.setWindowOpenHandler(()=>({action:'deny'}));
    function allowed(value){try{const target=new URL(value);if(target.origin===new URL(redirectUri).origin)return target.pathname===new URL(redirectUri).pathname;validOAuthUrl(target,serverUrl);return true;}catch{return false;}}
    function navigate(event,value){if(!allowed(value)){event.preventDefault();onClose();}else if(!window.isDestroyed())window.setTitle('Scodex授权 · '+new URL(value).origin);}
    contents.on('will-navigate',navigate);contents.on('will-redirect',navigate);
    contents.on('page-title-updated',event=>{event.preventDefault();if(!window.isDestroyed()){let origin;try{origin=new URL(contents.getURL()).origin;}catch{origin=new URL(url).origin;}window.setTitle('Scodex授权 · '+origin);}});
    window.once('ready-to-show',()=>{if(!disposed&&!signal.aborted){window.show();window.focus();}});
    window.on('closed',()=>{if(!disposed)onClose();});
    const dispose=async()=>{if(disposed)return;disposed=true;signal.removeEventListener('abort',abort);if(!window.isDestroyed())window.destroy();await session.clearStorageData().catch(()=>{});await session.clearCache().catch(()=>{});};
    const abort=()=>{dispose().catch(()=>{});};signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)await dispose();else window.loadURL(String(url)).catch(()=>{if(!disposed)onClose();});
    return{dispose};
  };
}
module.exports={createOAuthWindow};
