from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Room(models.Model):
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rooms')
    title = models.CharField(max_length=140)
    description = models.TextField(max_length=4000)
    format = models.CharField(max_length=20, choices=[('conversation', 'Conversation'), ('workshop', 'Workshop'), ('panel', 'Panel'), ('coworking', 'Co-working')], default='conversation')
    tags = models.ManyToManyField('community.Tag', blank=True)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    meeting_url = models.URLField(max_length=500)
    status = models.CharField(max_length=12, choices=[('scheduled', 'Scheduled'), ('cancelled', 'Cancelled')], default='scheduled')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['starts_at', 'id']
        constraints = [models.CheckConstraint(condition=Q(ends_at__gt=F('starts_at')), name='room_ends_after_start')]

    def __str__(self):
        return self.title


class RSVP(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='rsvps')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=12, choices=[('going', 'Going'), ('cancelled', 'Cancelled'), ('removed', 'Removed')], default='going')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['room', 'user'], name='unique_room_rsvp')]
