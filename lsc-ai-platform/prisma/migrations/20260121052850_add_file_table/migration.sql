-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "filename" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "object_key" VARCHAR(500) NOT NULL,
    "url" VARCHAR(1000),
    "expand_1" VARCHAR(500),
    "expand_2" VARCHAR(500),
    "expand_3" VARCHAR(500),
    "expand_4" VARCHAR(500),
    "expand_5" VARCHAR(500),
    "extra_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "files_user_id_idx" ON "files"("user_id");

-- CreateIndex
CREATE INDEX "files_session_id_idx" ON "files"("session_id");
