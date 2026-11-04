"""Explicit PostgreSQL 16 migration. No app imports, init_db or seeders.

DATABASE_URL is required. check is read-only; upgrade is additive/idempotent;
downgrade refuses to discard even one deduplication receipt.
"""
import argparse
import os
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parent


def check(cursor):
    cursor.execute("""SELECT column_name, data_type, character_maximum_length, is_nullable
        FROM information_schema.columns WHERE table_schema='public'
        AND table_name='retouch_reminders' ORDER BY ordinal_position""")
    columns = cursor.fetchall()
    expected = [
        ('event_key', 'character varying', 64, 'NO'),
        ('broadcast_id', 'integer', None, 'NO'),
        ('preview_version', 'character varying', 64, 'NO'),
    ]
    if columns != expected:
        raise RuntimeError('retouch_reminders schema differs from v1; refusing to modify it')
    cursor.execute("""SELECT c.contype,
        ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
              JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord),
        c.confrelid::regclass::text, c.confdeltype,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
              JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord)
        FROM pg_constraint c WHERE c.conrelid='public.retouch_reminders'::regclass""")
    constraints = cursor.fetchall()
    if not any(kind == 'p' and names == ['event_key'] for kind, names, *_ in constraints):
        raise RuntimeError('Missing event_key primary key')
    if not any(kind == 'u' and names == ['broadcast_id'] for kind, names, *_ in constraints):
        raise RuntimeError('Missing unique broadcast_id')
    if not any(kind == 'f' and names == ['broadcast_id'] and ref in ('broadcasts', 'public.broadcasts')
               and delete == 'a' and target == ['id']
               for kind, names, ref, delete, target in constraints):
        raise RuntimeError('Missing/redefined broadcasts FK')


def migrate(connection, action):
    with connection:
        with connection.cursor() as cursor:
            cursor.execute('SHOW server_version_num')
            version = int(cursor.fetchone()[0])
            if not 160000 <= version < 170000:
                raise RuntimeError('This release is validated only for PostgreSQL 16')
            cursor.execute("SET LOCAL lock_timeout='5s'")
            cursor.execute("SET LOCAL statement_timeout='30s'")
            cursor.execute("SET LOCAL search_path=public,pg_catalog")
            if action != 'check':
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext('elashes:retouch_reminders:v1'))")
            cursor.execute("SELECT to_regclass('public.retouch_reminders') IS NOT NULL")
            exists = cursor.fetchone()[0]
            if action == 'upgrade' and not exists:
                cursor.execute((ROOT / 'up.sql').read_text(encoding='utf-8'))
            elif action == 'downgrade':
                if not exists:
                    return
                check(cursor)
                cursor.execute('LOCK TABLE public.retouch_reminders IN ACCESS EXCLUSIVE MODE')
                cursor.execute('SELECT EXISTS(SELECT 1 FROM public.retouch_reminders)')
                if cursor.fetchone()[0]:
                    raise RuntimeError('Receipts exist: keep table on rollback; downgrade would lose deduplication')
                cursor.execute((ROOT / 'down.sql').read_text(encoding='utf-8'))
                return
            check(cursor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['check', 'upgrade', 'downgrade'])
    args = parser.parse_args()
    url = os.environ.get('DATABASE_URL', '')
    if not url.startswith(('postgresql://', 'postgresql+psycopg2://')):
        parser.error('An explicit PostgreSQL DATABASE_URL is required; no default database')
    connection = psycopg2.connect(url.replace('postgresql+psycopg2://', 'postgresql://', 1))
    try:
        migrate(connection, args.action)
        print('retouch_reminders v1:', args.action, 'OK')
    finally:
        connection.close()


if __name__ == '__main__':
    main()
