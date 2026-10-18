from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Room(models.Model):
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='rooms')
    title = models.CharField(max_length=140)
    description = models.TextField(max_length=4000)
    format = models.CharField(max_length=20, choices=[('conversation', 'Conversation'), ('workshop', 'Workshop'), ('panel', 'Panel'), ('coworking', 'Co-working'), ('chatroom', 'Topic chatroom')], default='conversation')
    tags = models.ManyToManyField('community.Tag', blank=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    meeting_url = models.URLField(max_length=500, blank=True)
    physical_location = models.CharField(max_length=500, blank=True)
    cover_image = models.ImageField(upload_to='room-covers/', blank=True)
    cover_credit = models.CharField(max_length=1000, blank=True)
    status = models.CharField(max_length=12, choices=[('scheduled', 'Scheduled'), ('cancelled', 'Cancelled')], default='scheduled')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['starts_at', 'id']
        constraints = [models.CheckConstraint(
            condition=Q(format='chatroom', starts_at__isnull=True, ends_at__isnull=True) |
                (~Q(format='chatroom') & Q(starts_at__isnull=False, ends_at__isnull=False, ends_at__gt=F('starts_at'))),
            name='room_valid_schedule')]

    def __str__(self):
        return self.title


class RSVP(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='rsvps')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=12, choices=[('going', 'Going'), ('cancelled', 'Cancelled'), ('removed', 'Removed')], default='going')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['room', 'user'], name='unique_room_rsvp')]


class RoomMessage(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField(max_length=2000)
    reply_to = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']


class RoomCollaborator(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='collaborations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    status = models.CharField(max_length=12, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined')], default='pending')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['room', 'user'], name='unique_room_collaborator')]
