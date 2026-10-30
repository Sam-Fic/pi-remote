// Strings for the remote web UI, shipped to the browser as a JS string (see
// i18nModule) and spliced into the page's single <script>, exactly like
// renderModule/highlightModule/toolsModule. Kept out of ui-mdui.ts so the
// three locales sit side by side and a missing or drifted key is visible as a
// structure diff rather than buried in a 4700-line template.
//
// WHY THREE SEPARATE TABLES AND NOT A 简→繁 CONVERTER
// Simplified and Traditional are not the same words in different glyphs. 设置
// / 設定 agree character-for-character; 软件 / 軟體, 消息 / 訊息, 附件 / 附件
// do not, and 文件 / 檔案 or 图片 / 圖片 differ in ways no per-character table
// gets right. A runtime converter would also be a multi-hundred-KB dependency
// on a page that is deliberately dependency-light, and it would make the
// result unfixable — a wrong term could not be corrected by editing a string.
// So each locale is authored outright, which is also the only way a
// native speaker can proofread it.
//
// KEYS ARE FLAT AND STABLE
// Every locale carries exactly the same key set; that is enforced by a test
// (see test/remote/i18n.test.ts) rather than trusted. A lookup for an unknown
// key returns the key itself, so a gap shows up in the UI as `some.key`
// instead of as a blank — visible, greppable, and never silent.

export type Locale = 'zh-CN' | 'zh-TW' | 'en'

export const LOCALES: {id: Locale; label: string}[] = [
    {id: 'zh-CN', label: '简体中文'},
    {id: 'zh-TW', label: '繁體中文'},
    {id: 'en', label: 'English'}
]

/** The locale used when nothing is stored, or the stored value is unknown. */
export const DEFAULT_LOCALE: Locale = 'zh-CN'

export function isLocale(v: unknown): v is Locale {
    return v === 'zh-CN' || v === 'zh-TW' || v === 'en'
}

/* ── Authoring note ────────────────────────────────────────────────────────
   Keep the three tables in the same key order. A reviewer diffing zh-TW
   against zh-CN should be reading one term per line, not hunting for it. */
const T = {
    // ── App bar / chrome ──
    appTitle: {zhCN: 'π 远程', zhTW: 'π 遠端', en: 'π Remote'},
    sessions: {zhCN: '会话', zhTW: '會話', en: 'Sessions'},
    close: {zhCN: '关闭', zhTW: '關閉', en: 'Close'},
    notifications: {zhCN: '通知', zhTW: '通知', en: 'Notifications'},
    settings: {zhCN: '设置', zhTW: '設定', en: 'Settings'},
    jumpToBottom: {zhCN: '跳到底部', zhTW: '跳到底部', en: 'Jump to bottom'},
    clear: {zhCN: '清除', zhTW: '清除', en: 'Clear'},
    noModel: {zhCN: '未选择模型', zhTW: '未選擇模型', en: 'No model selected'},

    // ── Composer ──
    addAttachment: {zhCN: '添加附件', zhTW: '新增附件', en: 'Add attachment'},
    pickImage: {zhCN: '选择图片', zhTW: '選擇圖片', en: 'Choose image'},
    switchModel: {zhCN: '切换模型', zhTW: '切換模型', en: 'Switch model'},
    send: {zhCN: '发送', zhTW: '傳送', en: 'Send'},
    inputPlaceholder: {zhCN: '输入消息（/ 查看命令）…', zhTW: '輸入訊息（/ 查看指令）…', en: 'Type a message… (/ for commands)'},
    placeholderLiveTurn: {zhCN: '将引导正在进行的这一轮…', zhTW: '將引導正在進行的這一輪…', en: 'steers the live turn'},
    placeholderHeld: {zhCN: '已暂存，随下一轮发送', zhTW: '已暫存，隨下一輪傳送', en: 'held for the next task turn'},
    contextUsage: {zhCN: '上下文用量', zhTW: '上下文用量', en: 'Context usage'},
    dropToAttach: {zhCN: '松开以添加附件', zhTW: '放開以新增附件', en: 'Release to attach'},
    image: {zhCN: '图片', zhTW: '圖片', en: 'Image'},
    file: {zhCN: '文件', zhTW: '檔案', en: 'File'},
    clearAll: {zhCN: '清除全部', zhTW: '清除全部', en: 'Clear all'},
    removeAttachment: {zhCN: '移除附件', zhTW: '移除附件', en: 'Remove attachment'},
    stopArmHint: {zhCN: '点击两次以停止', zhTW: '點擊兩次以停止', en: 'Tap twice to stop'},
    stopConfirmHint: {zhCN: '再次点击以停止', zhTW: '再次點擊以停止', en: 'Tap again to stop'},

    // ── Settings ──
    darkLightMode: {zhCN: '深浅色模式', zhTW: '深淺色模式', en: 'Light / dark mode'},
    themeColor: {zhCN: '主题色', zhTW: '主題色', en: 'Theme color'},
    language: {zhCN: '语言', zhTW: '語言', en: 'Language'},
    autoCollapseThinking: {zhCN: 'Thinking 自动收起', zhTW: 'Thinking 自動收起', en: 'Auto-collapse thinking'},
    themeLight: {zhCN: '浅色', zhTW: '淺色', en: 'Light'},
    themeDark: {zhCN: '深色', zhTW: '深色', en: 'Dark'},
    themeAuto: {zhCN: '自动', zhTW: '自動', en: 'Auto'},
    accentDefault: {zhCN: '默认', zhTW: '預設', en: 'Default'},
    accentBlue: {zhCN: '蓝色', zhTW: '藍色', en: 'Blue'},
    accentTeal: {zhCN: '青色', zhTW: '青色', en: 'Teal'},
    accentGreen: {zhCN: '绿色', zhTW: '綠色', en: 'Green'},
    accentOrange: {zhCN: '橙色', zhTW: '橙色', en: 'Orange'},
    accentRed: {zhCN: '红色', zhTW: '紅色', en: 'Red'},
    accentPurple: {zhCN: '紫色', zhTW: '紫色', en: 'Purple'},
    accentCustom: {zhCN: '自定义', zhTW: '自訂', en: 'Custom'},
    extractFromImage: {zhCN: '从图片提取', zhTW: '從圖片擷取', en: 'Extract from image'},

    // ── Sessions ──
    deleteSession: {zhCN: '删除会话', zhTW: '刪除會話', en: 'Delete session'},
    cancel: {zhCN: '取消', zhTW: '取消', en: 'Cancel'},
    delete: {zhCN: '删除', zhTW: '刪除', en: 'Delete'},
    deleteBusy: {zhCN: '模型正在回复，暂时无法删除', zhTW: '模型正在回覆，暫時無法刪除', en: 'Model is replying — cannot delete yet'},
    noOtherSessions: {zhCN: '还没有其他会话', zhTW: '還沒有其他會話', en: 'No other sessions yet'},
    unsavedSession: {zhCN: '（新会话·尚未保存）', zhTW: '（新會話·尚未儲存）', en: '(new session · not saved yet)'},
    emptySession: {zhCN: '（空会话）', zhTW: '（空會話）', en: '(empty session)'},
    currentSessionUnsaved: {zhCN: '当前会话 · 尚未写入磁盘', zhTW: '目前會話 · 尚未寫入磁碟', en: 'Current session · not yet on disk'},
    messageCount: {zhCN: '条消息', zhTW: '則訊息', en: 'messages'},
    confirmDeleteSession: {zhCN: '删除「{0}」？删除后无法恢复。', zhTW: '刪除「{0}」？刪除後無法復原。', en: 'Delete “{0}”? This cannot be undone.'},

    // ── Prompt card ──
    promptTitle: {zhCN: 'π 需要你的输入', zhTW: 'π 需要你的輸入', en: 'π needs your input'},
    recommended: {zhCN: '推荐答案', zhTW: '建議答案', en: 'Suggested answer'},
    promptPlaceholder: {zhCN: '输入你的回答…', zhTW: '輸入你的回答…', en: 'Type your answer…'},

    // ── Toasts / dynamic ──
    themeFollowSystem: {zhCN: '跟随系统深浅色', zhTW: '跟隨系統深淺色', en: 'Following system light / dark'},
    themeSwitchedDark: {zhCN: '已切换为深色模式', zhTW: '已切換為深色模式', en: 'Switched to dark mode'},
    themeSwitchedLight: {zhCN: '已切换为浅色模式', zhTW: '已切換為淺色模式', en: 'Switched to light mode'},
    accentSwitched: {zhCN: '主题色已切换为', zhTW: '主題色已切換為', en: 'Theme color set to'},
    accentExtracted: {zhCN: '已从图片提取主题色', zhTW: '已從圖片擷取主題色', en: 'Theme color extracted from image'},
    extractFailed: {zhCN: '提取失败：', zhTW: '擷取失敗：', en: 'Extraction failed: '},
    thinkingWillCollapse: {zhCN: 'Thinking 将在结束时收起', zhTW: 'Thinking 將在結束時收起', en: 'Thinking will collapse when done'},
    thinkingStaysOpen: {zhCN: 'Thinking 保持展开', zhTW: 'Thinking 保持展開', en: 'Thinking stays expanded'},
    languageSwitched: {zhCN: '语言已切换为', zhTW: '語言已切換為', en: 'Language set to'},
    notifOff: {zhCN: '通知已关闭', zhTW: '通知已關閉', en: 'Notifications turned off'},
    notifUnsupported: {zhCN: '此浏览器不支持 Web Push。', zhTW: '此瀏覽器不支援 Web Push。', en: 'This browser does not support Web Push.'},
    notifNoPush: {zhCN: '此浏览器不支持通知。', zhTW: '此瀏覽器不支援通知。', en: 'This browser does not support notifications.'},
    notifNeedsHttps: {zhCN: '通知需要 HTTPS。请用 Tailscale https URL 或 localhost 打开。', zhTW: '通知需要 HTTPS。請用 Tailscale https URL 或 localhost 開啟。', en: 'Notifications need HTTPS. Open via the Tailscale https URL or localhost.'},
    notifIosInstall: {zhCN: 'iOS 用户：请先分享 → 添加到主屏幕，再启用通知。', zhTW: 'iOS 使用者：請先分享 → 加入主畫面，再啟用通知。', en: 'On iOS: Share → Add to Home Screen first, then enable notifications.'},
    notifPermissionDenied: {zhCN: '通知权限被拒绝，请在浏览器设置中启用。', zhTW: '通知權限被拒絕，請在瀏覽器設定中啟用。', en: 'Notification permission denied — enable it in your browser settings.'},
    notifOn: {zhCN: '通知已开启。', zhTW: '通知已開啟。', en: 'Notifications are on.'},
    notifSubscribeFailed: {zhCN: '通知订阅失败。', zhTW: '通知訂閱失敗。', en: 'Could not subscribe to notifications.'},
    notifSetupFailed: {zhCN: '通知设置失败：', zhTW: '通知設定失敗：', en: 'Notification setup failed: '},
    noNotifications: {zhCN: '还没有通知', zhTW: '還沒有通知', en: 'No notifications yet'},
    noSwitchableModel: {zhCN: '暂无可切换的模型', zhTW: '暫無可切換的模型', en: 'No other models available'},
    modelSwitching: {zhCN: '切换模型…', zhTW: '切換模型…', en: 'Switching model…'},
    modelSwitched: {zhCN: '切换模型：', zhTW: '切換模型：', en: 'Switched model: '},
    sessionSwitching: {zhCN: '切换会话…', zhTW: '切換會話…', en: 'Switching session…'},
    sessionDeleteFailed: {zhCN: '删除会话失败：连接已断开', zhTW: '刪除會話失敗：連線已中斷', en: 'Could not delete the session: disconnected'},
    uploading: {zhCN: '上传中… ', zhTW: '上傳中… ', en: 'Uploading… '},
    uploadOffline: {zhCN: '连接已断开，无法上传附件', zhTW: '連線已中斷，無法上傳附件', en: 'Disconnected — cannot upload attachments'},
    skipEmptyFile: {zhCN: '跳过空文件：', zhTW: '跳過空檔案：', en: 'Skipped empty file: '},
    fileTooLarge: {zhCN: '文件过大（上限 25 MB）：', zhTW: '檔案過大（上限 25 MB）：', en: 'File too large (25 MB limit): '},
    tooManyAttachments: {zhCN: '一次最多 20 个附件', zhTW: '一次最多 20 個附件', en: 'At most 20 attachments at a time'},
    uploadFailed: {zhCN: '上传失败：', zhTW: '上傳失敗：', en: 'Upload failed: '},
    attachmentsCleared: {zhCN: '附件已清除', zhTW: '附件已清除', en: 'Attachments cleared'},
    attachmentsStillUploading: {zhCN: '附件还在上传…', zhTW: '附件還在上傳…', en: 'Attachments are still uploading…'},
    disconnectedSuffix: {zhCN: '（连接已断开）', zhTW: '（連線已中斷）', en: '(disconnected)'},
    answerPromptFirst: {zhCN: '（请先回答上方提问）', zhTW: '（請先回答上方提問）', en: '(answer the question above first)'},

    // ── Misc ──
    reconnecting: {zhCN: '重新连接中…', zhTW: '重新連線中…', en: 'Reconnecting…'},
    connectionLostRetrying: {zhCN: '连接已断开 — {0}s 后重试', zhTW: '連線已中斷 — {0} 秒後重試', en: 'connection lost — retrying in {0}s'},
    copyCode: {zhCN: '复制代码', zhTW: '複製程式碼', en: 'Copy code'},
    copyMessage: {zhCN: '复制消息', zhTW: '複製訊息', en: 'Copy message'},
    dragHandleNotifications: {zhCN: '通知面板拖拽手柄', zhTW: '通知面板拖曳把手', en: 'Notifications panel drag handle'},
    dragHandleSettings: {zhCN: '设置面板拖拽手柄', zhTW: '設定面板拖曳把手', en: 'Settings panel drag handle'},
    dragHandleModel: {zhCN: '模型列表拖拽手柄', zhTW: '模型列表拖曳把手', en: 'Model list drag handle'}
} satisfies Record<string, {zhCN: string; zhTW: string; en: string}>

export type MessageKey = keyof typeof T

/** The table as the browser wants it: { locale: { key: string } }. */
export function localeTables(): Record<Locale, Record<string, string>> {
    const out = {zhCN: {}, zhTW: {}, en: {}} as Record<'zhCN' | 'zhTW' | 'en', Record<string, string>>
    for (const key of Object.keys(T) as MessageKey[]) {
        out.zhCN[key] = T[key].zhCN
        out.zhTW[key] = T[key].zhTW
        out.en[key] = T[key].en
    }
    return {'zh-CN': out.zhCN, 'zh-TW': out.zhTW, en: out.en} as Record<Locale, Record<string, string>>
}

/**
 * Emitted client JS. Declares `LOCALE_TABLES`, `t(key, ...args)` and
 * `applyLocale(id)` at top level of the page's single <script>, so every
 * string site in the client can just call t().
 *
 * JSON.stringify, not a hand-written object literal: several strings contain
 * quotes, parentheses and ellipses, and one interpolation placeholder. Letting
 * the serializer do the escaping is the difference between "works" and "a
 * syntax error that blanks the whole UI" — the same class of bug the module
 * split was introduced to avoid.
 */
export function i18nModule(): string {
    return `    var LOCALE_TABLES = ${JSON.stringify(localeTables())};
    var CURRENT_LOCALE = ${JSON.stringify(DEFAULT_LOCALE)};
    var DEFAULT_LOCALE = ${JSON.stringify(DEFAULT_LOCALE)};
    var LOCALE_LABELS = ${JSON.stringify(
        LOCALES.reduce((acc, l) => { acc[l.id] = l.label; return acc }, {} as Record<string, string>)
    )};

    /* {0}, {1}… placeholders: enough for the handful of strings that splice in
       a name or a number, without pulling in a formatting library. */
    function t(key) {
      var table = LOCALE_TABLES[CURRENT_LOCALE] || LOCALE_TABLES[DEFAULT_LOCALE];
      var s = table[key];
      if (s == null) s = LOCALE_TABLES[DEFAULT_LOCALE][key];
      // An unknown key returns itself, so a gap reads as \`some.key\` on
      // screen — loud, greppable, and never a silent blank.
      if (s == null) return key;
      for (var i = 1; i < arguments.length; i++) {
        s = s.split('{' + (i - 1) + '}').join(arguments[i]);
      }
      return s;
    }

    /* Switch language: re-point t() and let every visible site re-read it.
       \`repaint\` is supplied by the client (it knows which DOM is static
       markup and therefore has to be re-stamped by hand — runtime toasts and
       placeholders just re-call t() on their next paint). */
    function applyLocale(id, repaint) {
      if (!LOCALE_TABLES[id]) return false;
      CURRENT_LOCALE = id;
      document.documentElement.lang = id;
      try { localStorage.setItem('pi-task-locale', id); } catch (e) {}
      if (typeof repaint === 'function') repaint();
      return true;
    }
`
}
