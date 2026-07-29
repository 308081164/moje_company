import os
os.environ["MODEL_PATH"] = r"D:\Hui_Loading\moje_company\3d_aigc_project\models"
from app.config import reload_config
reload_config()
from app.services.preprocess.sam_gem_segment import _models_dir, _resolve_sam1_checkpoint, sam_model_available
print("models_dir:", _models_dir())
print("sam1:", _resolve_sam1_checkpoint())
print("available:", sam_model_available())
