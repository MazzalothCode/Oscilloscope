CREATE TABLE IF NOT EXISTS download_counter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO download_counter (id, count) VALUES (1, 0);
