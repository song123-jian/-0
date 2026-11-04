const path = require('node:path');
const { observeCommit } = require('./task-file-changes.cjs');
const committing = new Set();

// Hash validation and replacement form one commit across all model toolboxes.
// This covers Scodex model writes; it does not lock out external applications.
async function withFileCommit(target, commit) {
  const absolute = path.resolve(target);
  const key = process.platform === 'win32' ? absolute.toLowerCase() : absolute;
  if (committing.has(key)) throw new Error('另一个任务正在保存此文件，请重新读取后再修改。');
  committing.add(key);
  try { return await observeCommit(absolute, commit); }
  finally { committing.delete(key); }
}
module.exports = { withFileCommit };
