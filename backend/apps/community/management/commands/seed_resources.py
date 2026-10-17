from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import User
from apps.resources.models import Resource


class Command(BaseCommand):
    help = 'Add fictional hardware-sharing listings without resetting other demo data.'

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo resources are only available in development.')
        owners = list(User.objects.filter(email__in=['priya@room.demo', 'zoe@room.demo', 'amara@room.demo']).order_by('id'))
        if not owners:
            raise CommandError('Run seed_demo first.')
        rows = [
            ('Arduino starter kit', 'electronics', 'loan', 'Works great · all parts included', 'Rice Hall area', 'An Uno board, breadboard, jumper wires, LEDs, and sensors. Perfect for trying a first hardware idea before buying a kit.'),
            ('Raspberry Pi 4 + power supply', 'computing', 'loan', 'Good · freshly reset', 'Engineering quad', 'A 4 GB Raspberry Pi with a case and power supply. Bring your own microSD card. Great for a small server or an accessibility prototype.'),
            ('Precision screwdriver set', 'tools', 'loan', 'Like new', 'Clemons Library area', 'A 32-piece precision toolkit for laptop repairs and little hardware projects. Let’s keep more devices in use.'),
            ('Spare breadboards & jumper wires', 'electronics', 'give', 'Unused extras', 'Rice Hall area', 'Leftover supplies from a workshop. Three breadboards and a bundle of jumper wires, free to a project that will use them. Shared as one bundle.'),
            ('USB-C hub with HDMI', 'computing', 'loan', 'Good · tested', 'Central Grounds', 'A handy hub for demos and presentations. HDMI, USB-A, and USB-C. Borrow it for your next project showcase.'),
            ('Prototype materials bundle', 'materials', 'give', 'Clean offcuts', 'Architecture school area', 'Foam board, cardboard, and acrylic offcuts for mockups. Give these leftovers another life. Take the whole bundle.'),
        ]
        for index, (title, category, sharing, condition, location, description) in enumerate(rows):
            Resource.objects.get_or_create(owner=owners[index % len(owners)], title=title,
                defaults={'category': category, 'sharing': sharing, 'condition': condition, 'location': location, 'description': description})
        self.stdout.write(self.style.SUCCESS('Six fictional sharing listings ready. No existing listings changed.'))
