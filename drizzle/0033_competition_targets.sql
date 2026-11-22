-- An empty list keeps existing competitions open to every eligible club species.
ALTER TABLE honours_competitions ADD COLUMN target_species TEXT NOT NULL DEFAULT '[]'
  CHECK(json_valid(target_species) AND json_type(target_species)='array');
