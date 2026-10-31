const crypto=require('node:crypto'),http=require('node:http');
const {auth,refreshAuthorization}=require('@modelcontextprotocol/sdk/client/auth.js');
const {OAuthTokensSchema}=require('@modelcontextprotocol/sdk/shared/auth.js');
const {InvalidGrantError,InvalidClientError,UnauthorizedClientError}=require('@modelcontextprotocol/sdk/server/auth/errors.js');
const {oauthConfigKey}=require('./mcp-store.cjs');
const {boundedMcpResponse,isSseMessageRequest}=require('./mcp-network.cjs');
const loopback=url=>['127.0.0.1','localhost','[::1]'].includes(url.hostname);
function ownError(message){const error=Error(message);error.scodexOAuth=true;return error;}
function validOAuthUrl(value,serverUrl){
  const url=new URL(String(value)),server=new URL(serverUrl);
  if(String(value).length>8192||url.username||url.password||url.hash||url.protocol!=='https:'&&!(url.protocol==='http:'&&server.protocol==='http:'&&loopback(server)&&loopback(url)))throw ownError('OAuth地址必须为HTTPS，HTTP仅允许本机回环测试。');
  return url;
}
function sameUrl(a,b){try{return new URL(a).href===new URL(b).href;}catch{return false;}}
async function callbackListener({id,port=0,state,signal}){
  const pathname='/scodex/oauth/'+id;let settle,fail,finished=false,closed=false;
  const promise=new Promise((resolve,reject)=>{settle=resolve;fail=reject;});promise.catch(()=>{});
  const server=http.createServer({maxHeaderSize:8192},(request,response)=>{
    const reply=(status,text)=>{response.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; frame-ancestors 'none'",'referrer-policy':'no-referrer','x-content-type-options':'nosniff'});response.end(text);};
    let url;try{if((request.url||'').length>8192)throw Error();url=new URL(request.url,'http://127.0.0.1:'+server.address().port);}catch{return reply(400,'无效的授权回调。');}
    if(request.method!=='GET'||request.headers.host!=='127.0.0.1:'+server.address().port||url.pathname!==pathname)return reply(404,'未找到授权回调。');
    const returned=url.searchParams.getAll('state');
    if(returned.length!==1||Buffer.byteLength(returned[0])!==Buffer.byteLength(state)||!crypto.timingSafeEqual(Buffer.from(returned[0]),Buffer.from(state)))return reply(400,'授权状态不匹配，请回到Scodex重新授权。');
    if(finished)return reply(409,'此授权回调已经处理。');
    const codes=url.searchParams.getAll('code'),errors=url.searchParams.getAll('error');
    if(errors.length){finished=true;reply(400,'授权未获批准，可关闭此窗口返回Scodex。');return fail(ownError('用户或授权服务拒绝了本次OAuth授权。'));}
    if(codes.length!==1||!codes[0]||codes[0].length>4096)return reply(400,'授权码缺失或无效。');
    finished=true;reply(200,'授权结果已收到，Scodex正在完成连接。');settle(codes[0]);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);}).catch(()=>{throw ownError('本机OAuth回调端口不可用，请修改回调端口后重试。');});
  const abort=()=>{if(!finished){finished=true;fail(ownError('OAuth授权已取消或超时。'));}server.closeAllConnections();server.close();};
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  return{uri:'http://127.0.0.1:'+server.address()?.port+pathname,promise,async close(){if(closed)return;closed=true;signal.removeEventListener('abort',abort);if(!finished){finished=true;fail(ownError('OAuth授权已取消。'));}server.closeAllConnections();await new Promise(resolve=>server.close(()=>resolve()));}};
}
function createMcpOAuth({store,getWorkspaceRoot=()=>'',openAuthorization,onChanged=()=>{},authorizeUrl=async()=>{},timeoutMs=300000}){
  const flows=new Map(),errors=new Map();
  const changed=()=>{Promise.resolve().then(onChanged).catch(()=>{});};
  function build(config,secrets,{controller=new AbortController(),guard=async()=>{},interactive=false,flow,secretValues=[],onSseEnd=()=>{}}={}){
    const key=oauthConfigKey(config),root=getWorkspaceRoot(),remembered=secretValues;let value=structuredClone(secrets.oauth||{}),verifier='',refreshing=null;
    function remember(text){if(typeof text==='string'&&text&&!remembered.includes(text))remembered.push(text);}
    for(const token of [value.tokens?.access_token,value.tokens?.refresh_token])remember(token);
    async function current(){if(controller.signal.aborted)throw ownError('OAuth授权或连接已停止。');if(getWorkspaceRoot()!==root)throw ownError('项目已变化，旧OAuth授权已停止。');await guard();}
    async function persist(){await current();await store.saveOAuth(config.id,value,key);await current();changed();}
    function issuer(){return value.discovery?.authorizationServerUrl;}
    async function network(input,init={},sseMessage=false){
      await current();const target=validOAuthUrl(typeof input==='string'||input instanceof URL?input:input.url,config.url),isMcp=sameUrl(target,config.url)||(sseMessage&&config.transport==='sse'&&isSseMessageRequest(input,init,config.url));
      const headers=new Headers(init.headers||{});
      if(!isMcp&&headers.has('authorization'))throw ownError('已阻止向OAuth元数据或其他地址转发MCP认证。');
      if(isMcp)for(const[k,v]of Object.entries(secrets.headers||{}))headers.set(k,v);
      await authorizeUrl(target);
      const signal=AbortSignal.any([controller.signal,...(init.signal?[init.signal]:[]),...(!isMcp?[AbortSignal.timeout(15000)]:[])]);
      const response=await fetch(target,{...init,headers,redirect:'error',signal});
      return boundedMcpResponse(response,isMcp?2_000_000:256*1024,{eventStream:isMcp&&config.transport==='sse',onStreamEnd:onSseEnd});
    }
    async function acceptTokens(tokens){
      const parsed=OAuthTokensSchema.parse(tokens);if(!tokens.issuer||!sameUrl(tokens.issuer,issuer()))throw ownError('OAuth令牌与授权服务器不匹配。');
      if(parsed.access_token.length>32768||(parsed.refresh_token||'').length>32768||/\s/.test(parsed.access_token)||parsed.token_type.toLowerCase()!=='bearer')throw ownError('OAuth返回的Bearer令牌无效。');
      remember(parsed.access_token);remember(parsed.refresh_token);value={...value,tokens:{...parsed,issuer:tokens.issuer},expiresAt:Number.isFinite(parsed.expires_in)?Date.now()+Math.min(parsed.expires_in,31536000)*1000:0};
      if(!interactive)await persist();
    }
    const provider={
      get redirectUrl(){return value.redirectUri;},
      get clientMetadata(){return{client_name:'Scodex工作台',redirect_uris:[value.redirectUri],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',...(config.oauthScope?{scope:config.oauthScope}:{})};},
      state:()=>flow?.state,
      clientInformation:()=>value.clientInformation||(config.oauthClientId?{client_id:config.oauthClientId,issuer:config.oauthIssuer,token_endpoint_auth_method:'none'}:undefined),
      async saveClientInformation(info){if(!info||typeof info.client_id!=='string'||info.client_id.length>1024||info.client_secret||info.token_endpoint_auth_method&&info.token_endpoint_auth_method!=='none'||!sameUrl(info.issuer,issuer()))throw ownError('OAuth服务必须支持无客户端密钥的桌面公共客户端。');value={...value,clientInformation:info};await persist();},
      async tokens(){
        if(value.tokens&&value.expiresAt&&value.expiresAt<=Date.now()&&value.tokens.refresh_token&&!interactive){
          if(!refreshing)refreshing=(async()=>{await current();if(!sameUrl(value.tokens.issuer,issuer()))throw ownError('OAuth令牌所属服务器已变化。');try{const tokens=await refreshAuthorization(issuer(),{metadata:value.discovery.authorizationServerMetadata,clientInformation:provider.clientInformation(),refreshToken:value.tokens.refresh_token,resource:new URL(config.url),fetchFn:network});await acceptTokens({...tokens,issuer:issuer()});}catch(error){if(error instanceof InvalidGrantError||error instanceof InvalidClientError||error instanceof UnauthorizedClientError){value={...value,tokens:undefined,expiresAt:0};await persist();throw ownError('OAuth登录已过期，请重新授权。');}if(error.scodexOAuth)throw error;throw ownError('OAuth续期暂时失败，请检查网络后重新连接。');}})().finally(()=>{refreshing=null;});
          await refreshing;
        }
        await current();return value.tokens;
      },
      saveTokens:acceptTokens,
      async redirectToAuthorization(url){
        await current();if(!interactive||!openAuthorization)throw ownError('此MCP服务需要网页登录，请点击“授权并连接”或“重新授权”。');
        validOAuthUrl(url,config.url);await authorizeUrl(url);flow.origin=new URL(url).origin;changed();
        flow.window=await openAuthorization(url,{signal:controller.signal,redirectUri:value.redirectUri,serverUrl:config.url,onClose:()=>controller.abort()});
      },
      saveCodeVerifier(code){verifier=code;remember(code);},codeVerifier:()=>{if(!verifier)throw ownError('OAuth校验已失效，请重新授权。');return verifier;},
      async validateResourceURL(serverUrl,resource){const actual=new URL(serverUrl);if(!sameUrl(actual,config.url)||resource&&!sameUrl(resource,config.url))throw ownError('OAuth资源地址与当前MCP服务不匹配。');return actual;},
      discoveryState:()=>value.discovery,
      async saveDiscoveryState(discovery){
        const base=validOAuthUrl(discovery.authorizationServerUrl,config.url),metadata=discovery.authorizationServerMetadata;
        if(config.oauthIssuer&&!sameUrl(base,config.oauthIssuer)||metadata?.issuer&&!sameUrl(metadata.issuer,base))throw ownError('OAuth发现的授权服务器与配置或issuer声明不匹配。');
        for(const name of ['authorization_endpoint','token_endpoint','registration_endpoint'])if(metadata?.[name])validOAuthUrl(metadata[name],config.url);
        if(discovery.resourceMetadataUrl)validOAuthUrl(discovery.resourceMetadataUrl,config.url);
        if(discovery.resourceMetadata?.resource&&!sameUrl(discovery.resourceMetadata.resource,config.url))throw ownError('OAuth发现的资源不是当前MCP服务。');
        if(value.tokens?.issuer&&!sameUrl(value.tokens.issuer,base))throw ownError('OAuth授权服务器已变化，请清除本机授权后重试。');
        value={...value,discovery};await persist();
      },
      async invalidateCredentials(scope){if(scope==='all'||scope==='client')delete value.clientInformation;if(scope==='all'||scope==='tokens'){delete value.tokens;value.expiresAt=0;}if(scope==='all'||scope==='discovery')delete value.discovery;if(scope==='all'||scope==='verifier')verifier='';await persist();},
    };
    return{provider,fetch:network,transportFetch:(input,init)=>network(input,init,true),remembered,controller,current,getState:()=>value,setState:next=>{value=next;},persist,remember,dispose:()=>controller.abort()};
  }
  async function authorize(id,{signal}={}){
    if(signal?.aborted)throw ownError('OAuth授权已取消。');
    if(flows.size)throw ownError('另一项OAuth授权正在进行，请先完成或取消。');
    const {config,secrets}=await store.load(id);if(!['http','sse'].includes(config.transport)||config.authMode!=='oauth')throw ownError('此连接未配置OAuth。');
    if(flows.size)throw ownError('另一项OAuth授权正在进行。');
    const controller=new AbortController(),flow={controller,state:crypto.randomBytes(32).toString('hex'),origin:'',promise:null};flows.set(id,flow);const externalAbort=()=>controller.abort();signal?.addEventListener('abort',externalAbort,{once:true});if(signal?.aborted)externalAbort();errors.delete(id);changed();
    const task=(async()=>{let callback,client,success=false;const timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const previous=secrets.oauth||{};let port=config.oauthCallbackPort||0;
        if(previous.redirectUri){const saved=new URL(previous.redirectUri);if(saved.hostname!=='127.0.0.1'||saved.protocol!=='http:'||saved.pathname!=='/scodex/oauth/'+id||saved.search||saved.hash)throw ownError('已保存的OAuth回调无效。');port=Number(saved.port);}
        callback=await callbackListener({id,port,state:flow.state,signal:controller.signal});
        client=build(config,secrets,{controller,interactive:true,flow});client.setState({...previous,tokens:undefined,expiresAt:0,redirectUri:callback.uri});await client.persist();
        const first=await auth(client.provider,{serverUrl:config.url,scope:config.oauthScope||undefined,fetchFn:client.fetch});
        if(first==='REDIRECT'){const code=await callback.promise;client.remember(code);await client.current();const final=await auth(client.provider,{serverUrl:config.url,authorizationCode:code,scope:config.oauthScope||undefined,fetchFn:client.fetch});if(final!=='AUTHORIZED')throw ownError('OAuth授权尚未完成。');}
        await client.current();if(!client.getState().tokens?.access_token)throw ownError('OAuth服务未返回访问令牌。');await client.persist();success=true;
      }catch(error){const message=controller.signal.aborted?'OAuth授权已取消或超时。':error.scodexOAuth?error.message:'OAuth授权失败，请核对服务、公共客户端和回调配置。';errors.set(id,message);throw ownError(message);}
      finally{
        clearTimeout(timer);if(!success&&client){const clean={...client.getState(),tokens:undefined,expiresAt:0};await store.saveOAuth(id,clean,oauthConfigKey(config)).catch(()=>{});}
        await flow.window?.dispose?.();await callback?.close();signal?.removeEventListener('abort',externalAbort);flows.delete(id);changed();
      }
    })();flow.promise=task;return task;
  }
  return{authorize,client:build,status:id=>({authorizing:flows.has(id),authOrigin:flows.get(id)?.origin||'',authError:errors.get(id)||''}),cancel:id=>{const flow=flows.get(id);if(!flow)return false;flow.controller.abort();return true;},cancelAll:()=>{for(const flow of flows.values())flow.controller.abort();},async settleAll(){await Promise.allSettled([...flows.values()].map(f=>f.promise));},settle:async id=>{await flows.get(id)?.promise?.catch(()=>{});},clearError:id=>errors.delete(id)};
}
module.exports={createMcpOAuth,callbackListener,validOAuthUrl};
