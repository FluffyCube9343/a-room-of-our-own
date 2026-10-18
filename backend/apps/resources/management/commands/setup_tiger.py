from django.core.management.base import BaseCommand
from django.db import connection

from apps.resources.tiger import TigerSetupError, setup_tiger


class Command(BaseCommand):
    help = 'Enable Tiger Data features (hypertable + continuous aggregate) when the database has TimescaleDB.'

    def handle(self, *args, **options):
        try:
            steps = setup_tiger(connection)
        except TigerSetupError as exc:
            # Print the real SQL error so it can be pasted back for fixing.
            self.stderr.write(self.style.ERROR(f'Tiger setup failed at step -> {exc}'))
            raise SystemExit(1)
        if not steps:
            self.stdout.write('Tiger Data not found on this database; nothing to do (plain Postgres or SQLite is fine).')
            return
        for step in steps:
            self.stdout.write(self.style.SUCCESS(f'Done: {step}'))
