ALTER TABLE question_packs ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX question_packs_tags ON question_packs USING GIN (tags);
