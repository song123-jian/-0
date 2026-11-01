const path = require('node:path');

const FILE_OPEN_MODES = Object.freeze(['vscode', 'visual-studio', 'default', 'explorer', 'git-bash']);
const FILE_OPEN_LABELS = Object.freeze({
  vscode: 'VS Code',
  'visual-studio': 'Visual Studio',
  default: 'Default app',
  explorer: 'File Explorer',
  'git-bash': 'Git Bash',
});

function normalizeFileOpenMode(value) {
  if (value === 'system') return 'default';
  if (value === 'builtin') return 'vscode';
  return FILE_OPEN_MODES.includes(value) ? value : 'vscode';
}

function fileOpenDefinitions(env = process.env) {
  const programFiles = env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const localAppData = env.LOCALAPPDATA || '';
  const local = (folder, executable) => localAppData ? [path.join(localAppData, folder, executable)] : [];
  return {
    vscode: [
      path.join(programFiles, 'Microsoft VS Code', 'Code.exe'),
      path.join(programFilesX86, 'Microsoft VS Code', 'Code.exe'),
      ...local('Programs', path.join('Microsoft VS Code', 'Code.exe')),
    ],
    'visual-studio': [
      ...['Community', 'Professional', 'Enterprise', 'BuildTools'].flatMap((edition) => [
        path.join(programFiles, 'Microsoft Visual Studio', '2022', edition, 'Common7', 'IDE', 'devenv.exe'),
        path.join(programFilesX86, 'Microsoft Visual Studio', '2022', edition, 'Common7', 'IDE', 'devenv.exe'),
        path.join(programFiles, 'Microsoft Visual Studio', '2019', edition, 'Common7', 'IDE', 'devenv.exe'),
        path.join(programFilesX86, 'Microsoft Visual Studio', '2019', edition, 'Common7', 'IDE', 'devenv.exe'),
      ]),
    ],
    'git-bash': [
      path.join(programFiles, 'Git', 'git-bash.exe'),
      path.join(programFilesX86, 'Git', 'git-bash.exe'),
      ...local('Programs', path.join('Git', 'git-bash.exe')),
    ],
  };
}

async function locateFileOpenExecutable(mode, fsModule, env = process.env) {
  const candidates = fileOpenDefinitions(env)[mode] || [];
  for (const candidate of candidates) {
    try {
      if ((await fsModule.stat(candidate)).isFile()) return candidate;
    } catch {}
  }
  throw new Error(`${FILE_OPEN_LABELS[mode] || '所选程序'}尚未安装或无法定位。`);
}

module.exports = { FILE_OPEN_MODES, FILE_OPEN_LABELS, normalizeFileOpenMode, fileOpenDefinitions, locateFileOpenExecutable };
