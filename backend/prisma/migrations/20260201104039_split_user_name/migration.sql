-- Step 1: Add new columns with default values
ALTER TABLE "users" ADD COLUMN "first_name" TEXT;
ALTER TABLE "users" ADD COLUMN "last_name" TEXT;

-- Step 2: Migrate data from full_name to first_name and last_name
UPDATE "users" SET 
  "first_name" = split_part("full_name", ' ', 1),
  "last_name" = COALESCE(split_part("full_name", ' ', 2), split_part("full_name", ' ', 1));

-- Step 3: Make columns NOT NULL
ALTER TABLE "users" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "last_name" SET NOT NULL;

-- Step 4: Drop old column
ALTER TABLE "users" DROP COLUMN "full_name";
