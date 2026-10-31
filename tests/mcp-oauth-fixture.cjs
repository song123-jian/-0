// Real OAuth authorization-code/PKCE and refresh server + real SDK MCP endpoint.
const http=require('node:http'),crypto=require('node:crypto'),fs=require('node:fs/promises');
const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
const {StreamableHTTPServerTransport}=require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {SSEServerTransport}=require('@modelcontextprotocol/sdk/server/sse.js');
const {ListToolsRequestSchema,CallToolRequestSchema,ListResourcesRequestSchema,ListResourceTemplatesRequestSchema,ReadResourceRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
const random=()=>crypto.randomBytes(24).toString('base64url');
async function createOAuthFixture(options={}){
 const clients=new Map(),pending=new Map(),codes=new Map(),access=new Map(),refresh=new Map(),events=[],sessions=new Map();let authOrigin,mcpUrl,refreshMode='ok',tokenDelay=0,lastTokens;
 const event=async value=>{events.push(value);if(options.logFile)await fs.appendFile(options.logFile,JSON.stringify(value)+'\n');};
 const read=async request=>{let text='';for await(const chunk of request){text+=chunk;if(text.length>32768)throw Error('fixture request limit');}return text;};
 const respond=(response,status,value,headers={})=>{response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers});response.end(JSON.stringify(value));};
 const error=(response,name='invalid_request',status=400)=>respond(response,status,{error:name});
 function mint(clientId){const tokens={access_token:'fixture-access-'+random(),refresh_token:'fixture-refresh-'+random(),token_type:'Bearer',expires_in:options.expiresIn??2,scope:'notes:read'};access.set(tokens.access_token,{clientId,expires:Date.now()+tokens.expires_in*1000});refresh.set(tokens.refresh_token,{clientId});lastTokens=tokens;return tokens;}
 const authServer=http.createServer(async(request,response)=>{try{
  const url=new URL(request.url,authOrigin||'http://127.0.0.1');await event({server:'authorization',method:request.method,path:url.pathname,hasAuthorization:Boolean(request.headers.authorization),hasMcpHeader:Boolean(request.headers['x-mcp-private'])});
  if(request.method==='GET'&&url.pathname==='/.well-known/oauth-authorization-server')return respond(response,200,{issuer:options.issuerMismatch?'https://different.invalid':authOrigin,authorization_endpoint:authOrigin+'/authorize',token_endpoint:authOrigin+'/token',...(options.registration===false?{}:{registration_endpoint:authOrigin+'/register'}),response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256']});
  if(request.method==='POST'&&url.pathname==='/register'){
   if(options.registration===false)return error(response,'registration_not_supported');const info=JSON.parse(await read(request));if(info.token_endpoint_auth_method!=='none'||!Array.isArray(info.redirect_uris)||info.redirect_uris.length!==1)return error(response);
   const client_id='fixture-client-'+random();clients.set(client_id,{redirectUri:info.redirect_uris[0]});await event({event:'registered',publicClient:true,redirectUri:info.redirect_uris[0]});return respond(response,201,{...info,client_id,client_id_issued_at:Math.floor(Date.now()/1000)});
  }
  if(request.method==='GET'&&url.pathname==='/authorize'){
   const q=Object.fromEntries(url.searchParams),client=clients.get(q.client_id);if(!client||client.redirectUri!==q.redirect_uri||q.response_type!=='code'||q.code_challenge_method!=='S256'||!q.code_challenge||q.resource!==mcpUrl)return error(response);
   const requestId=random();pending.set(requestId,q);await event({event:'authorization-page',requestId,state:q.state,redirectUri:q.redirect_uri,resource:q.resource,pkceMethod:q.code_challenge_method});
   response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self' "+new URL(q.redirect_uri).origin+"; frame-ancestors 'none'"});return response.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>资料服务授权</title><style>body{font:16px/1.8 Microsoft YaHei,sans-serif;margin:40px;color:#18382e}button{font:16px Microsoft YaHei;padding:10px 24px;margin-right:12px}small{font-size:14px}</style><h1>资料服务授权</h1><p>允许 Scodex 读取项目资料？</p><p>权限：notes:read</p><small>这是隔离的本机OAuth验收服务，不连接外部账号。</small><form method="post" action="/decision"><input type="hidden" name="request_id" value="'+requestId+'"><p><button name="decision" value="allow">允许授权</button><button name="decision" value="deny">拒绝授权</button></p></form></html>');
  }
  if(request.method==='POST'&&url.pathname==='/decision'){
   const form=new URLSearchParams(await read(request)),q=pending.get(form.get('request_id'));if(!q)return error(response);pending.delete(form.get('request_id'));const target=new URL(q.redirect_uri);target.searchParams.set('state',q.state);
   if(form.get('decision')!=='allow')target.searchParams.set('error','access_denied');else{const code=random();codes.set(code,{...q,expires:Date.now()+60000});target.searchParams.set('code',code);}
   response.writeHead(302,{location:target.href,'cache-control':'no-store','referrer-policy':'no-referrer'});return response.end();
  }
  if(request.method==='POST'&&url.pathname==='/token'){
   const p=new URLSearchParams(await read(request)),grant=p.get('grant_type'),client=clients.get(p.get('client_id'));if(tokenDelay)await new Promise(r=>setTimeout(r,tokenDelay));if(!client)return error(response,'invalid_client');if(p.get('resource')!==mcpUrl)return error(response,'invalid_target');
   if(grant==='authorization_code'){
    const code=codes.get(p.get('code')),valid=code&&code.client_id===p.get('client_id')&&code.redirect_uri===p.get('redirect_uri')&&code.expires>Date.now()&&crypto.createHash('sha256').update(p.get('code_verifier')||'').digest('base64url')===code.code_challenge;
    await event({event:'code-exchange',pkceValid:Boolean(valid),resourceValid:p.get('resource')===mcpUrl});if(!valid)return error(response,'invalid_grant');codes.delete(p.get('code'));return respond(response,200,mint(p.get('client_id')));
   }
   if(grant==='refresh_token'){
    await event({event:'refresh',mode:refreshMode});if(refreshMode==='server_error')return error(response,'server_error',503);if(refreshMode==='invalid_grant')return error(response,'invalid_grant');const old=refresh.get(p.get('refresh_token'));if(!old||old.clientId!==p.get('client_id'))return error(response,'invalid_grant');refresh.delete(p.get('refresh_token'));return respond(response,200,mint(p.get('client_id')));
   }
   return error(response,'unsupported_grant_type');
  }
  return error(response,'not_found',404);
 }catch(errorValue){if(!response.headersSent)respond(response,500,{error:'fixture_error'});else response.end();await event({event:'fixture-error',message:errorValue.message});}});
 await new Promise(r=>authServer.listen(0,'127.0.0.1',r));authOrigin='http://127.0.0.1:'+authServer.address().port;
 const mcpServer=http.createServer(async(request,response)=>{try{
  const url=new URL(request.url,mcpUrl||'http://127.0.0.1');
  if(request.method==='GET'&&url.pathname.startsWith('/.well-known/oauth-protected-resource'))return respond(response,200,{resource:options.resourceOverride||mcpUrl,authorization_servers:[authOrigin],scopes_supported:['notes:read']});
  const token=(request.headers.authorization||'').replace(/^Bearer /,''),grant=access.get(token),valid=grant&&grant.expires>Date.now();await event({server:'mcp',method:request.method,path:url.pathname,authenticated:Boolean(valid),hasMcpHeader:request.headers['x-mcp-private']==='controlled-header'});
  if(url.pathname!=='/mcp'&&!(options.sse&&url.pathname==='/messages'))return error(response,'not_found',404);
  if(!valid){response.writeHead(401,{'www-authenticate':'Bearer resource_metadata="'+new URL('/.well-known/oauth-protected-resource/mcp',mcpUrl).href+'", scope="notes:read"'});return response.end();}
  if(options.sse&&request.method==='POST'&&url.pathname==='/messages'){const session=sessions.get(url.searchParams.get('sessionId'));if(!session)return error(response,'not_found',404);await session.transport.handlePostMessage(request,response);return;}
  if(request.method!==(options.sse?'GET':'POST')){response.writeHead(405);return response.end();}
  const server=new Server({name:'OAuth资料服务',version:'1.0.0'},{capabilities:{resources:{},tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'echo',description:'返回获授权的中文资料',inputSchema:{type:'object',properties:{message:{type:'string'}},required:['message'],additionalProperties:false},annotations:{readOnlyHint:true}}]}));
  server.setRequestHandler(CallToolRequestSchema,async req=>{await event({event:'tool-call',message:req.params.arguments?.message});return{content:[{type:'text',text:'O8351 · '+req.params.arguments?.message+' · '+token}]};});
  server.setRequestHandler(ListResourcesRequestSchema,async()=>({resources:[{uri:'oauth://project',name:'已授权的项目资料',mimeType:'text/plain'}]}));
  server.setRequestHandler(ListResourceTemplatesRequestSchema,async()=>({resourceTemplates:[]}));
  server.setRequestHandler(ReadResourceRequestSchema,async()=>{await event({event:'resource-read'});return{contents:[{uri:'oauth://project',text:'OAuth真实资料 O8351 · '+token}]};});
  const transport=options.sse?new SSEServerTransport('/messages',response):new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});if(options.sse)sessions.set(transport.sessionId,{transport,server});await server.connect(transport);response.once('close',()=>{sessions.delete(transport.sessionId);transport.close();server.close();});if(!options.sse)await transport.handleRequest(request,response);
 }catch(errorValue){if(!response.headersSent)respond(response,500,{error:'fixture_error'});else response.end();await event({event:'fixture-error',message:errorValue.message});}});
 await new Promise(r=>mcpServer.listen(0,'127.0.0.1',r));mcpUrl='http://127.0.0.1:'+mcpServer.address().port+'/mcp';
 return{url:mcpUrl,issuer:authOrigin,events,registerPublicClient:(id,redirectUri)=>clients.set(id,{redirectUri}),tokens:()=>lastTokens,setRefreshMode:value=>{refreshMode=value;},setTokenDelay:value=>{tokenDelay=value;},async close(){mcpServer.closeAllConnections();authServer.closeAllConnections();await Promise.all([new Promise(r=>mcpServer.close(r)),new Promise(r=>authServer.close(r))]);}};
}
async function consent(url,decision='allow'){
 const page=await fetch(url),html=await page.text(),id=html.match(/name="request_id" value="([^"]+)"/)?.[1];if(!id)throw Error('OAuth fixture page missing request id');const result=await fetch(new URL('/decision',url),{method:'POST',body:new URLSearchParams({request_id:id,decision}),redirect:'manual'});const location=result.headers.get('location');if(!location)throw Error('OAuth fixture missing redirect');return fetch(location);
}
module.exports={createOAuthFixture,consent};
