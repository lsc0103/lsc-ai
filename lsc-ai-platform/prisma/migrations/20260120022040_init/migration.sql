-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "email" VARCHAR(100),
    "display_name" VARCHAR(100),
    "avatar" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "login_fail_count" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "last_login_fail_at" TIMESTAMP(3),
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission" VARCHAR(100) NOT NULL,
    "effect" VARCHAR(10) NOT NULL DEFAULT 'allow',
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "working_dir" VARCHAR(500),
    "agent_context" JSONB,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "working_dir" VARCHAR(500),
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "cron_expr" VARCHAR(100) NOT NULL,
    "task_type" VARCHAR(50) NOT NULL,
    "task_config" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_logs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpa_flows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "flow_data" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rpa_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hostname" VARCHAR(200) NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "agent_version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'offline',
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentinel_agents" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "hostname" VARCHAR(200) NOT NULL,
    "ip_address" VARCHAR(50) NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "agent_version" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'offline',
    "capabilities" JSONB NOT NULL DEFAULT '[]',
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentinel_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" VARCHAR(50),
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50),
    "resource_id" VARCHAR(100),
    "details" JSONB,
    "ip_address" VARCHAR(50),
    "user_agent" VARCHAR(500),
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_key" ON "user_permissions"("user_id", "permission");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "messages_session_id_idx" ON "messages"("session_id");

-- CreateIndex
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_tasks_user_id_idx" ON "scheduled_tasks"("user_id");

-- CreateIndex
CREATE INDEX "task_logs_task_id_idx" ON "task_logs"("task_id");

-- CreateIndex
CREATE INDEX "rpa_flows_user_id_idx" ON "rpa_flows"("user_id");

-- CreateIndex
CREATE INDEX "credentials_user_id_idx" ON "credentials"("user_id");

-- CreateIndex
CREATE INDEX "client_agents_user_id_idx" ON "client_agents"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rpa_flows" ADD CONSTRAINT "rpa_flows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_agents" ADD CONSTRAINT "client_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
