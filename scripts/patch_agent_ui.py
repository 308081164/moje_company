#!/usr/bin/env python3
"""Patch PortalAgentView.vue for Kimi layout + lazy session."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAV = ROOT / 'b2b-client/src/views/PortalAgentView.vue'
text = PAV.read_text(encoding='utf-8')

# --- imports ---
old_imports = """import { HomeOutlined, PictureOutlined, AudioOutlined } from '@ant-design/icons-vue'
import {
  agentCreateSession,"""

new_imports = """import {
  HomeOutlined,
  PictureOutlined,
  AudioOutlined,
  MenuOutlined,
  PlusOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  LogoutOutlined
} from '@ant-design/icons-vue'
import { useMediaQuery } from '@/composables/useMediaQuery'
import {
  agentWelcome,
  agentCreateSession,"""

if 'useMediaQuery' not in text:
    text = text.replace(old_imports, new_imports)

# --- constants after SESSION_ID_KEY ---
if 'WELCOME_MSG_ID' not in text:
    text = text.replace(
        "const SESSION_ID_KEY = 'moje_b2b_agent_session_id'\n",
        "const SESSION_ID_KEY = 'moje_b2b_agent_session_id'\nconst WELCOME_MSG_ID = -1\n",
    )

# --- refs: sidebarOpen, isDesktop ---
if 'sidebarOpen' not in text:
    text = text.replace(
        "const b2bToken = ref(!!getB2bTokenRaw())\n",
        "const b2bToken = ref(!!getB2bTokenRaw())\nconst isDesktop = useMediaQuery('(min-width: 1024px)')\nconst sidebarOpen = ref(false)\n",
    )

# --- replace template wrapper (lines 1-14 header + card start) ---
old_start = """<template>
  <div class="b2b-portal-container agent-portal-page">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content agent-layout">
      <a-card class="b2b-portal-card agent-card" :bordered="false">
        <div class="portal-header agent-header">
          <router-link to="/" class="back-btn"><HomeOutlined /> 返回首页</router-link>
          <template v-if="b2bToken">
            <router-link to="/portal/form" class="back-btn">传统表单录入</router-link>
            <router-link to="/portal/b2b/my-orders" class="back-btn">我的订单</router-link>
            <a-button type="link" @click="historyOpen = true">历史对话</a-button>
            <a-button type="link" danger @click="b2bLogout">退出</a-button>
          </template>
        </div>

        <!-- 未登录：登录注册页 -->"""

new_start = """<template>
  <div class="agent-portal-page">
    <div class="b2b-portal-background"></div>

    <!-- 未登录：登录注册页 -->
    <div v-if="!b2bToken" class="b2b-portal-content agent-auth-wrap">"""

if 'agent-auth-wrap' not in text:
    text = text.replace(old_start, new_start)

# close auth wrap before logged-in shell
old_auth_end = """        </div>

        <!-- 已登录：Agent 对话 -->
        <template v-else>
          <div class="agent-body">
            <div class="agent-quick-bar">
              <a-button type="primary" ghost block @click="$router.push('/portal/b2b/my-orders')">
                查看我的订单进度
              </a-button>
            </div>

            <div ref="msgBoxRef" class="agent-messages">"""

new_auth_end = """    </div>

    <!-- 已登录：Kimi 风格双栏 -->
    <div v-else class="agent-shell" :class="{ 'agent-shell--desktop': isDesktop }">
      <aside v-if="isDesktop" class="agent-sidebar">
        <div class="sidebar-brand">
          <img src="/icons/icon-maskable.svg" alt="" width="32" height="32" />
          <span>恒鎏珠宝AI建模平台</span>
        </div>
        <button type="button" class="sidebar-new-chat" @click="startNewChat">
          <PlusOutlined /> 新对话
        </button>
        <div class="sidebar-section-title">历史对话</div>
        <div class="sidebar-history">
          <a-spin v-if="historyLoading" />
          <button
            v-for="item in historySessions"
            :key="item.sessionId"
            type="button"
            class="sidebar-history-item"
            @click="openHistory(item)"
          >
            <span class="history-status">{{ item.status }}</span>
            <span class="history-time">{{ formatTime(item.createdAt) }}</span>
          </button>
          <p v-if="!historyLoading && !historySessions.length" class="sidebar-empty">暂无历史记录</p>
        </div>
        <div class="sidebar-footer">
          <router-link to="/portal/b2b/my-orders" class="sidebar-link"><UnorderedListOutlined /> 我的订单</router-link>
          <router-link to="/portal/form" class="sidebar-link"><FileTextOutlined /> 传统表单</router-link>
          <router-link to="/" class="sidebar-link"><HomeOutlined /> 返回首页</router-link>
          <button type="button" class="sidebar-link sidebar-link--danger" @click="b2bLogout"><LogoutOutlined /> 退出</button>
        </div>
      </aside>

      <main class="agent-main">
        <header class="agent-topbar">
          <div class="topbar-left">
            <button v-if="!isDesktop" type="button" class="topbar-icon-btn" aria-label="打开菜单" @click="sidebarOpen = true">
              <MenuOutlined />
            </button>
            <h1 class="topbar-title">智能录入助手</h1>
          </div>
          <div class="topbar-actions">
            <a-dropdown v-if="!isDesktop" :trigger="['click']">
              <button type="button" class="topbar-text-btn">更多</button>
              <template #overlay>
                <a-menu>
                  <a-menu-item key="orders" @click="$router.push('/portal/b2b/my-orders')">我的订单</a-menu-item>
                  <a-menu-item key="form" @click="$router.push('/portal/form')">传统表单录入</a-menu-item>
                  <a-menu-item key="home" @click="$router.push('/')">返回首页</a-menu-item>
                  <a-menu-divider />
                  <a-menu-item key="logout" danger @click="b2bLogout">退出登录</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
            <button v-if="!isDesktop" type="button" class="topbar-text-btn" @click="startNewChat">新对话</button>
          </div>
        </header>

        <div class="agent-chat-column">
          <div ref="msgBoxRef" class="agent-messages">"""

if 'agent-shell' not in text:
    text = text.replace(old_auth_end, new_auth_end)

# close main/shell instead of agent-body/card
old_end = """            </div>
          </div>
        </template>
      </a-card>
    </div>

    <a-modal"""

new_end = """          </div>

          <div v-if="session?.readOnly" class="agent-readonly-hint">
            当前为历史会话，仅可查看，无法继续发送消息。
          </div>
          <div v-else class="agent-compose-wrap">
            <div class="agent-compose-box">
              <div v-if="pendingPreviews.length" class="pending-images compose-pending">
                <div v-for="p in pendingPreviews" :key="p.id" class="pending-thumb">
                  <img :src="p.url" alt="待发送" />
                  <button type="button" class="pending-remove" aria-label="移除" @click="removePending(p.id)">×</button>
                </div>
              </div>
              <textarea
                ref="inputAreaRef"
                v-model="inputText"
                class="agent-textarea"
                rows="3"
                placeholder="描述定制需求；可添加参考图，点击发送后一并提交…"
                :disabled="sending"
                @input="resizeInputArea"
                @keydown.enter.exact.prevent="sendMessage"
              />
              <div class="agent-compose-toolbar">
                <div class="toolbar-left">
                  <a-upload :before-upload="onPickImage" :show-upload-list="false" accept="image/*" multiple>
                    <button type="button" class="compose-icon-btn" :disabled="sending" title="添加图片">
                      <PictureOutlined />
                    </button>
                  </a-upload>
                  <button
                    type="button"
                    class="compose-icon-btn"
                    :class="{ 'compose-icon-btn--active': recording }"
                    :disabled="sending || !voiceAvailable"
                    :title="voiceButtonTitle"
                    @click="onVoiceButtonClick"
                  >
                    <AudioOutlined />
                  </button>
                </div>
                <button
                  type="button"
                  class="compose-send-btn"
                  :disabled="!canSend"
                  :aria-busy="sending"
                  title="发送"
                  @click="sendMessage"
                >
                  <span v-if="sending" class="send-spinner" />
                  <span v-else class="send-arrow">↑</span>
                </button>
              </div>
            </div>
            <p v-if="recording" class="voice-hint">{{ voiceHintText }}</p>
          </div>
        </div>
      </main>
    </div>

    <a-modal"""

# Only replace end if we haven't already - check for duplicate compose
if text.count('agent-compose-wrap') < 1 and 'agent-shell' in text:
    # find and remove duplicate readonly + compose blocks before closing
    # simpler: replace from readonly hint duplicate
    marker = """            <div v-if="session?.readOnly" class="agent-readonly-hint">
              当前为历史会话，仅可查看，无法继续发送消息。
            </div>
            <div v-else class="agent-compose">"""
    if marker in text:
        idx = text.index(marker)
        end_idx = text.index("        </template>\n      </a-card>", idx)
        if end_idx > 0:
            text = text[:idx] + new_end.split('          </div>\n\n          <div v-if="session')[1]  # botched
    pass

# Manual fix: remove old compose block if still present after messages
import re
# Remove duplicate session readonly + compose between messages end and modal
pattern = re.compile(
    r'\n            <div v-if="session\?\.readOnly" class="agent-readonly-hint">.*?</div>\n          </div>\n        </template>\n      </a-card>\n    </div>\n\n    <a-modal',
    re.DOTALL,
)
if 'agent-compose-wrap' not in text and 'agent-shell' in text:
    m = pattern.search(text)
    if m:
        replacement = new_end
        text = text[: m.start()] + replacement + text[m.end() :]

# --- script: applySession preserve welcome ---
old_apply = """function applySession(s: B2bAgentSession) {
  session.value = s
  messages.value = [...(s.messages ?? [])]"""

new_apply = """function applySession(s: B2bAgentSession) {
  const welcomeMsg = messages.value.find((m) => m.id === WELCOME_MSG_ID)
  session.value = s
  messages.value = [...(s.messages ?? [])]
  if (welcomeMsg && !messages.value.some((m) => m.id === WELCOME_MSG_ID)) {
    messages.value = [welcomeMsg, ...messages.value]
  }"""

if 'welcomeMsg' not in text:
    text = text.replace(old_apply, new_apply)

# --- replace initSession block ---
old_init = """async function initSession() {
  const s = await agentCreateSession()
  applySession(s)
  try {
    await agentBindSession(s.sessionId, s.publicToken)
  } catch {
    /* ignore */
  }
}"""

new_init = """async function showWelcomeOnly() {
  session.value = null
  draft.value = null
  showConfirmCard.value = false
  pendingOptimisticIds.value.clear()
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(SESSION_ID_KEY)
  try {
    const { message: welcome } = await agentWelcome()
    messages.value = [{ id: WELCOME_MSG_ID, role: 'assistant', content: welcome }]
  } catch {
    messages.value = [
      {
        id: WELCOME_MSG_ID,
        role: 'assistant',
        content: '您好！请描述珠宝定制需求，上传参考图后点击发送开始对话。'
      }
    ]
  }
  scrollBottom()
}

async function ensureSession(): Promise<B2bAgentSession> {
  if (session.value && !session.value.readOnly) {
    return session.value
  }
  const s = await agentCreateSession()
  try {
    await agentBindSession(s.sessionId, s.publicToken)
  } catch {
    /* ignore */
  }
  session.value = { ...s, messages: s.messages ?? [], readOnly: false }
  localStorage.setItem(SESSION_TOKEN_KEY, s.publicToken)
  localStorage.setItem(SESSION_ID_KEY, String(s.sessionId))
  return session.value
}

function startNewChat() {
  if (sending.value) return
  void showWelcomeOnly()
  if (isDesktop.value) void loadHistory()
}"""

if 'showWelcomeOnly' not in text:
    text = text.replace(old_init, new_init)

# --- sendMessage guard ---
text = text.replace(
    "async function sendMessage() {\n  if (!session.value || session.value.readOnly || sending.value) return",
    "async function sendMessage() {\n  if (session.value?.readOnly || sending.value) return",
)
text = text.replace(
    "  if (!text && images.length === 0) return\n\n  const savedText = text",
    "  if (!text && images.length === 0) return\n\n  const activeSession = await ensureSession()\n\n  const savedText = text",
)
text = text.replace(
    "      session.value.sessionId,\n      { text: savedText || undefined, images: savedImages.length ? savedImages : undefined },\n      sessionHeaders()",
    "      activeSession.sessionId,\n      { text: savedText || undefined, images: savedImages.length ? savedImages : undefined },\n      sessionHeaders()",
)

# --- login/register/logout/mounted ---
text = text.replace("    await initSession()\n    message.success('登录成功')", "    await showWelcomeOnly()\n    void loadHistory()\n    message.success('登录成功')")
text = text.replace("    await initSession()\n    message.success('注册成功')", "    await showWelcomeOnly()\n    void loadHistory()\n    message.success('注册成功')")
text = text.replace(
    "  if (b2bToken.value) {\n    await initSession()\n  }",
    "  if (b2bToken.value) {\n    await showWelcomeOnly()\n    if (isDesktop.value) void loadHistory()\n  }",
)

# --- drawer mobile ---
old_drawer = """    <a-drawer v-model:open="historyOpen" title="历史对话" width="360">"""
new_drawer = """    <a-drawer
      v-model:open="sidebarOpen"
      title="菜单与历史"
      placement="left"
      :width="300"
      class="agent-mobile-drawer"
    >
      <button type="button" class="sidebar-new-chat sidebar-new-chat--block" @click="startNewChat(); sidebarOpen = false">
        <PlusOutlined /> 新对话
      </button>
      <div class="sidebar-section-title">历史对话</div>
      <a-list :data-source="historySessions" :loading="historyLoading" class="mobile-history-list">
        <template #renderItem="{ item }">
          <a-list-item class="history-item" @click="openHistory(item); sidebarOpen = false">
            <a-list-item-meta :title="item.status" :description="formatTime(item.createdAt)" />
          </a-list-item>
        </template>
      </a-list>
      <div class="drawer-footer-links">
        <router-link to="/portal/b2b/my-orders" @click="sidebarOpen = false">我的订单</router-link>
        <router-link to="/portal/form" @click="sidebarOpen = false">传统表单录入</router-link>
        <router-link to="/" @click="sidebarOpen = false">返回首页</router-link>
      </div>
    </a-drawer>

    <a-drawer v-if="false" v-model:open="historyOpen" title="历史对话" width="360">"""

if 'agent-mobile-drawer' not in text:
    text = text.replace(old_drawer, new_drawer)

# append kimi layout styles before </style>
kimi_styles = Path(ROOT / 'scripts/agent_kimi_styles.css').read_text(encoding='utf-8')
if '.agent-shell' not in text:
    text = text.replace('</style>', kimi_styles + '\n</style>')

PAV.write_text(text, encoding='utf-8')
print('patched', 'agent-shell' in text, 'showWelcomeOnly' in text)
