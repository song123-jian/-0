const VALID_ID=/^[A-Za-z0-9_-]{1,100}$/;
function createChatRuns(){
  const requests=new Map();
  function begin(requestId,conversationId=''){
    if(typeof requestId!=='string'||!VALID_ID.test(requestId)||typeof conversationId!=='string'||conversationId&&!VALID_ID.test(conversationId))throw Error('聊天请求标识无效。');
    if(requests.has(requestId))throw Error('此请求仍在运行。');
    if(conversationId&&[...requests.values()].some(r=>r.conversationId===conversationId))throw Error('此聊天已有任务运行，请等待或停止后再发送。');
    const request={requestId,conversationId};requests.set(requestId,request);return request;
  }
  function assertRetained(library){
    for(const request of requests.values()){if(!request.conversationId)continue;const chat=library?.conversations?.find(c=>c.id===request.conversationId);if(!chat||chat.archivedAt)throw Error('运行中的聊天不能删除或归档，请先停止对应任务。');}
  }
  return{begin,finish:id=>requests.delete(id),assertRetained,size:()=>requests.size};
}
module.exports={createChatRuns};
