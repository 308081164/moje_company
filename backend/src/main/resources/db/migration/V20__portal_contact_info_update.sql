-- B 端门户联系信息：更新地址，电话与邮箱暂留空（营业时间保持原配置或默认）
UPDATE portal_site_settings
SET
    address = '广东省广州市番禺区 广州番禺沙头街小平村工业大道2号李济新能源大厦2楼',
    contact_phone = NULL,
    contact_email = NULL
WHERE id = 1;
