import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

# Plain CreateModel only: Tiger Data setup lives in manage.py setup_tiger so
# migrate always succeeds as standard Postgres, on any host.
class Migration(migrations.Migration):

    dependencies = [
        ('resources', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='BorrowEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('event_type', models.CharField(choices=[('listed', 'Listed'), ('requested', 'Requested'), ('approved', 'Approved'), ('returned', 'Returned'), ('collected', 'Collected')], max_length=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
                ('resource', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to='resources.resource')),
            ],
            options={'ordering': ['-created_at', '-id']},
        )
    ]
