import json
from pathlib import Path
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import ProfilePhoto, User
from apps.projects.models import Project
from apps.rooms.images import clean_cover


class Command(BaseCommand):
    help = 'Add bundled stock photos to fictional demo profiles/projects and fill missing room covers. Preserve uploads.'

    def add_arguments(self, parser):
        parser.add_argument('--refresh-project-covers', action='store_true', help='Replace bundled demo project covers; preserve user uploads.')

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo photos are only available with DJANGO_DEBUG=1.')
        assets = Path(settings.BASE_DIR) / 'assets'
        portraits = json.loads((assets / 'demo-portraits' / 'credits.json').read_text(encoding='utf-8'))
        people_count = 0
        for name in portraits:
            user = User.objects.get(email=f'{name}@room.demo')
            if user.profile.photos.exists():
                continue
            photo = ProfilePhoto(profile=user.profile, order=0)
            photo.image.save(f'demo-{name}.jpg', ContentFile((assets / 'demo-portraits' / f'{name}.jpg').read_bytes()))
            people_count += 1
        activity_credits = json.loads((assets / 'demo-activities' / 'credits.json').read_text(encoding='utf-8'))
        activity_count = 0
        for name, credit in activity_credits.items():
            user = User.objects.get(email=f'{name}@room.demo')
            if user.profile.photos.count() >= 2:
                continue
            photo = ProfilePhoto(profile=user.profile, order=1,
                                 caption=credit['caption'])
            photo.image.save(f'demo-activity-{name}.jpg', ContentFile((assets / 'demo-activities' / f'{name}.jpg').read_bytes()))
            activity_count += 1
        covers = {
            'A more accessible campus': 'accessibility',
            'The little wellness check-in': 'wellness',
            'Decode the internship search': 'internships',
            'Safer spaces online': 'security',
            'Data for a greener tomorrow': 'sustainability',
            'Ideas after office hours': 'ideas',
        }
        credits = json.loads((assets / 'project-covers' / 'credits.json').read_text(encoding='utf-8'))
        room_credits = json.loads((assets / 'room-covers' / 'credits.json').read_text(encoding='utf-8'))
        bundled_sources = [credit['source'] for credit in [*credits.values(), *room_credits.values()]]
        project_count = 0
        for title, key in covers.items():
            project = Project.objects.get(title=title, owner__email__endswith='@room.demo')
            bundled = any(f'Source: {source}' in project.cover_credit for source in bundled_sources)
            if project.cover_image and not (options['refresh_project_covers'] and bundled):
                continue
            image = clean_cover(ContentFile((assets / 'project-covers' / f'{key}.jpg').read_bytes(), name=f'{key}.jpg'))
            source = credits[key]
            project.cover_image.save(image.name, image, save=False)
            project.cover_credit = f"{source['credit']} · {source['license']} · {source['license_url']} · Source: {source['source']} · Resized and cropped."
            project.save(update_fields=['cover_image', 'cover_credit'])
            project_count += 1
        call_command('add_room_covers', stdout=self.stdout)
        self.stdout.write(self.style.SUCCESS(f'Added {people_count} demo portraits, {activity_count} UVA activity photos, and {project_count} project covers. Existing uploads preserved.'))
