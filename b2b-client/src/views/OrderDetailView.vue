<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false" :loading="loading">
        <template #title>
          <div class="card-header">
            <img src="/icons/icon-maskable.svg" alt="" class="page-logo-mark" width="28" height="28" />
            <span>订单详情</span>
          </div>
        </template>

        <a-descriptions :column="1" bordered v-if="orderInfo">
          <a-descriptions-item label="订单编号">
            <a-tag color="gold">{{ orderInfo.orderNumber }}</a-tag>
          </a-descriptions-item>

          <a-descriptions-item label="订单状态">
            <a-tag :color="getPortalStatusColor(orderInfo.portalBucket)">
              {{ orderInfo.portalStatusLabel }}
            </a-tag>
          </a-descriptions-item>

          <a-descriptions-item label="下单时间">
            {{ orderInfo.orderTime || '-' }}
          </a-descriptions-item>

          <a-descriptions-item label="客户">
            {{ orderInfo.customerName || orderInfo.customerPhone }}
          </a-descriptions-item>

          <a-divider>您提交的参考图</a-divider>
          <a-descriptions-item label="上传附件" v-if="orderInfo.customerThumbUrls?.length">
            <div class="gallery">
              <a-image
                v-for="(url, idx) in orderInfo.customerThumbUrls"
                :key="'c' + idx"
                :src="url"
                :width="100"
                :height="100"
                style="object-fit: cover; border-radius: 6px"
              />
            </div>
          </a-descriptions-item>
          <a-descriptions-item v-else label="上传附件">
            <span style="color: #999">暂无图片附件</span>
          </a-descriptions-item>

          <a-divider v-if="orderInfo.designImageUrls?.length">设计图稿</a-divider>
          <a-descriptions-item v-if="orderInfo.designImageUrls?.length" label="设计图">
            <div class="gallery">
              <a-image
                v-for="(url, idx) in orderInfo.designImageUrls"
                :key="'d' + idx"
                :src="url"
                :width="100"
                :height="100"
                style="object-fit: cover; border-radius: 6px"
              />
            </div>
          </a-descriptions-item>

          <a-divider>订单需求</a-divider>

          <a-descriptions-item label="基础需求">
            {{ orderInfo.basicRequirements }}
          </a-descriptions-item>

          <a-descriptions-item label="款式信息">
            {{ orderInfo.styleInfo || '-' }}
          </a-descriptions-item>

          <a-descriptions-item label="材质信息">
            {{ orderInfo.materialInfo || '-' }}
          </a-descriptions-item>

          <a-divider>进度与交付</a-divider>

          <a-descriptions-item label="建模效果图" v-if="orderInfo.effectImageUrls?.length">
            <div class="gallery">
              <a-image
                v-for="(url, idx) in orderInfo.effectImageUrls"
                :key="'e' + idx"
                :src="url"
                :width="100"
                :height="100"
                style="object-fit: cover; border-radius: 6px"
              />
            </div>
          </a-descriptions-item>

          <a-descriptions-item label="建模源文件" v-if="orderInfo.modelDownloadRows?.length">
            <div v-for="row in orderInfo.modelDownloadRows" :key="row.url || row.name" style="margin-bottom: 6px">
              <a :href="row.url" target="_blank" rel="noopener noreferrer">{{ row.name }}</a>
            </div>
          </a-descriptions-item>

          <a-descriptions-item label="工艺验证" v-if="orderInfo.reviewResult">
            <a-tag :color="orderInfo.reviewResult === 'APPROVED' ? 'green' : 'red'">
              {{ orderInfo.reviewResult === 'APPROVED' ? '已通过' : '需修改' }}
            </a-tag>
            <p v-if="orderInfo.reviewComment" style="margin-top: 8px; color: #666">
              {{ orderInfo.reviewComment }}
            </p>
          </a-descriptions-item>

          <a-descriptions-item label="报价信息" v-if="orderInfo.quotationAmount">
            <div>报价: ¥{{ Number(orderInfo.quotationAmount).toFixed(2) }}</div>
            <p v-if="orderInfo.quotationDetails" style="color: #666; margin-top: 4px">
              {{ orderInfo.quotationDetails }}
            </p>
          </a-descriptions-item>

          <a-descriptions-item label="生产状态" v-if="orderInfo.productionStatus">
            {{ orderInfo.productionStatus }}
            <p v-if="orderInfo.productionNotes" style="color: #666; margin-top: 4px">
              {{ orderInfo.productionNotes }}
            </p>
          </a-descriptions-item>

          <a-descriptions-item label="物流信息" v-if="orderInfo.shippingTracking">
            {{ orderInfo.shippingTracking }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="footer-actions" style="margin-top: 24px; text-align: center">
          <router-link to="/portal/b2b/my-orders">
            <a-button type="primary">返回我的订单</a-button>
          </router-link>
          <a-button style="margin-left: 12px" @click="router.push('/portal')">返回门户</a-button>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrderByToken } from '@/api'

interface ModelFileRow {
  name: string
  url?: string
}

interface FlatOrderDetail {
  orderNumber: string
  portalStatusLabel: string
  portalBucket?: string
  orderTime?: string
  customerName?: string
  customerPhone?: string
  basicRequirements?: string
  styleInfo?: string
  materialInfo?: string
  customerThumbUrls: string[]
  designImageUrls: string[]
  effectImageUrls: string[]
  modelDownloadRows: ModelFileRow[]
  reviewResult?: string
  reviewComment?: string
  quotationAmount?: number
  quotationDetails?: string
  productionStatus?: string
  productionNotes?: string
  shippingTracking?: string
}

function collectModelFileRows(modelInfo: any): ModelFileRow[] {
  const raw = modelInfo?.modelFiles
  if (raw == null) return []
  let arr: any[] = []
  if (Array.isArray(raw)) {
    arr = raw
  } else if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    if (Array.isArray(o.files)) arr = o.files as any[]
    else if (Array.isArray(o.list)) arr = o.list as any[]
  }
  return arr
    .map((x: any) => ({
      name: String(x.fileName || x.name || '文件'),
      url: typeof x.fileUrl === 'string' ? x.fileUrl : typeof x.url === 'string' ? x.url : undefined
    }))
    .filter((x: ModelFileRow) => Boolean(x.url))
}

function flattenOrder(r: any): FlatOrderDetail {
  const b = r.baseInfo || {}
  const d = r.designInfo || {}
  const m = r.modelInfo || {}
  const rv = r.reviewInfo || {}
  const q = r.quotationInfo || {}
  const hasReview = Boolean(rv.reviewPassedTime || rv.rejectionReason)
  let reviewResult: string | undefined
  let reviewComment: string | undefined
  if (hasReview) {
    if (rv.reviewPassed === true) {
      reviewResult = 'APPROVED'
    } else if (rv.reviewPassed === false) {
      reviewResult = 'REJECTED'
    }
    reviewComment = (rv.rejectionReason || rv.reviewNotes) as string | undefined
  }
  const imgs: string[] = Array.isArray(d.designImages) ? d.designImages : []
  const effects: string[] = Array.isArray(m.modelEffectImages) ? m.modelEffectImages : []
  const b2bThumbs: string[] = Array.isArray(r.b2bAttachmentPreviewUrls) ? r.b2bAttachmentPreviewUrls : []
  return {
    orderNumber: b.orderNumber,
    portalStatusLabel: r.b2bPortalStatusLabel || '建模中',
    portalBucket: r.b2bPortalStatusBucket,
    orderTime: b.orderTime,
    customerName: b.customerName,
    customerPhone: b.customerContact,
    basicRequirements: b.basicRequirements,
    styleInfo: b.style ?? b.styleInfo,
    materialInfo: b.materialInfo,
    customerThumbUrls: b2bThumbs,
    designImageUrls: imgs,
    effectImageUrls: effects,
    modelDownloadRows: collectModelFileRows(m),
    reviewResult,
    reviewComment,
    quotationAmount: q?.totalCost ?? q?.totalAmount ?? q?.quotationAmount,
    quotationDetails: q?.quotationNotes ?? q?.quotationDetails ?? q?.notes,
    productionStatus: r.productionStatus,
    productionNotes: r.productionNotes,
    shippingTracking: r.shippingTracking
  }
}

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const orderInfo = ref<FlatOrderDetail | null>(null)

const getPortalStatusColor = (bucket?: string) => {
  const map: Record<string, string> = {
    MODELING: 'processing',
    ACTION: 'error',
    DONE: 'success',
    CANCELLED: 'default'
  }
  return map[bucket || ''] || 'processing'
}

const loadOrder = async () => {
  const token = route.params.token as string
  if (!token) {
    return
  }

  try {
    loading.value = true
    const raw = await getOrderByToken(token)
    orderInfo.value = flattenOrder(raw)
  } catch (error) {
    console.error('加载订单失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadOrder()
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

.page-logo-mark {
  flex-shrink: 0;
  border-radius: 6px;
  display: block;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
