/**
 * UI strings — all user-visible Chinese copy lives here.
 *
 * Not a real i18n framework: MCC is single-language (zh-CN) and adding
 * i18next-grade machinery for "maybe English someday" would be classic
 * YAGNI. This file just stops the strings from being splattered across
 * 8 components — that's the real pain.
 *
 * If a string is built with a runtime value (count, name, etc.), expose
 * it as a function: `defaultMarker(name) => '默认 · X'`.
 *
 * If we ever need EN support, swap this file for two and a context provider.
 */

export const strings = {
  app: {
    title: '你的 Claude Code Provider 控制台',
    brand: '★ MCC · Multi-Cloud Console',
    versionFooter: 'MCC v0.1 · cupertino arcade build',
    madeFor: 'made for ⌘+K life-switching',
    refresh: 'Refresh',
    online: 'Online',
    offline: 'Offline',
    loading: 'loading…',
  },

  header: {
    emptyHint: '从 Templates 挑一个 Provider 开始，30 秒就能跑起来。',
    currentDefault: (name: string) => `当前默认 · ${name} — 切换或新增都在这里。`,
    noDefault: '当前没有设默认 profile。',
  },

  saveBar: {
    savedTitle: '已保存',
    savedDetail: '改动不会影响正在运行的 MCC 实例，重启后生效。',
    dirtyTitle: '未保存的改动',
    saveButton: '保存',
    saving: '保存中…',
  },

  presets: {
    kickerLabel: '▸ Templates',
    title: '挑一个 Provider，开打。',
    description: (count: number) =>
      `预置 ${count} 家国内外大模型 Provider —— 阿里通义、DeepSeek、Kimi、智谱、MiniMax、` +
      '小米 MiMo、OpenRouter… 选一个、填 Key、就能在 Claude Code 里跑。',
    searchPlaceholder: '搜索 provider / 模型…',
    groupFeatured: { kicker: '★ Featured', title: '主推 Provider', subtitle: '覆盖了大多数日常需求 — 直接选这几个就好。' },
    groupRecommended: { kicker: '◆ Recommended', title: '推荐选项', subtitle: '经过实战检验的稳定 Provider。' },
    groupAlternative: { kicker: '▢ Alternative', title: '其他可选', subtitle: '国内域名 / 特殊用例 / 实验性后端。' },
    emptyTitle: '没有匹配的 Provider',
    emptyHint: '试试别的关键词，或者直接在 Profiles 里手动添加。',
    insertCoin: 'Insert coin',
    noKey: 'No Key',
  },

  install: {
    sheetLabel: (name: string) => `Install ${name}`,
    titlePrefix: 'install · ',
    nameLabel: 'Profile 名称',
    nameHint: '登录命令里使用的别名：mcc <name>',
    apiKeyLabel: 'API Key',
    apiKeyRequiredHint: (presetHint: string) => presetHint,
    apiKeyOptionalHint: '本地 / 无需 Key — 留空即可',
    advancedSummary: '高级 — 自定义 Base URL / 模型',
    baseUrlLabel: 'Base URL',
    modelLabel: '默认 Model',
    protocolHint: '协议根据 base URL 自动判定',
    protocolAnthropic: 'Anthropic',
    protocolOpenai: 'OpenAI proxy',
    cancel: '取消',
    install: '安装 Profile',
    installing: '安装中…',
    errEmptyName: 'Profile 名称不能为空',
    errNameTaken: (name: string) => `Profile "${name}" 已存在，请换个名字`,
    errMissingKey: '这个 Provider 需要 API Key',
    errEmptyBaseUrl: 'Base URL 不能为空',
    errInstallFailed: '安装失败，请稍后重试',
  },

  profileList: {
    title: 'My Profiles',
    emptyDescription: '还没有 profile — 去 Templates 选一个开始吧。',
    countDescription: (count: number, current: string) =>
      `${count} 个已配置的 profile · 默认 ${current || '未指定'}`,
    emptyKicker: 'no profile yet',
    emptyTitle: '从 Templates 标签页开始',
    emptyHint: '挑一个 Provider，填 Key，就能在 Claude Code 里跑。',
    defaultChip: 'default',
    editingChip: 'editing',
    setDefault: 'Set default',
    deleteAria: 'Delete profile',
    clickHint: '点击 profile 卡片即可编辑，点空白处回到默认。',
  },

  profileForm: {
    editTitle: 'Edit Profile',
    addTitle: 'Manual Add',
    editDescription: (name: string) => `编辑 ${name} —— 改完点 "保存修改"。`,
    addDescription: '手动添加 — 大多数情况直接用 Templates 即可。',
    nameLabel: 'CLI 名称 (handle)',
    nameHint: '命令行调用：mcc <name>。建立后不可修改。',
    namePlaceholder: 'prod / scratch / claude-coder…',
    displayNameLabel: '展示名 (可选)',
    displayNameHint: '只用于 UI 展示。留空则用 CLI 名称。',
    displayNamePlaceholder: 'GLM 个人 / GLM 工作…',
    baseUrlLabel: 'Base URL',
    baseUrlPlaceholder: 'https://api.deepseek.com/anthropic',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholderAdd: 'sk-...',
    apiKeyPlaceholderEdit: '(已存在，编辑后会覆盖)',
    apiKeyHideAria: 'Hide key',
    apiKeyShowAria: 'Show key',
    apiKeyLoading: '加载已存 Key…',
    testButton: '测试 & 拉模型',
    testRunning: '测试中…',
    testNeedKey: '先填 Base URL 和 Key',
    testOk: (ms: number) => `✓ ${ms}ms`,
    testFail: '✗ 失败',
    modelLabel: '默认 Model',
    modelPlaceholder: 'deepseek-v4-pro',
    modelPickerCount: (n: number) => `${n} 个可用模型`,
    modelPickerHint: '点输入框右侧 ▾ 挑选',
    protocolLabel: 'Protocol',
    protocolAnthropicLabel: 'Anthropic',
    protocolOpenaiLabel: 'OpenAI',
    protocolAnthropicHint: '直接命中 /v1/messages，0 中间层',
    protocolOpenaiHint: '本地 proxy 翻译为 Anthropic 协议',
    thinkingLabel: '思考强度',
    thinkingHint: '默认开启思考（off 关闭）。DeepSeek/GLM/Qwen 支持分档；Kimi/MiMo 仅常开。',
    tieredModelsSummary: '分层模型 (Opus / Sonnet / Haiku)',
    tieredModelsHint: '不填则全部 fallback 到默认 Model；填了 Claude Code 内 /model 切档才有差异。',
    opusLabel: 'Opus',
    sonnetLabel: 'Sonnet',
    haikuLabel: 'Haiku',
    submitEdit: '保存修改',
    submitAdd: '添加 Profile',
    cancel: '取消',
  },

  tabs: {
    templates: 'Templates',
    profiles: 'Profiles',
    mcp: 'MCP',
  },

  errors: {
    failedToLoad: 'Failed to load',
    failedToSaveProfile: 'Failed to save profile',
    failedToInstallPreset: 'Failed to install preset',
    failedToDelete: 'Failed to delete',
    failedToSetDefault: 'Failed to set default',
    failedToToggleMcp: 'Failed to toggle MCP',
    failedToAddExternal: 'Failed to add external MCP',
    failedToRemoveExternal: 'Failed to remove external MCP',
    failedToSaveMcpConfig: 'Failed to save MCP config',
    dismissAria: 'Dismiss',
  },

  webSearch: {
    title: 'WebSearch',
    description: 'Web 搜索提供商，按需启用一家或多家',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'Enter API key...',
  },

  imageAnalysis: {
    title: 'Image Analysis',
    description: '视觉模型 provider，第一个启用且填了 Key 的会被使用',
    formatPrefix: 'Format: ',
    endpointLabel: 'Endpoint (Base URL)',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'Enter API key...',
    modelLabel: 'Model',
    modelPlaceholder: 'Select or type model name...',
  },

  mcpStatus: {
    title: 'MCP Server Status',
    description: '当前 session 中已启用的 MCP server',
    enabled: 'Enabled',
    disabled: 'Disabled',
  },

  externalMcp: {
    title: 'External MCP Servers',
    description: '用户自行注册的 MCP server',
    addButton: 'Add',
    cancelButton: 'Cancel',
    nameLabel: 'Name (unique ID)',
    namePlaceholder: 'minimax-plan',
    displayNameLabel: 'Display Name',
    displayNamePlaceholder: 'MiniMax Token Plan',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'MiniMax Token Plan 提供的搜索和图像理解',
    commandLabel: 'Command',
    commandPlaceholder: 'uvx',
    argsLabel: 'Args (comma-separated)',
    argsPlaceholder: 'minimax-coding-plan-mcp,-y',
    providerRefLabel: 'Provider API Key Source',
    providerRefNone: 'None',
    enabledByDefault: 'Enabled by default',
    submit: 'Add External MCP',
    enabled: 'Enabled',
    disabled: 'Disabled',
    deleteButton: 'Delete',
    emptyState: 'No external MCP servers. Click Add to register one.',
  },
};
