from django.db import migrations


REPLACEMENTS = [
    (
        'maya@room.demo',
        'Campus inspiration: Students work on a capstone project · Photo: UVA Engineering',
        'UVA capstone projects',
    ),
    (
        'priya@room.demo',
        'Campus inspiration: A student holds a capstone project prototype · Photo: UVA Engineering',
        'UVA prototype showcase',
    ),
    (
        'zoe@room.demo',
        'Campus inspiration: Students present their capstone project · Photo: UVA Engineering',
        'UVA capstone showcase',
    ),
    (
        'amara@room.demo',
        'Campus inspiration: Kevin Coneway, left, holding panels in place to be attached, Hallie Huff, right, drilling a panel in place · Photo: University Communications / UVA Today',
        'Building at Morven',
    ),
    (
        'sofia@room.demo',
        'Campus inspiration: students posing in booth · Photo: University Communications / UVA Today',
        'First-day photos at UVA',
    ),
    (
        'lily@room.demo',
        'Campus inspiration: From above looking down upon architecture students Kevin Coneway, Sophie Dolan and Hallie Huff constructing a wooden frame · Photo: University Communications / UVA Today',
        'Architecture at Morven',
    ),
    (
        'nadia@room.demo',
        'Campus inspiration: Students seated on a picnic blanket in Darden Court · Photo: UVA Engineering',
        'Picnic at Darden Court',
    ),
    (
        'emma@room.demo',
        'Campus inspiration: Students seated at a picnic table · Photo: UVA Engineering',
        'A UVA picnic break',
    ),
    (
        'iris@room.demo',
        'Campus inspiration: Group of students use photobooth · Photo: University Communications / UVA Today',
        'UVA photobooth moments',
    ),
]


def shorten_demo_captions(apps, schema_editor):
    Photo = apps.get_model("accounts", "ProfilePhoto")
    for email, original, short in REPLACEMENTS:
        Photo.objects.using(schema_editor.connection.alias).filter(
            profile__user__email=email, caption=original,
        ).update(caption=short)


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_profile_academic_stage_profile_major_and_more")]
    operations = [migrations.RunPython(shorten_demo_captions)]
