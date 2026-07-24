-- Savings metric #2 (est. local build time) + metric #4 (raw doc-corpus tokens). The pipeline's
-- /catalog/upsert fills these as builds land; older frozen rows keep NULL. Surfaced as their own
-- columns (like hero_savings/graphscore) so GET /catalog feeds the site's stat tiles without parsing
-- the savings_json blob. `—` while NULL.
ALTER TABLE doc_versions ADD COLUMN build_seconds INTEGER;  -- metric #2: est. seconds to build this graph on a local M1 model; NULL until built
ALTER TABLE doc_versions ADD COLUMN doc_tokens    INTEGER;  -- metric #4: total tokens of the source doc corpus; NULL until built
