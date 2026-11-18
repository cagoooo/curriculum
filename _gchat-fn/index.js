/**
 * notifyCurriculumChat — Google Chat webhook notifier
 * 收到與 notifyCurriculum 相同格式的 POST，轉發 cardsV2 至 Google Chat space。
 * Webhook URL 存在 Firebase 環境變數 GCHAT_WEBHOOK（用 firebase functions:secrets:set 或
 * functions:config:set 設定，不寫入原始碼）。
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');

const GCHAT_WEBHOOK = defineSecret('GCHAT_WEBHOOK');

// 狀態 → 顏色 & icon 映射
const STATUS_MAP = {
  started: { color: '#4285F4', icon: '🔔', label: '開始處理' },
  success: { color: '#0F9D58', icon: '✅', label: '成功' },
  failed:  { color: '#DB4437', icon: '❌', label: '失敗' },
  error:   { color: '#DB4437', icon: '⚠️', label: '錯誤' },
};

/**
 * 將 fields 陣列（[{label, text}] 或 [{key, value}]）轉成 decoratedText widgets。
 */
function buildWidgets(fields, footerNote) {
  const widgets = [];
  if (fields && Array.isArray(fields)) {
    for (const f of fields) {
      const label = f.label || f.key || '';
      const text  = String(f.text ?? f.value ?? '');
      if (label || text) {
        widgets.push({ decoratedText: { topLabel: label, text: text, wrapText: true } });
      }
    }
  }
  if (footerNote) {
    widgets.push({ textParagraph: { text: `<i>${footerNote}</i>` } });
  }
  return widgets;
}

// 平台名稱：同一個 Chat 空間會收到多個系統的通知，摘要與標題都要寫出是哪個平台
const PLATFORM_NAMES = {
  ES: '國小課程計畫AI審查',
  JHS: '國中課程計畫AI審查',
};

/**
 * 依 meta.app（ES／JHS）決定平台名稱，並拿掉前端標題前綴「[國小] 」「[國中] 」避免重複。
 */
function resolvePlatform(title, meta) {
  const raw = String(title);
  const m = raw.match(/^\s*\[(國小|國中)\]\s*/);
  const isJHS = (meta && meta.app === 'JHS') || (!(meta && meta.app) && m && m[1] === '國中');
  return {
    platform: isJHS ? PLATFORM_NAMES.JHS : PLATFORM_NAMES.ES,
    cleanTitle: m ? raw.slice(m[0].length) : raw,
  };
}

/**
 * 建立 cardsV2 payload。
 */
function buildCard(status, title, fields, footerNote, meta) {
  const s = STATUS_MAP[status] || { color: '#9AA0A6', icon: '📋', label: status };
  const { platform, cleanTitle } = resolvePlatform(title, meta);
  const metaLine = meta
    ? `${meta.br || ''} · ${meta.os || ''} · ${meta.dev || ''} · ${meta.sid || ''}`
    : '';
  const widgets = buildWidgets(fields, footerNote);
  if (metaLine) {
    widgets.push({ textParagraph: { text: `<font color="#9AA0A6"><small>${metaLine}</small></font>` } });
  }

  // ── 手機推播摘要文字（解決「傳送了一個附件檔案給你」問題）──
  // Google Chat 以最外層 text 欄位作為手機通知欄摘要內容。
  // 若只有 cardsV2 而沒有 text，手機端一律顯示「傳送了一個附件檔案給你」。
  const previewParts = [`${s.icon} 【${platform}】${cleanTitle}`];
  if (fields && fields.length > 0) {
    // 取前兩個 field 的 value/text 拼成摘要
    fields.slice(0, 2).forEach(f => {
      const val = String(f.text ?? f.value ?? '').trim();
      if (val) previewParts.push(val);
    });
  }
  const pushText = previewParts.join(' · ').slice(0, 100); // 控制在 100 字元以內

  return {
    text: pushText, // ← 手機推播摘要（與 cardsV2 同層）
    cardsV2: [{
      cardId: `c-${Date.now()}`,
      card: {
        header: {
          title: `${s.icon} ${cleanTitle}｜${platform}`,
          subtitle: `${s.label} · ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
          imageUrl: 'https://www.smes.tyc.edu.tw/images/logo.png',
          imageType: 'CIRCLE',
        },
        sections: [{ widgets }],
      },
    }],
  };
}

/**
 * POST to Google Chat webhook（用 nodejs18+ 內建 fetch，自動 UTF-8，中文不亂碼）。
 */
async function postToChat(webhookUrl, payload) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: response.status };
}

exports.notifyCurriculumChat = onRequest(
  {
    region: 'asia-east1',
    memory: '256MiB',
    timeoutSeconds: 15,
    secrets: [GCHAT_WEBHOOK],
    cors: true,
  },
  async (req, res) => {
    // 允許 CORS preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const webhookUrl = GCHAT_WEBHOOK.value();
    if (!webhookUrl) {
      console.error('GCHAT_WEBHOOK secret not set');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const { status = 'info', title = '(無標題)', fields = [], footerNote = '', meta } = req.body || {};
    const card = buildCard(status, title, fields, footerNote, meta);

    try {
      const result = await postToChat(webhookUrl, card);
      console.log(`Google Chat notified: ${result.status} for status=${status}`);
      return res.status(200).json({ ok: true, chatStatus: result.status });
    } catch (err) {
      console.error('Google Chat webhook error:', err);
      return res.status(500).json({ error: err.message });
    }
  }
);
