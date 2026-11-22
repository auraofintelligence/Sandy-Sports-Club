ALTER TABLE honours_entries ADD COLUMN placing INTEGER CHECK(placing BETWEEN 1 AND 99);
ALTER TABLE honours_entries ADD COLUMN prize_awarded TEXT NOT NULL DEFAULT '';
ALTER TABLE honours_competitions ADD COLUMN offer TEXT NOT NULL DEFAULT '';
ALTER TABLE honours_competitions ADD COLUMN offer_from TEXT NOT NULL DEFAULT '';
ALTER TABLE honours_competitions ADD COLUMN offer_until TEXT NOT NULL DEFAULT '';
