-- LSC-AI Platform 数据库初始化脚本
-- 此脚本在 PostgreSQL 容器首次启动时自动执行

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建只读用户（用于报表查询）
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'readonly') THEN
    CREATE ROLE readonly WITH LOGIN PASSWORD 'readonly123';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE lscai_dev TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;

-- 输出完成信息
DO $$
BEGIN
  RAISE NOTICE 'LSC-AI Platform 数据库初始化完成';
END
$$;
