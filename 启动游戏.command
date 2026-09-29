#!/bin/zsh
# Double-click in Finder. This window owns the local preview process.
GAME_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$GAME_DIR" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
GAME_NODE="$(command -v node)"
if [[ -z "$GAME_NODE" && -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  GAME_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ -z "$GAME_NODE" ]]; then
  print '找不到 Node.js。请在 Codex 中让我帮你启动。'
  read '?按回车关闭。'
  exit 1
fi
"$GAME_NODE" scripts/start-local.mjs
GAME_EXIT=$?
if [[ "$GAME_EXIT" -ne 0 ]]; then
  read '?启动没有成功；保留上面的提示，按回车关闭。'
fi
exit "$GAME_EXIT"
