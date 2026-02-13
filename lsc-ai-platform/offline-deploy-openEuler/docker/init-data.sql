-- LSC-AI Platform 初始化数据
-- 默认管理员: admin / Admin@123

-- 创建角色
INSERT INTO roles (id, code, name, description, permissions, is_system, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'admin', '超级管理员', '拥有系统所有权限', '["*"]', true, NOW(), NOW()),
  (gen_random_uuid(), 'sys_admin', '系统管理员', '系统配置与用户管理', '["admin:user", "admin:role", "admin:system", "admin:audit", "monitor:*"]', true, NOW(), NOW()),
  (gen_random_uuid(), 'developer', '开发者', '完整功能使用', '["chat:*", "workbench:*", "project:*", "task:*", "rpa:*"]', true, NOW(), NOW()),
  (gen_random_uuid(), 'user', '普通用户', '基础功能使用', '["chat:create", "chat:read", "workbench:use", "project:read"]', true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 创建 admin 用户 (密码: Admin@123, bcrypt hash with 12 rounds)
-- 哈希值由 bcrypt.hash('Admin@123', 12) 生成
INSERT INTO users (id, username, password, email, display_name, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin',
  '$2b$12$lSiwsSRavDXx08O2XdcVwOVWRz7Q9aAIWxvPhslArEITZNdM2yW06',
  'admin@company.com',
  '系统管理员',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- 为 admin 分配超级管理员角色
INSERT INTO user_roles (id, user_id, role_id, created_at)
SELECT gen_random_uuid(), u.id, r.id, NOW()
FROM users u, roles r
WHERE u.username = 'admin' AND r.code = 'admin'
ON CONFLICT DO NOTHING;
