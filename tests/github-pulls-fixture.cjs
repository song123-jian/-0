// Controlled GitHub-compatible HTTP service. No public repository is mutated.
const http = require('node:http');
const crypto = require('node:crypto');
async function startGitHubFixture({ head, repository = 'scodex-fixture/workbench' }) {
  const state = { head, repository, pulls: [], requests: [], writes: [], memoryWrites: [], memoryFile: null, confirmed: [], ahead: 1, failStatus: 0, failReadback: false, mismatch: false, more: false };
  const token = 'fixture_' + crypto.randomBytes(24).toString('hex');
  const route = '/repos/' + repository;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const authenticated = req.headers.authorization === 'Bearer ' + token;
    const entry = { method: req.method, route: url.pathname + url.search, authenticated };
    state.requests.push(entry);
    const send = (code, value, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(value)); };
    try {
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100000) return send(413, {}); }
      const body = raw ? JSON.parse(raw) : {};
      if (state.onRequest) await state.onRequest(entry);
      if (state.failStatus) return send(state.failStatus, { message: 'private-service-output-not-for-ui' });
      if (url.pathname === '/user') return authenticated ? send(200, { login: 'scodex-fixture' }) : send(401, {});
      if (req.method !== 'GET' && !authenticated) return send(401, {});
      if (req.method === 'GET' && url.pathname === route) return send(200, { default_branch: 'main', allow_merge_commit: true, allow_squash_merge: true });
      const memoryPath = route + '/contents/memory/scodex-learning.json';
      if (url.pathname === memoryPath && req.method === 'GET') {
        if (url.searchParams.get('ref') !== 'main') return send(404, {});
        if (!state.memoryFile) return send(404, { message: 'Not Found' });
        return send(200, { path: 'memory/scodex-learning.json', sha: state.memoryFile.sha, encoding: 'base64', content: state.memoryFile.content });
      }
      if (url.pathname === memoryPath && req.method === 'PUT') {
        if (body.branch !== 'main' || body.message !== 'Update encrypted Scodex learning memory') return send(422, {});
        if (state.memoryFile ? body.sha !== state.memoryFile.sha : body.sha !== undefined) return send(409, {});
        const encoded = String(body.content || '').replace(/\s/g, ''), bytes = Buffer.from(encoded, 'base64');
        if (!encoded || bytes.toString('base64') !== encoded) return send(422, {});
        const sha = crypto.createHash('sha1').update('memory:' + bytes.toString('utf8')).digest('hex');
        const previous = state.memoryFile;
        state.memoryFile = { sha, content: encoded };
        state.memoryWrites.push({ path: 'memory/scodex-learning.json', branch: body.branch, previousSha: body.sha || '', sha, content: encoded });
        return send(previous ? 200 : 201, { content: { path: 'memory/scodex-learning.json', sha } });
      }
      if (req.method === 'GET' && url.pathname.startsWith(route + '/git/ref/heads/')) return send(200, { object: { sha: state.head } });
      if (req.method === 'GET' && url.pathname.startsWith(route + '/compare/')) return send(200, { ahead_by: state.ahead });
      if (req.method === 'GET' && url.pathname === route + '/pulls') {
        let values = state.pulls.filter(p => !url.searchParams.get('state') || url.searchParams.get('state') === 'all' || p.state === url.searchParams.get('state'));
        const headFilter = url.searchParams.get('head'), base = url.searchParams.get('base');
        if (headFilter) values = values.filter(p => repository.split('/')[0] + ':' + p.head.ref === headFilter);
        if (base) values = values.filter(p => p.base.ref === base);
        const perPage = Number(url.searchParams.get('per_page') || 20), page = Number(url.searchParams.get('page') || 1);
        const headers = state.more && page === 1 ? { link: '<http://127.0.0.1/ignored>; rel="next"' } : {};
        return send(200, values.slice((page - 1) * perPage, page * perPage), headers);
      }
      if (req.method === 'POST' && url.pathname === route + '/pulls') {
        const number = state.pulls.length + 1;
        const pull = { number, node_id: 'PR_Fixture_' + number, title: body.title, body: body.body, draft: body.draft, state: 'open', merged: false, user: { login: 'scodex-fixture' }, head: { ref: body.head, sha: state.head }, base: { ref: body.base }, updated_at: new Date().toISOString(), mergeable: true, mergeable_state: 'clean', additions: 12, deletions: 3, changed_files: 2, commits: 1 };
        state.pulls.push(pull); state.writes.push({ type: 'create', number, body }); return send(201, pull);
      }
      if (req.method === 'POST' && url.pathname === '/graphql') {
        const pull = state.pulls.find(p => p.node_id === body.variables?.id);
        if (!pull) return send(200, { errors: [{ message: 'Unknown pull' }] });
        state.writes.push({ type: 'ready', number: pull.number });
        if (!state.mismatch) pull.draft = false;
        return send(200, { data: { markPullRequestReadyForReview: { pullRequest: { number: pull.number, isDraft: false } } } });
      }
      const match = url.pathname.match(new RegExp('^' + route + '/pulls/([0-9]+)(/files|/merge)?$'));
      if (match) {
        const number = Number(match[1]), pull = state.pulls.find(p => p.number === number);
        if (!pull) return send(404, {});
        if (req.method === 'GET' && !match[2]) {
          if (state.failReadback && state.writes.length) return send(503, {});
          return send(200, pull);
        }
        if (req.method === 'GET' && match[2] === '/files') return send(200, [
          { filename: 'src/工作台.jsx', status: 'modified', additions: 10, deletions: 3, patch: '@@ -1,2 +1,3 @@\n-旧界面\n+清晰的工作台\n+默认折叠详情' },
          { filename: 'docs/使用说明.md', status: 'added', additions: 2, deletions: 0, patch: '@@ -0,0 +1,2 @@\n+操作说明\n+验证结果' },
        ]);
        if (req.method === 'PUT' && match[2] === '/merge') {
          if (body.sha !== pull.head.sha) return send(409, {});
          if (pull.draft || pull.state !== 'open' || !pull.mergeable) return send(405, {});
          state.writes.push({ type: 'merge', number, body });
          const merged = crypto.createHash('sha1').update('merge:' + pull.head.sha).digest('hex');
          if (!state.mismatch) Object.assign(pull, { state: 'closed', merged: true, merged_at: new Date().toISOString(), merge_commit_sha: merged });
          return send(200, { merged: true, sha: merged });
        }
      }
      send(404, {});
    } catch { if (!res.headersSent) send(500, {}); else res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, token, endpoint: 'http://127.0.0.1:' + server.address().port, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
module.exports = { startGitHubFixture };
