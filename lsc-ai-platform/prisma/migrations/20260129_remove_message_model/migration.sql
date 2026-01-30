-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_session_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "messages_session_id_idx";

-- DropTable
DROP TABLE IF EXISTS "messages";
