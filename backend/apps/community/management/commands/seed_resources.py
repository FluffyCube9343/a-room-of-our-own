from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import User
from apps.resources.models import Resource, BorrowEvent

# Discrete parts, not aggregate kits: future features (compatibility matching,
# inventory math) need one listing per real part. Only consumable bundles
# (wire, resistors, breadboards) stay bundled, per the project owner.
ROWS = [
    # Microcontroller boards
    ('Arduino Uno R3', 'electronics', 'loan', 'Works great · headers intact', 'Rice Hall area',
     'The classic ATmega328P board for a first hardware build. USB-B cable included.'),
    ('Arduino Uno R4 WiFi', 'electronics', 'loan', 'Like new · bought this semester', 'Thornton Hall area',
     'Newer Renesas-based Uno with WiFi and the LED matrix. Good when your project needs to talk to the internet.'),
    ('Arduino Nano Every', 'electronics', 'loan', 'Good · a few solder marks', 'Olsson Hall area',
     'Breadboard-friendly little Arduino. Great when an Uno is too bulky for the enclosure.'),
    ('Arduino Mega 2560', 'electronics', 'loan', 'Works great', 'Engineering quad',
     '54 digital pins and 4 serial ports for bigger builds: robots, LED walls, multi-sensor rigs.'),
    ('STM32 Blue Pill (STM32F103C8T6)', 'electronics', 'loan', 'Good · headers soldered', 'Clemons Library area',
     '72 MHz ARM Cortex-M3 board. Needs an ST-Link or USB-serial adapter to flash; happy to lend one too.'),
    ('STM32 Nucleo-F446RE', 'electronics', 'loan', 'Like new · st-link onboard', 'Thornton Hall area',
     'ST\'s dev board with the debugger built in, so no extra hardware to flash it. Arduino-shaped headers.'),
    # Displays
    ('1602 LCD with I2C backpack', 'electronics', 'loan', 'Works · contrast adjusted', 'Rice Hall area',
     'Classic 16x2 character display, and the I2C backpack means only 4 wires. Perfect first output for sensor readings.'),
    ('0.96" SSD1306 OLED display', 'electronics', 'give', 'Unused · still in antistatic bag', 'Central Grounds',
     'Crisp little 128x64 I2C OLED. I have spares, so take one for your build.'),
    ('1.8" ST7735 TFT display', 'electronics', 'loan', 'Good', 'Alderman Library area',
     'Color 128x160 SPI display. Nice step up from the 1602 when you want graphics or gauges.'),
    ('2.4" ILI9341 TFT touchscreen', 'electronics', 'loan', 'Works · light scratches', 'Engineering quad',
     'Color 320x240 touch display for control panels and handheld projects. SPI, libraries are easy to find.'),
    # Sensors
    ('DHT22 temperature & humidity sensor', 'electronics', 'loan', 'Works · reading verified', 'Rice Hall area',
     'Reliable temp and humidity for environmental or comfort projects. Slow but steady.'),
    ('DS18B20 waterproof temperature probe', 'electronics', 'loan', 'Like new', 'Chemistry building area',
     'Sealed probe version of the classic 1-wire temp sensor. Good for liquids, soil, or anything damp.'),
    ('MAX6675 thermocouple module + K-type probe', 'electronics', 'loan', 'Works · tested to 400 C', 'Thornton Hall area',
     'For hot things a DHT22 cannot touch: soldering stations, kilns, engines. Reads up to about 1024 C.'),
    ('MLX90614 infrared temperature sensor', 'electronics', 'loan', 'Good', 'Engineering quad',
     'Non-contact temp readings over I2C. Point it at a motor or a hand and get a number.'),
    ('HC-SR04 ultrasonic distance sensor', 'electronics', 'give', 'Working pulls from old projects', 'Rice Hall area',
     'The classic 2 cm to 4 m distance sensor. I have several, take one.'),
    ('HC-SR501 PIR motion sensor', 'electronics', 'loan', 'Works · both pots adjustable', 'New Cabell area',
     'Detects people moving, great for presence-activated lamps, alarms, or pranks.'),
    ('MPU6050 gyro + accelerometer', 'electronics', 'loan', 'Good · headers soldered', 'Clemons Library area',
     '6-axis IMU over I2C for balance bots, gesture input, and tilt sensing.'),
    ('Illuminated RGB rotary encoder', 'electronics', 'give', 'Unused · clear shaft', 'Central Grounds',
     'Rotary encoder with a click button and a light-up RGB shaft, the right input for menus and volume knobs with some glow. Spares available.'),
    ('BMP280 barometric pressure sensor', 'electronics', 'loan', 'Like new', 'Nau Hall area',
     'Pressure, altitude, and temperature. The weather-station sensor.'),
    ('SCD30 CO2 sensor', 'electronics', 'loan', 'Works · calibrated', 'Thornton Hall area',
     'Sensirion NDIR CO2 sensor with temperature and humidity onboard, over I2C. The right part for air-quality and room-ventilation projects.'),
    ('Photoresistor (LDR) light sensor', 'electronics', 'give', 'Unused · have a strip of them', 'Gilmer Hall area',
     'Light-dependent resistor for dusk-to-dawn lamps, light-following bots, and wearables. Analog, dirt simple, take a few.'),
    ('TCS3200 color sensor', 'electronics', 'loan', 'Works', 'Rice Hall area',
     'Detects RGB values of whatever you put in front of it. Sorting machines and light art.'),
    # Actuators
    ('SG90 micro servo', 'electronics', 'give', 'Working · a little jittery', 'Rice Hall area',
     'Tiny 9 g servo for latches, arms, and waving flags. I have extras.'),
    ('NEMA 17 stepper + A4988 driver', 'electronics', 'loan', 'Works great', 'Thornton Hall area',
     'Real torque for CNCs, plotters, and camera sliders. Driver included, set the current before you run it.'),
    # Consumable bundles (these make sense as bundles)
    ('Jumper wire kit (M-M, M-F, F-F)', 'electronics', 'give', 'Unused ribbon packs', 'Rice Hall area',
     'Three ribbons of dupont jumpers in every gender mix. Take what your breadboard needs.'),
    ('Resistor assortment kit (1/4 W, E12)', 'electronics', 'give', 'Labeled strips · most values full', 'Clemons Library area',
     'The standard 10 ohm to 1 Mohm spread on labeled tape. Take the values you need or the whole box.'),
    ('Breadboard 3-pack', 'electronics', 'give', 'Unused', 'Central Grounds',
     'Leftover 400-point breadboards from a workshop. Free to a project that will use them.'),
    # Computers
    ('Raspberry Pi 4 (4 GB) + power supply', 'computing', 'loan', 'Good · freshly reset', 'Engineering quad',
     'A 4 GB Raspberry Pi with a case and power supply. Bring your own microSD card. Great for a small server or an accessibility prototype.'),
    ('Raspberry Pi 5 (8 GB)', 'computing', 'loan', 'Like new · active cooler on', 'Thornton Hall area',
     'The fast one. Good for vision projects or anything that makes a Pi 4 sweat.'),
    ('Raspberry Pi Zero 2 W', 'computing', 'loan', 'Good · headers soldered', 'Clemons Library area',
     'Tiny WiFi-capable Pi for wearables and hidden builds. Runs a full Linux, sips power.'),
    ('USB-C hub with HDMI', 'computing', 'loan', 'Good · tested', 'Central Grounds',
     'A handy hub for demos and presentations. HDMI, USB-A, and USB-C. Borrow it for your next project showcase.'),
    # Tools
    ('Precision screwdriver set (32-piece)', 'tools', 'loan', 'Like new', 'Clemons Library area',
     'A 32-piece precision toolkit for laptop repairs and little hardware projects. Let\'s keep more devices in use.'),
    ('Digital multimeter', 'tools', 'loan', 'Works · fresh battery', 'Thornton Hall area',
     'Voltage, current, continuity, the works. The first tool to reach for when a circuit acts up.'),
    ('Temperature-controlled soldering iron', 'tools', 'loan', 'Good · extra tips included', 'Engineering quad',
     'Adjustable 60 W iron with a stand and a few tips. Return it with the tip tinned, please.'),
    # Materials
    ('Prototype materials bundle', 'materials', 'give', 'Clean offcuts', 'Architecture school area',
     'Foam board, cardboard, and acrylic offcuts for mockups. Give these leftovers another life. Take the whole bundle.'),
    ('PLA filament (half spool, gray)', 'materials', 'give', 'Dry · sealed with desiccant', 'Rice Hall area',
     'Half a spool of 1.75 mm gray PLA left from a finished print. Enough for many prototypes.'),
]


class Command(BaseCommand):
    help = 'Seed the parts catalog with discrete hardware listings. --reset replaces demo-owned listings.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true',
                            help='Delete all listings owned by @room.demo users (with their requests and events) before seeding. Other users\' listings are untouched.')

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo resources are only available in development (DJANGO_DEBUG=1).')
        owners = list(User.objects.filter(email__endswith='@room.demo', is_active=True).order_by('id'))
        if not owners:
            raise CommandError('Run seed_demo first.')
        if options['reset']:
            # Cascade clears the demo listings' borrow requests and events too.
            deleted, _ = Resource.objects.filter(owner__email__endswith='@room.demo').delete()
            self.stdout.write(f'Removed {deleted} old demo-owned rows.')
        created_count = 0
        for index, (title, category, sharing, condition, location, description) in enumerate(ROWS):
            owner = owners[index % len(owners)]
            resource, created = Resource.objects.get_or_create(owner=owner, title=title,
                defaults={'category': category, 'sharing': sharing, 'condition': condition,
                          'location': location, 'description': description})
            if created:
                created_count += 1
                BorrowEvent.objects.create(resource=resource, actor=owner, event_type='listed')
        self.stdout.write(self.style.SUCCESS(
            f'{len(ROWS)} catalog listings ready ({created_count} new). Existing non-demo listings untouched.'))
