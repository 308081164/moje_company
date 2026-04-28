<template>
  <div class="b2b-portal-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false">
        <div class="b2b-portal-header">
          <div class="b2b-portal-logo">
            <ShopOutlined class="b2b-logo-icon" />
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
            <a-form
              ref="orderFormRef"
              :model="orderForm"
              layout="vertical"
              @finish="handleCreateOrder"
              class="b2b-form"
            >
              <div class="form-section">
                <div class="section-header">
                  <h4 class="section-title">联系方式</h4>
                  <span class="section-hint">(创建订单必需)</span>
                </div>

                <a-form-item
                  label="联系方式"
                  name="contact"
                  :rules="[{ required: true, message: '请输入手机号或微信号' }]"
                >
                  <a-input
                    v-model:value="orderForm.contact"
                    placeholder="手机号或微信号"
                    class="b2b-input"
                  />
                </a-form-item>

                <a-form-item label="设置密码(选填)" name="password">
                  <a-input-password
                    v-model:value="orderForm.password"
                    placeholder="设置密码方便下次登录"
                    class="b2b-input"
                  />
                </a-form-item>

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

                <a-form-item label="邮箱" name="email">
                  <a-input
                    v-model:value="orderForm.email"
                    placeholder="电子邮箱"
                    class="b2b-input"
                  />
                </a-form-item>
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

                <a-row :gutter="16">
                  <a-col :span="12">
                    <a-form-item label="定金金额" name="depositAmount">
                      <a-input-number
                        v-model:value="orderForm.depositAmount"
                        style="width: 100%"
                        placeholder="定金金额(选填)"
                        class="b2b-input"
                        :min="0"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="来源备注" name="sourceDetail">
                      <a-input
                        v-model:value="orderForm.sourceDetail"
                        placeholder="如：抖音、小红书、达人推荐等"
                        class="b2b-input"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>
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
          <ShopOutlined class="success-icon" />
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
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import {
  ShopOutlined,
  QrcodeOutlined,
  LinkOutlined,
  ClockCircleOutlined
} from '@ant-design/icons-vue'
import { createOrder, loginClient, registerClient } from '@/api'
import type {
  B2BOrderCreateRequest,
  B2BClientLoginRequest,
  B2BClientRegisterRequest,
  B2BOrderAccessDto
} from '@/api'

const activeTab = ref('create')
const loading = ref(false)
const showResult = ref(false)
const orderResult = ref<B2BOrderAccessDto | null>(null)

const orderForm = ref<B2BOrderCreateRequest>({
  contact: '',
  password: '',
  companyName: '',
  contactPerson: '',
  email: '',
  basicRequirements: '',
  styleInfo: '',
  materialInfo: '',
  sourceDetail: ''
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

const handleCreateOrder = async () => {
  try {
    loading.value = true
    const result = await createOrder(orderForm.value)
    orderResult.value = result
    showResult.value = true
    message.success('订单创建成功')
    orderForm.value = {
      contact: '',
      password: '',
      companyName: '',
      contactPerson: '',
      email: '',
      basicRequirements: '',
      styleInfo: '',
      materialInfo: '',
      sourceDetail: ''
    }
  } catch (error) {
    console.error('创建订单失败:', error)
  } finally {
    loading.value = false
  }
}

const handleLogin = async () => {
  try {
    await loginClient(loginForm.value)
    message.success('登录成功')
    loginForm.value = {
      contact: '',
      password: ''
    }
  } catch (error) {
    console.error('登录失败:', error)
  }
}

const handleRegister = async () => {
  try {
    await registerClient(registerForm.value)
    message.success('注册成功')
    activeTab.value = 'login'
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

<style scoped></style>
