-- AlterTable
ALTER TABLE "technical_configs" ALTER COLUMN "scope_id" SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- CreateTable
CREATE TABLE "working_hours" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_minutes" INTEGER NOT NULL,
    "close_minutes" INTEGER NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "dealership_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "working_hours_dealership_id_day_of_week_key" ON "working_hours"("dealership_id", "day_of_week");

-- CreateIndex
CREATE INDEX "holidays_dealership_id_is_recurring_idx" ON "holidays"("dealership_id", "is_recurring");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_dealership_id_date_is_recurring_key" ON "holidays"("dealership_id", "date", "is_recurring");

-- AddForeignKey
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "dealerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_dealership_id_fkey" FOREIGN KEY ("dealership_id") REFERENCES "dealerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
