const HISTORY_KEY = "orbitMergeHistory";
const LEVEL_NAMES = { happiness: "幸福关", beauty: "美丽关", handsome: "帅气关" };

function loadHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch (_) {
    return [];
  }
}

function renderPlayerHistory(player, elementId) {
  const element = document.getElementById(elementId);
  const records = loadHistory().filter(item => item.player === player).slice(-12).reverse();
  if (!records.length) {
    element.innerHTML = '<p class="history-empty">还没有游戏记录</p>';
    return;
  }
  element.innerHTML = records.map(item => {
    const date = new Date(item.time);
    const dateText = `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    return `<div class="history-item"><div><strong>${LEVEL_NAMES[item.level] || "未知关卡"}</strong><span>${item.score}分</span></div><small>${dateText}</small></div>`;
  }).join("");
}

renderPlayerHistory("xuehuhu", "historyXuehuhu");
renderPlayerHistory("buhuhu", "historyBuhuhu");
