import json
from pathlib import Path
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from apps.rooms.images import clean_cover
from apps.rooms.models import Room


class Command(BaseCommand):
    help = 'Add credited topic photos to rooms without covers, preserving uploaded covers.'

    def add_arguments(self, parser):
        parser.add_argument('--refresh-defaults', action='store_true', help='Reassign bundled defaults, preserving user uploads.')

    def handle(self, *args, **options):
        assets = Path(settings.BASE_DIR) / 'assets' / 'room-covers'
        credits = json.loads((assets / 'credits.json').read_text(encoding='utf-8'))
        count = 0
        photos = ['collaboration', 'coffee', 'study', 'technology', 'lab', 'data', 'vr', 'maker', 'mouse']
        used = set()
        for room in Room.objects.order_by('id').prefetch_related('tags'):
            if room.cover_image and not (options['refresh_defaults'] and 'Source: https://commons.wikimedia.org/' in room.cover_credit):
                used.update(photo for photo in photos if credits[photo]['source'] in room.cover_credit)
                continue
            words = (room.title + ' ' + ' '.join(t.label for t in room.tags.all())).lower()
            key = 'collaboration'
            if any(word in words for word in ['coffee', 'company', 'cowork']):
                key = 'coffee'
            elif 'women' in words or 'building with ai' in words:
                key = 'collaboration'
            elif 'portfolio' in words:
                key = 'lab'
            elif 'cyber' in words:
                key = 'technology'
            elif 'browser' in words:
                key = 'mouse'
            elif any(word in words for word in ['design', 'accessib']):
                key = 'vr'
            elif 'small ideas' in words:
                key = 'maker'
            elif 'learn' in words:
                key = 'study'
            elif any(word in words for word in ['news', 'tech', 'data']):
                key = 'data'
            if key in used:
                key = next((photo for photo in photos if photo not in used), photos[(room.id - 1) % len(photos)])
            used.add(key)
            source = credits[key]
            image = clean_cover(ContentFile((assets / f'{key}.jpg').read_bytes(), name=f'{key}.jpg'))
            room.cover_image.save(image.name, image, save=False)
            room.cover_credit = f"{source['credit']} · {source['license']} · {source['license_url']} · Source: {source['source']} · Resized and cropped for display."
            room.save(update_fields=['cover_image', 'cover_credit'])
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Added covers to {count} rooms. Existing covers preserved.'))
