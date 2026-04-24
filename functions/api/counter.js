const COUNTER_ID = 1;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export async function onRequestGet(context) {
  const database = context.env.DB;

  if (!database) {
    return json(
      {
        ok: false,
        count: 0,
        error: "Missing D1 binding. Add a DB binding before deploying the shared counter.",
      },
      503
    );
  }

  try {
    await ensureCounterRow(database);
    const result = await database
      .prepare("SELECT count FROM download_counter WHERE id = ?")
      .bind(COUNTER_ID)
      .first();

    return json({
      ok: true,
      count: Number(result?.count || 0),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        count: 0,
        error: "Failed to read the shared download counter.",
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  const database = context.env.DB;

  if (!database) {
    return json(
      {
        ok: false,
        count: 0,
        error: "Missing D1 binding. Add a DB binding before deploying the shared counter.",
      },
      503
    );
  }

  try {
    await ensureCounterRow(database);
    await database
      .prepare("UPDATE download_counter SET count = count + 1 WHERE id = ?")
      .bind(COUNTER_ID)
      .run();

    const result = await database
      .prepare("SELECT count FROM download_counter WHERE id = ?")
      .bind(COUNTER_ID)
      .first();

    return json({
      ok: true,
      count: Number(result?.count || 0),
    });
  } catch (error) {
    return json(
      {
        ok: false,
        count: 0,
        error: "Failed to update the shared download counter.",
      },
      500
    );
  }
}

async function ensureCounterRow(database) {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS download_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      count INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO download_counter (id, count) VALUES (1, 0);
  `);
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}
