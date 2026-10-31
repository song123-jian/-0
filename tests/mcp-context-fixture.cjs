// Real MCP SDK service, exposing resources/prompts without a tools capability.
const fs=require('node:fs/promises'),http=require('node:http');
const {Server}=require('@modelcontextprotocol/sdk/server/index.js');
const {StdioServerTransport}=require('@modelcontextprotocol/sdk/server/stdio.js');
const {StreamableHTTPServerTransport}=require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {ListResourcesRequestSchema,ListResourceTemplatesRequestSchema,ReadResourceRequestSchema,ListPromptsRequestSchema,GetPromptRequestSchema}=require('@modelcontextprotocol/sdk/types.js');
function createContextFixture({logFile=process.env.MCP_CONTEXT_LOG,secret=process.env.MCP_CONTEXT_PRIVATE||'',badPagination=false,noTemplates=false}={}) {
  const server=new Server({name:'Scodex资料验收服务',version:'1.0.0'},{capabilities:{resources:{listChanged:true},prompts:{listChanged:true}}});
  const log=async value=>{if(logFile)await fs.appendFile(logFile,JSON.stringify({...value,pid:process.pid})+'\n');};
  server.setRequestHandler(ListResourcesRequestSchema,async request=>{
    await log({method:'resources/list',cursor:request.params?.cursor});
    return request.params?.cursor?{resources:['binary','big','slow','notify','failure'].map(name=>({uri:'notes://'+name,name})),...(badPagination?{nextCursor:'page-2'}:{})}:{resources:[{uri:'notes://readme',name:'项目说明',description:'中文资料 '+secret},{uri:'notes://multi',name:'多段资源'}],nextCursor:'page-2'};
  });
  if(!noTemplates)server.setRequestHandler(ListResourceTemplatesRequestSchema,async()=>({resourceTemplates:[{uriTemplate:'notes://projects/{project}/notes{?format}',name:'项目资料模板',description:'按项目和格式读取中文'}]}));
  server.setRequestHandler(ListPromptsRequestSchema,async()=>({prompts:[{name:'review',title:'中文审阅模板',description:'根据主题整理资料',arguments:[{name:'topic',description:'审阅主题',required:true}]}]}));
  server.setRequestHandler(ReadResourceRequestSchema,async(request,extra)=>{
    const uri=request.params.uri;await log({method:'resources/read',uri});
    if(uri==='notes://slow')await new Promise(resolve=>{const timer=setTimeout(resolve,30000);extra.signal.addEventListener('abort',()=>{clearTimeout(timer);log({cancelled:uri}).catch(()=>{});resolve();},{once:true});});
    if(uri==='notes://failure')throw Error('受控读取失败 '+secret);
    if(uri==='notes://notify')await server.notification({method:'notifications/resources/list_changed'});
    if(uri==='notes://binary')return{contents:[{uri,mimeType:'application/octet-stream',blob:Buffer.from('controlled-binary-payload').toString('base64')}]};
    if(uri==='notes://big')return{contents:[{uri,text:'大'.repeat(24000),mimeType:'text/plain'}]};
    if(uri==='notes://multi')return{contents:[{uri,text:'第一段中文'},{uri:uri+'/second',text:'第二段中文'}]};
    return{contents:[{uri,mimeType:'text/markdown',text:'资料编号 C6142 · '+uri+' · '+secret}]};
  });
  server.setRequestHandler(GetPromptRequestSchema,async request=>{await log({method:'prompts/get',name:request.params.name,arguments:request.params.arguments});return{description:'中文审阅',messages:[{role:'user',content:{type:'text',text:'审阅主题：'+request.params.arguments?.topic+' '+secret}},{role:'assistant',content:{type:'resource',resource:{uri:'notes://embedded',text:'嵌入的中文资料 '+secret}}},{role:'user',content:{type:'image',data:'AA==',mimeType:'image/png'}}]};});
  return server;
}
async function createContextHttp(options={}) {
  const seen=[],listener=http.createServer(async(req,res)=>{
    seen.push({method:req.method,auth:req.headers.authorization});if(options.token&&req.headers.authorization!=='Bearer '+options.token){res.writeHead(401).end();return;}
    if(req.method!=='POST'){res.writeHead(405).end();return;}
    const server=createContextFixture(options),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    try{await server.connect(transport);res.once('close',()=>{transport.close();server.close();});await transport.handleRequest(req,res);}catch{if(!res.headersSent)res.writeHead(500);res.end();}
  });await new Promise(r=>listener.listen(0,'127.0.0.1',r));
  return{url:'http://127.0.0.1:'+listener.address().port+'/mcp',seen,close:async()=>{listener.closeAllConnections();await new Promise(r=>listener.close(r));}};
}
if(require.main===module)createContextFixture().connect(new StdioServerTransport()).catch(()=>{process.exitCode=1;});
module.exports={createContextHttp};
