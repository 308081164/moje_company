<template>
  <div class="b2b-portal-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false">
        <!-- Header with back button -->
        <div class="portal-header">
          <div class="portal-title">
            <router-link to="/" class="back-btn">
              <HomeOutlined />
              返回首页
            </router-link>
            <router-link v-if="b2bToken" to="/portal/b2b/my-orders" class="back-btn" style="margin-left: 16px">
              我的订单
            </router-link>
            <a-button v-if="b2bToken" type="link" danger @click="b2bLogout">退出登录</a-button>
          </div>
        </div>

        <div class="b2b-portal-header">
          <div class="b2b-portal-logo">
            <img src="/icons/icon-maskable.svg" alt="" class="b2b-logo-mark" width="52" height="52" />
            <div class="b2b-logo-text">
              <h2 class="logo-title">MOJE</h2>
              <span class="logo-subtitle">珠宝定制服务平台</span>
            </div>
          </div>
          <span class="b2b-portal-tagline">传承匠心工艺 · 定制专属珠宝</span>
        </div>

        <div class="gold-divider"></div>

        <a-tabs v-model:activeKey="activeTab">
          <a-tab-pane key="create" tab="创建订单">
            <template v-if="!b2bToken">
              <a-alert
                type="warning"
                show-icon
                message="请先登录或注册"
                description="按业务要求，录入订单前须完成 B 端账号登录。"
              />
              <div style="margin-top: 16px; text-align: center">
                <a-button type="primary" @click="activeTab = 'login'">去登录</a-button>
                <a-button style="margin-left: 12px" @click="activeTab = 'register'">去注册</a-button>
              </div>
            </template>
            <a-form
              v-else
              ref="orderFormRef"
              :model="orderForm"
              layout="vertical"
              @finish="handleCreateOrder"
              class="b2b-form"
            >
              <a-alert
                type="info"
                show-icon
                message="已登录 B 端账号"
                style="margin-bottom: 16px"
              />

              <div class="form-section">
                <div class="section-header">
                  <h4 class="section-title">客户信息（可选补充）</h4>
                </div>
                <p class="section-hint">已从您最近一次下单填写的内容中预填，可自行修改。</p>

                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="公司名称" name="companyName">
                      <a-input
                        v-model:value="orderForm.companyName"
                        placeholder="公司或店铺名称"
                        class="b2b-input"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="联系人" name="contactPerson">
                      <a-input
                        v-model:value="orderForm.contactPerson"
                        placeholder="联系人姓名"
                        class="b2b-input"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>

              <div class="gold-divider-small"></div>

              <div class="form-section">
                <div class="section-header">
                  <h4 class="section-title">订单需求</h4>
                </div>

                <a-form-item
                  label="基础需求"
                  name="basicRequirements"
                  :rules="[{ required: true, message: '请描述您的需求' }]"
                >
                  <a-textarea
                    v-model:value="orderForm.basicRequirements"
                    :rows="4"
                    placeholder="请描述您的珠宝定制需求..."
                    class="b2b-textarea"
                  />
                </a-form-item>

                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="款式信息" name="styleInfo">
                      <a-textarea
                        v-model:value="orderForm.styleInfo"
                        :rows="3"
                        placeholder="款式描述，如：戒指、项链、手镯..."
                        class="b2b-textarea"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="材质信息" name="materialInfo">
                      <a-textarea
                        v-model:value="orderForm.materialInfo"
                        :rows="3"
                        placeholder="材质要求，如：925银、足金、K金..."
                        class="b2b-textarea"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>

                <a-form-item label="上传附件">
                  <a-upload
                    v-model:file-list="fileList"
                    action="#"
                    :before-upload="beforeUpload"
                    multiple
                    list-type="text"
                  >
                    <a-button>
                      <UploadOutlined />
                      点击上传
                    </a-button>
                    <template #tip>
                      <div class="ant-upload-hint">
                        支持图片、Word、Excel、PDF等文件，可多选
                      </div>
                    </template>
                  </a-upload>
                </a-form-item>
              </div>

              <a-form-item>
                <a-button
                  type="primary"
                  html-type="submit"
                  :loading="loading"
                  block
                  class="b2b-submit-btn"
                >
                  创建订单
                </a-button>
              </a-form-item>
            </a-form>
          </a-tab-pane>

          <a-tab-pane key="login" tab="登录">
            <a-form
              ref="loginFormRef"
              :model="loginForm"
              layout="vertical"
              @finish="handleLogin"
              class="b2b-form"
            >
              <a-form-item
                label="联系方式"
                name="contact"
                :rules="[{ required: true, message: '请输入联系方式' }]"
              >
                <a-input
                  v-model:value="loginForm.contact"
                  placeholder="手机号或微信号"
                  class="b2b-input"
                />
              </a-form-item>

              <a-form-item
                label="密码"
                name="password"
                :rules="[{ required: true, message: '请输入密码' }]"
              >
                <a-input-password
                  v-model:value="loginForm.password"
                  placeholder="密码"
                  class="b2b-input"
                />
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary"
                  html-type="submit"
                  block
                  class="b2b-submit-btn"
                >
                  登录
                </a-button>
              </a-form-item>

              <div class="form-footer">
                <a-button
                  type="link"
                  @click="activeTab = 'register'"
                  class="b2b-link-btn"
                >
                  还没有账号？立即注册
                </a-button>
              </div>
            </a-form>
          </a-tab-pane>

          <a-tab-pane key="register" tab="注册">
            <a-form
              ref="registerFormRef"
              :model="registerForm"
              layout="vertical"
              @finish="handleRegister"
              class="b2b-form"
            >
              <a-form-item
                label="联系方式"
                name="contact"
                :rules="[{ required: true, message: '请输入手机号或微信号' }]"
              >
                <a-input
                  v-model:value="registerForm.contact"
                  placeholder="手机号或微信号"
                  class="b2b-input"
                />
              </a-form-item>

              <a-form-item
                label="密码"
                name="password"
                :rules="[{ required: true, message: '请输入密码' }]"
              >
                <a-input-password
                  v-model:value="registerForm.password"
                  placeholder="密码"
                  class="b2b-input"
                />
              </a-form-item>

              <a-form-item
                label="确认密码"
                name="confirmPassword"
                :rules="confirmPasswordRules"
              >
                <a-input-password
                  v-model:value="registerForm.confirmPassword"
                  placeholder="确认密码"
                  class="b2b-input"
                />
              </a-form-item>

              <a-row :gutter="16">
                <a-col :span="12">
                  <a-form-item label="公司名称" name="companyName">
                    <a-input
                      v-model:value="registerForm.companyName"
                      placeholder="公司或店铺名称"
                      class="b2b-input"
                    />
                  </a-form-item>
                </a-col>
                <a-col :span="12">
                  <a-form-item label="联系人" name="contactPerson">
                    <a-input
                      v-model:value="registerForm.contactPerson"
                      placeholder="联系人姓名"
                      class="b2b-input"
                    />
                  </a-form-item>
                </a-col>
              </a-row>

              <a-form-item label="邮箱" name="email">
                <a-input
                  v-model:value="registerForm.email"
                  placeholder="电子邮箱"
                  class="b2b-input"
                />
              </a-form-item>

              <a-form-item>
                <a-button
                  type="primary"
                  html-type="submit"
                  block
                  class="b2b-submit-btn"
                >
                  注册
                </a-button>
              </a-form-item>

              <div class="form-footer">
                <a-button
                  type="link"
                  @click="activeTab = 'login'"
                  class="b2b-link-btn"
                >
                  已有账号？立即登录
                </a-button>
              </div>
            </a-form>
          </a-tab-pane>
        </a-tabs>

        <template v-if="b2bToken">
          <a-divider />
          <h4 style="margin-bottom: 12px">绑定已有订单</h4>
          <p style="color: #888; font-size: 13px; margin-bottom: 12px">
            输入订单编号与凭证（分享链接中的 view_token 或 B2B 访问 token），将订单纳入「我的订单」。
          </p>
          <a-form layout="inline" @finish="handleB2bBind">
            <a-form-item label="订单编号">
              <a-input v-model:value="b2bBindForm.orderNumber" style="width: 200px" />
            </a-form-item>
            <a-form-item label="凭证">
              <a-input-password v-model:value="b2bBindForm.proofToken" style="width: 220px" />
            </a-form-item>
            <a-form-item>
              <a-button type="default" html-type="submit" :loading="bindLoading">绑定</a-button>
            </a-form-item>
          </a-form>
        </template>
      </a-card>
    </div>

    <a-modal
      v-model:open="showResult"
      title="订单创建成功"
      :footer="null"
      :width="600"
      class="success-modal"
    >
      <div class="success-content" v-if="orderResult">
        <div class="success-header">
          <img src="/icons/icon-maskable.svg" alt="" class="success-logo-mark" width="72" height="72" />
          <h3 class="success-title">订单创建成功</h3>
        </div>
        <div class="gold-divider"></div>
        <a-space direction="vertical" style="width: 100%; gap: 16px">
          <div class="result-item">
            <span class="result-label">订单编号</span>
            <span class="result-value">{{ orderResult.orderNumber }}</span>
          </div>

          <div class="result-item">
            <span class="result-label">
              <LinkOutlined class="result-icon" />
              访问链接
            </span>
            <a
              :href="orderResult.accessUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="result-link"
            >
              {{ orderResult.accessUrl }}
            </a>
          </div>

          <div class="result-item">
            <span class="result-label">
              <QrcodeOutlined class="result-icon" />
              二维码
            </span>
            <div class="qrcode-container">
              <img
                :src="orderResult.qrcodeBase64"
                alt="订单二维码"
                class="qrcode-image"
              />
            </div>
          </div>

          <div class="result-item">
            <span class="result-label">
              <ClockCircleOutlined class="result-icon" />
              有效期至
            </span>
            <span class="result-value">{{ orderResult.expireTime }}</span>
          </div>

          <div class="result-tip">
            <span style="color: #808080">请保存好以上信息，便于查看订单进度</span>
          </div>
        </a-space>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  QrcodeOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  UploadOutlined
} from '@ant-design/icons-vue'
import {
  createOrder,
  createOrderWithFiles,
  loginClient,
  registerClient,
  b2bBindOrder,
  getLastOrderProfile,
  type B2BClientLoginResponse,
  type B2BOrderCreateRequest,
  type B2BClientLoginRequest,
  type B2BClientRegisterRequest,
  type B2BOrderAccessDto
} from '@/api'
import {
  clearB2bToken,
  getB2bTokenRaw,
  isB2bTokenExpiredOrInvalid,
  setB2bToken
} from '@/utils/b2bAuth'
import type { UploadProps, UploadFile } from 'ant-design-vue'

const activeTab = ref('login')
const loading = ref(false)
const showResult = ref(false)
const orderResult = ref<B2BOrderAccessDto | null>(null)
const fileList = ref<UploadFile[]>([])

const b2bToken = ref(false)
const syncB2bToken = () => {
  const raw = getB2bTokenRaw()
  if (raw && isB2bTokenExpiredOrInvalid(raw)) {
    clearB2bToken()
    b2bToken.value = false
    return
  }
  b2bToken.value = !!raw
}

const onStorage = (e: StorageEvent) => {
  if (e.key === 'moje_b2b_token') syncB2bToken()
}

const onB2bAuthExpired = () => {
  syncB2bToken()
  if (!b2bToken.value) {
    message.warning('登录已失效，请重新登录')
    activeTab.value = 'login'
  }
}

const applyDraftProfile = async () => {
  if (!getB2bTokenRaw()) return
  try {
    const p = await getLastOrderProfile()
    if (p.companyName) orderForm.value.companyName = p.companyName
    if (p.contactPerson) orderForm.value.contactPerson = p.contactPerson
    if (p.styleInfo) orderForm.value.styleInfo = p.styleInfo
    if (p.materialInfo) orderForm.value.materialInfo = p.materialInfo
  } catch {
    /* 忽略 */
  }
}

onMounted(async () => {
  syncB2bToken()
  if (b2bToken.value) {
    activeTab.value = 'create'
    await applyDraftProfile()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('moje-b2b-auth-expired', onB2bAuthExpired as EventListener)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('moje-b2b-auth-expired', onB2bAuthExpired as EventListener)
})

const b2bLogout = () => {
  clearB2bToken()
  syncB2bToken()
  activeTab.value = 'login'
  message.success('已退出')
}

const b2bBindForm = ref({ orderNumber: '', proofToken: '' })
const bindLoading = ref(false)

const handleB2bBind = async () => {
  bindLoading.value = true
  try {
    await b2bBindOrder(b2bBindForm.value.orderNumber.trim(), b2bBindForm.value.proofToken.trim())
    message.success('绑定成功')
    b2bBindForm.value = { orderNumber: '', proofToken: '' }
  } finally {
    bindLoading.value = false
  }
}

/** originFileObj 在类型上含 RcFile 扩展字段，不能写 `filter((f): f is File => …)`（TS2677）。 */
function toFormFile(raw: UploadFile['originFileObj']): File | null {
  if (raw == null) return null
  if (raw instanceof File) return raw
  return raw as unknown as File
}

const orderForm = ref<B2BOrderCreateRequest>({
  companyName: '',
  contactPerson: '',
  basicRequirements: '',
  styleInfo: '',
  materialInfo: ''
})

const loginForm = ref<B2BClientLoginRequest>({
  contact: '',
  password: ''
})

const registerForm = ref<B2BClientRegisterRequest & { confirmPassword: string }>({
  contact: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  contactPerson: '',
  email: ''
})

const confirmPasswordRules = computed(() => [
  { required: true, message: '请确认密码' },
  {
    validator: (_rule: any, value: string) => {
      if (!value || value === registerForm.value.password) {
        return Promise.resolve()
      }
      return Promise.reject('两次输入的密码不一致')
    },
    trigger: 'change'
  }
])

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isImageOrDoc = /\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|stl|obj|jad)$/i.test(file.name)
  if (!isImageOrDoc) {
    message.error('仅支持图片、Word、Excel、PDF和建模文件')
    return false
  }
  const isLt20M = file.size / 1024 / 1024 < 20
  if (!isLt20M) {
    message.error('文件大小不能超过20MB')
    return false
  }
  fileList.value.push(file as UploadFile)
  return false
}

const handleCreateOrder = async () => {
  const tok = getB2bTokenRaw()
  if (!tok || isB2bTokenExpiredOrInvalid(tok)) {
    clearB2bToken()
    syncB2bToken()
    message.error('登录已过期或未登录，请重新登录后再提交')
    activeTab.value = 'login'
    return
  }
  try {
    loading.value = true
    const attachmentFiles = fileList.value
      .map((uf) => toFormFile(uf.originFileObj))
      .filter((f): f is File => f !== null)
    const result =
      attachmentFiles.length > 0
        ? await createOrderWithFiles(orderForm.value, attachmentFiles)
        : await createOrder(orderForm.value)
    orderResult.value = result
    showResult.value = true
    message.success('订单创建成功')
    orderForm.value = {
      companyName: '',
      contactPerson: '',
      basicRequirements: '',
      styleInfo: '',
      materialInfo: ''
    }
    fileList.value = []
  } catch (error) {
    console.error('创建订单失败:', error)
  } finally {
    loading.value = false
  }
}

const handleLogin = async () => {
  try {
    const res: B2BClientLoginResponse = await loginClient(loginForm.value)
    setB2bToken(res.accessToken)
    syncB2bToken()
    message.success('登录成功')
    loginForm.value = {
      contact: '',
      password: ''
    }
    activeTab.value = 'create'
    await applyDraftProfile()
  } catch (error) {
    console.error('登录失败:', error)
  }
}

const handleRegister = async () => {
  try {
    const res: B2BClientLoginResponse = await registerClient(registerForm.value)
    setB2bToken(res.accessToken)
    syncB2bToken()
    message.success('注册成功，已自动登录')
    activeTab.value = 'create'
    await applyDraftProfile()
    registerForm.value = {
      contact: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      contactPerson: '',
      email: ''
    }
  } catch (error) {
    console.error('注册失败:', error)
  }
}
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.section-hint {
  font-size: 13px;
  color: #888;
}

.form-footer {
  text-align: center;
}

.b2b-link-btn {
  color: var(--primary-color);
}
</style>
