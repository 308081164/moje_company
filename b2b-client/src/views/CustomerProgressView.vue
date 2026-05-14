<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false" :loading="loading">
        <template #title>
          <div class="card-header">
            <GiftOutlined class="header-icon" />
            <span>定制进度</span>
            <router-link v-if="hasCToken" to="/portal/c/my-orders" style="margin-left: auto; font-size: 14px">
              我的订单
            </router-link>
          </div>
        </template>

        <div v-if="err" style="text-align: center; padding: 24px 0">
          <a-empty :description="err" />
        </div>

        <template v-else-if="hint">
          <a-alert
            type="info"
            show-icon
            :message="`订单 ${hint.orderNumber}`"
            :description="hint.displayTitle"
            style="margin-bottom: 16px"
          />

          <template v-if="data">
            <CustomerProgressBody :data="data" />
          </template>

          <template v-else>
            <a-tabs v-model:activeKey="authTab">
              <a-tab-pane key="login" tab="登录">
                <a-form layout="vertical" @finish="doLogin">
                  <a-form-item label="联系方式" required>
                    <a-input v-model:value="loginForm.contact" placeholder="手机号或微信" />
                  </a-form-item>
                  <a-form-item label="密码" required>
                    <a-input-password v-model:value="loginForm.password" />
                  </a-form-item>
                  <a-button type="primary" html-type="submit" block :loading="authLoading">登录并绑定</a-button>
                </a-form>
              </a-tab-pane>
              <a-tab-pane key="register" tab="注册">
                <a-form layout="vertical" @finish="doRegister">
                  <a-form-item label="联系方式" required>
                    <a-input v-model:value="registerForm.contact" placeholder="手机号或微信" />
                  </a-form-item>
                  <a-form-item label="密码" required>
                    <a-input-password v-model:value="registerForm.password" />
                  </a-form-item>
                  <a-form-item label="确认密码" required>
                    <a-input-password v-model:value="registerForm.confirmPassword" />
                  </a-form-item>
                  <a-form-item label="称呼（可选）">
                    <a-input v-model:value="registerForm.displayName" placeholder="如何称呼您" />
                  </a-form-item>
                  <a-button type="primary" html-type="submit" block :loading="authLoading">注册并绑定</a-button>
                </a-form>
              </a-tab-pane>
            </a-tabs>

            <a-divider>绑定其他订单</a-divider>
            <a-form layout="vertical" @finish="doBindOrder">
              <a-form-item label="订单编号">
                <a-input v-model:value="bindForm.orderNumber" placeholder="如 B2B202601080001" />
              </a-form-item>
              <a-form-item label="凭证（view_token 或 B2B 访问 token）">
                <a-input-password v-model:value="bindForm.proofToken" placeholder="来自分享链接路径中的 token" />
              </a-form-item>
              <a-button type="default" html-type="submit" block :loading="bindLoading" :disabled="!hasCToken">
                绑定到当前账号
              </a-button>
              <div v-if="!hasCToken" style="margin-top: 8px; color: #888; font-size: 12px">请先登录后再绑定</div>
            </a-form>
          </template>
        </template>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { GiftOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import {
  getCustomerOrderHint,
  portalLogin,
  portalRegister,
  portalBindViewToken,
  portalBindOrder,
  portalOrderSummary,
  type CustomerOrderRegistrationHintDto,
  type CustomerOrderPublicDto
} from '@/api'
import CustomerProgressBody from './CustomerProgressBody.vue'

const route = useRoute()
const loading = ref(true)
const err = ref<string | null>(null)
const hint = ref<CustomerOrderRegistrationHintDto | null>(null)
const data = ref<CustomerOrderPublicDto | null>(null)
const authTab = ref('login')
const authLoading = ref(false)
const bindLoading = ref(false)

const hasCToken = ref(!!localStorage.getItem('moje_c_portal_token'))

const loginForm = ref({ contact: '', password: '' })
const registerForm = ref({ contact: '', password: '', confirmPassword: '', displayName: '' })
const bindForm = ref({ orderNumber: '', proofToken: '' })

const viewToken = computed(() => (route.params.token as string) || '')

const applyHintToForms = () => {
  const h = hint.value
  if (!h) return
  const phone = h.suggestedPhone?.trim()
  const wx = h.suggestedWechat?.trim()
  const contact = phone || wx || ''
  if (contact) {
    loginForm.value.contact = contact
    registerForm.value.contact = contact
  }
  if (h.suggestedCustomerName) {
    registerForm.value.displayName = h.suggestedCustomerName
  }
}

const afterAuth = async () => {
  const h = hint.value
  if (!h) return
  await portalBindViewToken(viewToken.value)
  message.success('已绑定订单')
  await loadSummary(h.orderId)
}

const loadSummary = async (orderId: number) => {
  try {
    data.value = await portalOrderSummary(orderId)
  } catch {
    data.value = null
  }
}

const doLogin = async () => {
  authLoading.value = true
  try {
    const res = await portalLogin(loginForm.value)
    localStorage.setItem('moje_c_portal_token', res.accessToken)
    hasCToken.value = true
    await afterAuth()
  } finally {
    authLoading.value = false
  }
}

const doRegister = async () => {
  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    message.error('两次密码不一致')
    return
  }
  authLoading.value = true
  try {
    const res = await portalRegister({
      contact: registerForm.value.contact,
      password: registerForm.value.password,
      displayName: registerForm.value.displayName || undefined,
      viewToken: viewToken.value
    })
    localStorage.setItem('moje_c_portal_token', res.accessToken)
    hasCToken.value = true
    message.success('注册成功')
    await loadSummary(hint.value!.orderId)
  } finally {
    authLoading.value = false
  }
}

const doBindOrder = async () => {
  if (!hasCToken.value) {
    message.warning('请先登录')
    return
  }
  bindLoading.value = true
  try {
    await portalBindOrder(bindForm.value.orderNumber.trim(), bindForm.value.proofToken.trim())
    message.success('绑定成功')
    bindForm.value = { orderNumber: '', proofToken: '' }
  } finally {
    bindLoading.value = false
  }
}

onMounted(async () => {
  const vt = viewToken.value
  if (!vt) {
    err.value = '链接无效'
    loading.value = false
    return
  }
  try {
    hint.value = await getCustomerOrderHint(vt)
    applyHintToForms()
    if (hasCToken.value) {
      try {
        await portalBindViewToken(vt)
      } catch {
        /* 可能已绑定 */
      }
      await loadSummary(hint.value.orderId)
    }
  } catch (e) {
    console.error(e)
    err.value = '无法加载链接信息，可能已失效'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.order-detail-container {
  min-height: 100vh;
  position: relative;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.header-icon {
  color: var(--primary-color);
  font-size: 20px;
}
</style>
