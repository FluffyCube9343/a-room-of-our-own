"""Tiger Data (TimescaleDB) setup, run by manage.py setup_tiger.

Deliberately NOT part of any migration: migrate stays plain Postgres and
always succeeds, and this runs afterwards in autocommit, where a failed
statement can't poison a transaction. Plain Postgres and SQLite skip it.
On Tiger Cloud the events table becomes a hypertable with a continuous
aggregate feeding the impact counter.
"""

# TimescaleDB requires every unique index on a hypertable to include the
# partition column, so the plain `id` primary key must become (id, created_at)
# before/while the table is converted.
DROP_PK_SQL = "ALTER TABLE resources_borrowevent DROP CONSTRAINT IF EXISTS resources_borrowevent_pkey"

HYPERTABLE_SQL_VERSIONED = {
    'hypertable_modern': "SELECT create_hypertable('resources_borrowevent', by_range('created_at'), if_not_exists => TRUE)",
    'hypertable_legacy': "SELECT create_hypertable('resources_borrowevent', 'created_at', if_not_exists => TRUE)",
}

ADD_PK_SQL = """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'resources_borrowevent'::regclass AND contype = 'p'
        ) THEN
            ALTER TABLE resources_borrowevent ADD PRIMARY KEY (id, created_at);
        END IF;
    END $$
"""

CAGG_SQL = """
    CREATE MATERIALIZED VIEW IF NOT EXISTS resources_borrowevent_daily
    WITH (timescaledb.continuous) AS
    SELECT time_bucket(INTERVAL '1 day', created_at) AS day,
           event_type,
           count(*) AS events
    FROM resources_borrowevent
    GROUP BY day, event_type
    WITH NO DATA
"""

POLICY_SQL = """
    SELECT add_continuous_aggregate_policy('resources_borrowevent_daily',
        start_offset => INTERVAL '1 month',
        end_offset => INTERVAL '1 hour',
        schedule_interval => INTERVAL '1 hour',
        if_not_exists => TRUE)
"""


class TigerSetupError(Exception):
    """One Tiger setup statement failed; carries the statement label and real error."""


def _run(cur, label, sql):
    try:
        cur.execute(sql)
    except Exception as exc:
        raise TigerSetupError(f'{label}: {exc}') from exc


def setup_tiger(connection):
    # Returns a list of human-readable steps taken; empty when Tiger Data is absent.
    # Raises TigerSetupError with the real SQL error when a Tiger step fails.
    if connection.vendor != 'postgresql':
        return []
    with connection.cursor() as cur:
        cur.execute("SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'")
        if not cur.fetchone():
            return []
        _run(cur, 'enable timescaledb extension', "CREATE EXTENSION IF NOT EXISTS timescaledb")
        cur.execute("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'")
        version = cur.fetchone()[0]
        major, minor = (int(x) for x in version.split('.')[:2])
        key = 'hypertable_modern' if (major, minor) >= (2, 13) else 'hypertable_legacy'
        _run(cur, 'drop single-column primary key', DROP_PK_SQL)
        _run(cur, 'convert events table to hypertable', HYPERTABLE_SQL_VERSIONED[key])
        _run(cur, 're-add primary key including created_at', ADD_PK_SQL)
        _run(cur, 'create continuous aggregate', CAGG_SQL)
        _run(cur, 'add hourly refresh policy', POLICY_SQL)
    return [f'extension enabled (TimescaleDB {version})', 'events table is a hypertable',
            'continuous aggregate resources_borrowevent_daily with hourly refresh']
