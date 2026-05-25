#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAV = ROOT / 'b2b-client/src/views/PortalAgentView.vue'
text = PAV.read_text(encoding='utf-8')
assert 'agent-compose-box' in text, 'expected PR18 version'

# imports
text = text.replace(
    "import { HomeOutlined, PictureOutlined, AudioOutlined } from '@ant-design/icons-vue'",
    """import {
  HomeOutlined,
  PictureOutlined,
  AudioOutlined,
  MenuOutlined,
  PlusOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  LogoutOutlined
} from '@ant-design/icons-vue'
import { useMediaQuery } from '@/composables/useMediaQuery'""",
)
text = text.replace("import {\n  agentCreateSession,", "import {\n  agentWelcome,\n  agentCreateSession,")

text = text.replace(
    "const SESSION_ID_KEY = 'moje_b2b_agent_session_id'\n\nconst OPTIMISTIC",
    "const SESSION_ID_KEY = 'moje_b2b_agent_session_id'\nconst WELCOME_MSG_ID = -1\n\nconst OPTIMISTIC",
)
text = text.replace(
    "const b2bToken = ref(!!getB2bTokenRaw())\nconst session",
    "const b2bToken = ref(!!getB2bTokenRaw())\nconst isDesktop = useMediaQuery('(min-width: 1024px)')\nconst sidebarOpen = ref(false)\nconst session",
)

text = text.replace(
    """<template>
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

        <!-- 未登录：登录注册页 -->
        <div v-if="!b2bToken" class="agent-auth-panel">""",
    """<template>
  <div class="agent-portal-page">
    <div class="b2b-portal-background"></div>
    <div v-if="!b2bToken" class="b2b-portal-content agent-auth-wrap">
        <div class="agent-auth-panel">""",
)

logged = (ROOT / 'scripts/agent_logged_shell.txt').read_text(encoding='utf-8')
text = text.replace(
    """        <!-- 已登录：Agent 对话 -->
        <template v-else>
          <div class="agent-body">
            <div class="agent-quick-bar">
              <a-button type="primary" ghost block @click="$router.push('/portal/b2b/my-orders')">
                查看我的订单进度
              </a-button>
            </div>

            <div ref="msgBoxRef" class="agent-messages">""",
    logged,
)

text = text.replace(
    """          </a-tabs>
        </div>

    <div v-else class="agent-shell""",
    """          </a-tabs>
        </div>
    </div>

    <div v-else class="agent-shell""",
)

text = text.replace('<div v-else class="agent-compose">', '<div v-else class="agent-compose-wrap">')

text = text.replace(
    """              <p v-if="recording" class="voice-hint">{{ voiceHintText }}</p>
            </div>
          </div>
        </template>
      </a-card>
    </div>

    <a-modal v-model:open="confirmOpen\"""",
    """              <p v-if="recording" class="voice-hint">{{ voiceHintText }}</p>
            </div>
        </div>
      </main>
    </div>

    <a-modal v-model:open="confirmOpen\"""",
)

text = text.replace(
    """    <a-drawer v-model:open="historyOpen" title="历史对话" width="360">""",
    (ROOT / 'scripts/agent_mobile_drawer.txt').read_text(encoding='utf-8'),
)

text = text.replace(
    """async function initSession() {
  const s = await agentCreateSession()
  applySession(s)
  try {
    await agentBindSession(s.sessionId, s.publicToken)
  } catch {
    /* ignore */
  }
}""",
    (ROOT / 'scripts/agent_session_funcs.txt').read_text(encoding='utf-8'),
)

text = text.replace(
    """function applySession(s: B2bAgentSession) {
  session.value = s
  messages.value = [...(s.messages ?? [])]""",
    """function applySession(s: B2bAgentSession) {
  const welcomeMsg = messages.value.find((m) => m.id === WELCOME_MSG_ID)
  session.value = s
  messages.value = [...(s.messages ?? [])]
  if (welcomeMsg && !messages.value.some((m) => m.id === WELCOME_MSG_ID)) {
    messages.value = [welcomeMsg, ...messages.value]
  }""",
)

text = text.replace(
    "  if (!session.value || session.value.readOnly || sending.value) return",
    "  if (session.value?.readOnly || sending.value) return",
)
text = text.replace(
    "  if (!text && images.length === 0) return\n\n  const savedText = text",
    "  if (!text && images.length === 0) return\n\n  const activeSession = await ensureSession()\n\n  const savedText = text",
)

# replace sessionId only in sendMessage
si = text.find('async function sendMessage()')
ei = text.find('async function startVoice', si)
if si < 0:
    ei = text.find('async function onVoiceButtonClick', si)
if si >= 0 and ei > si:
    block = text[si:ei]
    block = block.replace('session.value.sessionId', 'activeSession.sessionId', 1)
    text = text[:si] + block + text[ei:]

text = text.replace("    await initSession()\n    message.success('登录成功')", "    await showWelcomeOnly()\n    void loadHistory()\n    message.success('登录成功')")
text = text.replace("    await initSession()\n    message.success('注册成功')", "    await showWelcomeOnly()\n    void loadHistory()\n    message.success('注册成功')")
text = text.replace(
    "  if (b2bToken.value) {\n    await initSession()\n  }",
    "  if (b2bToken.value) {\n    await showWelcomeOnly()\n    if (isDesktop.value) void loadHistory()\n  }",
)

text = text.replace(
    "  applySession(s)\n  historyOpen.value = false",
    "  applySession(s)\n  sidebarOpen.value = false\n  historyOpen.value = false",
)

styles = (ROOT / 'scripts/agent_kimi_styles.css').read_text(encoding='utf-8')
if '.agent-shell' not in text:
    text = text.replace('</style>', styles + '\n</style>')

PAV.write_text(text, encoding='utf-8')
print('OK lines', len(text.splitlines()), 'shell', 'agent-shell' in text, 'welcome', 'showWelcomeOnly' in text)
