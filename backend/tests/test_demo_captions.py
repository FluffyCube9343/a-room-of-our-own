from importlib import import_module
from types import SimpleNamespace
from django.apps import apps
from django.db import connection
from django.test import TestCase
from apps.accounts.models import User, ProfilePhoto


class DemoCaptionMigrationTests(TestCase):
    def test_only_unchanged_demo_captions_are_shortened(self):
        migration = import_module('apps.accounts.migrations.0004_shorten_demo_photo_captions')
        email, original, short = migration.REPLACEMENTS[0]
        demo = User.objects.create_user(email, 'Test!2026')
        member = User.objects.create_user('member@example.com', 'Test!2026')
        default = ProfilePhoto.objects.create(profile=demo.profile, image='demo.jpg', caption=original)
        edited = ProfilePhoto.objects.create(profile=demo.profile, image='edited.jpg', caption='My own caption')
        personal = ProfilePhoto.objects.create(profile=member.profile, image='personal.jpg', caption=original)
        editor = SimpleNamespace(connection=connection)
        migration.shorten_demo_captions(apps, editor)
        migration.shorten_demo_captions(apps, editor)
        default.refresh_from_db()
        edited.refresh_from_db()
        personal.refresh_from_db()
        self.assertEqual(default.caption, short)
        self.assertEqual(edited.caption, 'My own caption')
        self.assertEqual(personal.caption, original)
