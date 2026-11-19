-- Condominium block + room type on Property
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "block_number" TEXT;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "room_type" TEXT;
