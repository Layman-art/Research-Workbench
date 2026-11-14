#!/usr/bin/env bash
# Research Workbench · macOS 界面截图脚本
# 用法：在「终端」中运行（需已授予该终端 App「辅助功能」和「屏幕与系统音频录制」权限）
#   bash scripts/capture-screenshots.sh
# 会自动激活应用、依次切换 9 个页面，并把截图写入 docs/assets/

set -euo pipefail
cd "$(dirname "$0")/.."

ASSETS="docs/assets"
mkdir -p "$ASSETS"

# 激活应用
osascript -e 'tell application "Research Workbench" to activate'
sleep 1

# 动态读取窗口位置与大小
GEOM=$(osascript -e 'tell application "System Events" to tell process "research-workbench" to get {position, size} of window 1')
GEOM=$(echo "$GEOM" | tr -d ",")
read -r WX WY WW WH <<< "$GEOM"

if [[ -z "$WX" ]]; then
  echo "错误：无法读取窗口位置。请确认 Research Workbench 已打开。"
  exit 1
fi

echo "窗口区域: ($WX, $WY) ${WW}x${WH}"

shoot() {
  local out="$1"
  # 先把 app 置前，避免被终端窗口遮挡
  osascript -e 'tell application "Research Workbench" to activate'
  sleep 1.2
  screencapture -x -R "$WX,$WY,$WW,$WH" "$ASSETS/$out"
  echo "  ✓ 已截图 -> $ASSETS/$out"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

click_sidebar() {
  local prefix="$1"
  osascript "$SCRIPT_DIR/click_by_name.applescript" "$prefix"
  sleep 1
}

echo "== 1/9 概览（Dashboard）=="
shoot "dashboard.png"

echo "== 2/9 科研项目（列表）=="
click_sidebar "科研项目"
shoot "projects.png"

echo "== 3/9 科研项目（看板）=="
click_sidebar "看板"
shoot "project-board.png"
click_sidebar "列表"
sleep 0.5

echo "== 4/9 科研方向 =="
click_sidebar "科研方向"
shoot "directions.png"

echo "== 5/9 待办事项 =="
click_sidebar "待办事项"
shoot "todo.png"

echo "== 6/9 日程安排 =="
click_sidebar "日程安排"
shoot "schedule.png"

echo "== 7/9 文献笔记 =="
click_sidebar "文献笔记"
shoot "literature.png"

echo "== 8/9 设置与数据 =="
click_sidebar "设置与数据"
shoot "settings.png"

echo "== 9/9 全局搜索 =="
click_sidebar "工作台总览"
sleep 0.5
# 聚焦搜索框并输入关键词
osascript -e 'tell application "System Events" to tell process "research-workbench" to set value of text field 1 of window 1 to "AIGC"' 2>/dev/null || true
sleep 1
shoot "search.png"

echo ""
echo "全部完成。截图已保存到 $ASSETS/"
ls -la "$ASSETS"