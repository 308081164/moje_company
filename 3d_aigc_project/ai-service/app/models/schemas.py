"""
Pydantic数据模型定义
定义API请求和响应的数据结构
"""

from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, model_validator, field_validator
from datetime import datetime
import uuid


# ============================================================
# 枚举类型
# ============================================================

class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"           # 等待处理
    PROCESSING = "processing"     # 处理中
    COMPLETED = "completed"       # 已完成
    FAILED = "failed"             # 失败
    CANCELLED = "cancelled"       # 已取消


class ResultFormat(str, Enum):
    """结果文件格式"""
    GLB = "glb"                   # GLB格式（推荐，支持纹理）
    OBJ = "obj"                   # OBJ格式（通用）
    STL = "stl"                   # STL格式（3D打印）
    PLY = "ply"                   # PLY格式（点云/网格）
    GLTF = "gltf"                 # glTF格式
    FBX = "fbx"                   # FBX格式


class ModelVersion(str, Enum):
    """模型版本"""
    MINI = "mini"                 # 轻量级模型
    STANDARD = "standard"         # 标准模型
    TURBO = "turbo"               # 高性能模型


class FusionMethod(str, Enum):
    """网格融合方法"""
    BOOLEAN = "boolean"           # 布尔融合（SDF）
    ICP_MERGE = "icp_merge"       # ICP对齐后合并
    SIMPLE = "simple"             # 简单合并（无对齐）


# ============================================================
# 请求模型
# ============================================================

class GenerateRequest(BaseModel):
    """
    图片生成3D请求
    支持单图或多视图（六视图中的任意 2+ 张）
    """
    task_id: Optional[str] = Field(
        None,
        description="外部指定任务ID（与业务层对齐）"
    )
    image_path: Optional[str] = Field(
        None,
        description="输入图片路径（单图模式必填；多视图时可选，默认取正视图）"
    )
    multi_view: bool = Field(
        False,
        description="是否启用多视图生成"
    )
    views: Optional[Dict[str, str]] = Field(
        None,
        description="多视图图片路径，键为 front/back/left/right/top/bottom"
    )
    setting_mesh_path: Optional[str] = Field(
        None,
        description="镶嵌底座网格路径（可选，用于条件生成）"
    )
    prompt: Optional[str] = Field(
        None,
        description="生成提示词（可选，辅助描述期望的3D效果）"
    )
    negative_prompt: Optional[str] = Field(
        None,
        description="负面提示词（不希望出现的内容）"
    )
    result_format: ResultFormat = Field(
        ResultFormat.GLB,
        description="输出结果格式"
    )
    model_version: Optional[ModelVersion] = Field(
        None,
        description="指定模型版本（不指定则自动选择）"
    )
    image_resolution: Optional[int] = Field(
        None,
        description="输入图像分辨率（不指定则根据模型版本自动选择）"
    )
    callback_url: Optional[str] = Field(
        None,
        description="回调URL（任务完成后通知）"
    )
    apply_texture: Optional[bool] = Field(
        None,
        description="是否烘焙纹理；None 时由 TRACK_A_GEOMETRY_ONLY 环境变量决定",
    )
    inlay_type: Optional[str] = Field(
        None,
        description="镶嵌类型（prong/bezel 等，有 setting_mesh_path 时用于 prompt 增强）",
    )
    gem_type: Optional[str] = Field(
        None,
        description="宝石类型（diamond/ruby 等，有 setting_mesh_path 时用于 prompt 增强）",
    )
    enable_icp_alignment: bool = Field(
        True,
        description="与镶嵌底座融合前是否 ICP 对齐",
    )
    enable_mesh_fusion: bool = Field(
        True,
        description="是否将 AI 生成主体与镶嵌底座布尔融合",
    )

    @field_validator("prompt", "negative_prompt", mode="before")
    @classmethod
    def _coerce_optional_text(cls, value):
        return value or ""

    @model_validator(mode="after")
    def validate_image_input(self):
        view_count = len(self.views) if self.views else 0
        if self.multi_view or view_count > 0:
            if view_count < 2:
                raise ValueError("多视图模式至少需要 2 个视角图片")
            if not self.image_path and self.views:
                for key in ("front", "left", "back", "right", "top", "bottom"):
                    if key in self.views:
                        self.image_path = self.views[key]
                        break
        elif not self.image_path:
            raise ValueError("单图模式必须提供 image_path")
        return self

    class Config:
        json_schema_extra = {
            "example": {
                "multi_view": True,
                "views": {
                    "front": "./uploads/task/views/front.png",
                    "left": "./uploads/task/views/left.png",
                },
                "prompt": "一枚精致的钻石戒指，铂金材质",
                "result_format": "glb",
            }
        }


class ConditionGenerateRequest(BaseModel):
    """
    条件生成请求
    设计图 + 镶嵌底座 -> 珠宝3D模型
    """
    task_id: Optional[str] = Field(
        None,
        description="外部指定任务ID（与业务层对齐）"
    )
    design_image_path: str = Field(
        ...,
        description="设计图路径"
    )
    setting_mesh_path: str = Field(
        ...,
        description="镶嵌底座网格路径"
    )
    inlay_type: Optional[str] = Field(
        None,
        description="镶嵌类型（如: prong, bezel, pave, channel等）"
    )
    gem_type: Optional[str] = Field(
        None,
        description="宝石类型（如: diamond, ruby, sapphire, emerald等）"
    )
    gem_size: Optional[float] = Field(
        None,
        description="宝石尺寸（毫米）"
    )
    prompt: Optional[str] = Field(
        None,
        description="生成提示词"
    )
    result_format: ResultFormat = Field(
        ResultFormat.GLB,
        description="输出结果格式"
    )
    enable_icp_alignment: bool = Field(
        True,
        description="是否启用ICP点云对齐"
    )
    enable_mesh_fusion: bool = Field(
        True,
        description="是否启用网格融合"
    )

    @field_validator("prompt", mode="before")
    @classmethod
    def _coerce_optional_text(cls, value):
        return value or ""

    class Config:
        json_schema_extra = {
            "example": {
                "design_image_path": "./uploads/necklace_design.png",
                "setting_mesh_path": "./uploads/pendant_setting.obj",
                "inlay_type": "prong",
                "gem_type": "diamond",
                "prompt": "钻石吊坠，四爪镶嵌",
                "result_format": "glb",
            }
        }


class MeshFusionRequest(BaseModel):
    """
    网格融合请求
    底座 + 生成结果 -> 完整模型
    """
    base_mesh_path: str = Field(
        ...,
        description="底座网格文件路径"
    )
    generated_mesh_path: str = Field(
        ...,
        description="生成的网格文件路径"
    )
    fusion_method: FusionMethod = Field(
        FusionMethod.BOOLEAN,
        description="融合方法"
    )
    output_format: ResultFormat = Field(
        ResultFormat.GLB,
        description="输出格式"
    )
    icp_iterations: int = Field(
        50,
        description="ICP对齐迭代次数"
    )
    enable_topology_repair: bool = Field(
        True,
        description="是否启用拓扑修复"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "base_mesh_path": "./outputs/setting_base.obj",
                "generated_mesh_path": "./outputs/generated_gem.obj",
                "fusion_method": "boolean",
                "output_format": "glb",
            }
        }


# ============================================================
# 响应模型
# ============================================================

class GenerateResponse(BaseModel):
    """
    生成任务响应
    """
    task_id: str = Field(
        ...,
        description="任务ID"
    )
    status: TaskStatus = Field(
        ...,
        description="任务状态"
    )
    message: str = Field(
        "",
        description="状态描述信息"
    )
    result_url: Optional[str] = Field(
        None,
        description="结果文件URL（任务完成后）"
    )
    result_files: Optional[List[str]] = Field(
        None,
        description="结果文件列表"
    )
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="任务创建时间"
    )
    completed_at: Optional[datetime] = Field(
        None,
        description="任务完成时间"
    )
    processing_time: Optional[float] = Field(
        None,
        description="处理耗时（秒）"
    )


class TaskStatusResponse(BaseModel):
    """
    任务状态查询响应
    """
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态")
    progress: float = Field(0.0, description="进度百分比（0-100）")
    message: str = Field("", description="状态描述")
    current_step: Optional[str] = Field(None, description="当前处理步骤")
    error: Optional[str] = Field(None, description="失败时的详细错误信息")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")


class TaskResultResponse(BaseModel):
    """
    任务结果响应
    """
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态")
    result_url: str = Field(..., description="结果文件URL")
    result_files: List[str] = Field(default_factory=list, description="结果文件列表")
    file_size: Optional[int] = Field(None, description="文件大小（字节）")
    format: Optional[str] = Field(None, description="文件格式")
    preview_url: Optional[str] = Field(None, description="预览图URL")
    metadata: Optional[Dict[str, Any]] = Field(None, description="附加元数据")
    processing_time: Optional[float] = Field(None, description="处理耗时（秒）")


class MeshFusionResponse(BaseModel):
    """
    网格融合响应
    """
    task_id: str = Field(..., description="任务ID")
    status: TaskStatus = Field(..., description="任务状态")
    result_url: Optional[str] = Field(None, description="融合结果URL")
    vertex_count: Optional[int] = Field(None, description="顶点数")
    face_count: Optional[int] = Field(None, description="面数")
    volume: Optional[float] = Field(None, description="体积（mm^3）")
    message: str = Field("", description="描述信息")


class SystemInfo(BaseModel):
    """
    系统信息响应
    """
    gpu_name: str = Field(..., description="GPU型号")
    vram_gb: float = Field(..., description="显存大小（GB）")
    cuda_version: Optional[str] = Field(None, description="CUDA版本")
    driver_version: Optional[str] = Field(None, description="驱动版本")
    gpu_available: bool = Field(..., description="GPU是否可用")
    recommended_model: str = Field(..., description="推荐模型版本")
    recommended_config: Optional[Dict[str, Any]] = Field(None, description="推荐配置详情")
    recommendation_reason: str = Field("", description="推荐原因")
    model_loaded: bool = Field(False, description="模型是否已加载")
    current_model_version: Optional[str] = Field(None, description="当前加载的模型版本")


class RemoveBackgroundResponse(BaseModel):
    """背景扣除预处理响应"""
    success: bool = Field(True, description="是否成功")
    session_id: str = Field(..., description="预处理会话 ID")
    processed_path: str = Field(..., description="处理后图像本地路径")
    preview_url: str = Field(..., description="预览 URL（AI 服务静态资源）")
    original_path: Optional[str] = Field(None, description="原始图像路径")


class ViewCropItem(BaseModel):
    """切分出的单个视图区域"""
    id: str = Field(..., description="crop 标识")
    x: int = Field(..., description="在原图中的 x")
    y: int = Field(..., description="在原图中的 y")
    width: int = Field(..., description="宽")
    height: int = Field(..., description="高")
    guess: Optional[str] = Field(None, description="启发式猜测的视角 front/left/...")
    preview_url: str = Field(..., description="裁剪图预览 URL")
    processed_path: Optional[str] = Field(None, description="本地路径")


class SplitMultiViewResponse(BaseModel):
    """多视图合一图切分响应"""
    success: bool = Field(True, description="是否成功")
    session_id: str = Field(..., description="会话 ID")
    source_width: int = Field(..., description="原图宽")
    source_height: int = Field(..., description="原图高")
    original_path: Optional[str] = Field(None, description="原图路径")
    crops: List[ViewCropItem] = Field(default_factory=list, description="切分结果")


class HealthResponse(BaseModel):
    """
    健康检查响应
    """
    status: str = Field("ok", description="服务状态")
    version: str = Field("1.0.0", description="服务版本")
    uptime: float = Field(0.0, description="运行时间（秒）")
    gpu_available: bool = Field(False, description="GPU是否可用")
    model_loaded: bool = Field(False, description="模型是否已加载")
    active_tasks: int = Field(0, description="活跃任务数")


class ErrorResponse(BaseModel):
    """
    错误响应
    """
    error: str = Field(..., description="错误类型")
    message: str = Field(..., description="错误描述")
    detail: Optional[str] = Field(None, description="详细信息")
    code: int = Field(500, description="错误码")


# ============================================================
# 内部数据模型（非API直接使用）
# ============================================================

class TaskInfo(BaseModel):
    """
    任务内部信息（用于内存任务队列）
    """
    task_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    message: str = ""
    current_step: Optional[str] = None
    request_type: str = ""  # image_to_3d / condition_generate / mesh_fusion
    params: Dict[str, Any] = Field(default_factory=dict)
    result_url: Optional[str] = None
    result_files: List[str] = Field(default_factory=list)
    error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    processing_time: Optional[float] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
