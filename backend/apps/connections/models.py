from django.conf import settings
from django.db import models
from django.db.models import Q, F


class SavedProfile(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_profiles')
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='saved_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'member'], name='unique_saved_profile'),
                       models.CheckConstraint(condition=~Q(owner=F('member')), name='no_self_save')]


class Connection(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_connections')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_connections')
    # A canonical pair permits only one request/connection between two people.
    pair_key = models.CharField(max_length=50, unique=True)
    target_kind = models.CharField(max_length=10, choices=[('profile', 'Profile'), ('prompt', 'Prompt'), ('photo', 'Photo')])
    prompt_key = models.CharField(max_length=30, blank=True)
    photo = models.ForeignKey('accounts.ProfilePhoto', on_delete=models.SET_NULL, null=True, blank=True)
    note = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=12, choices=[('pending', 'Pending'), ('accepted', 'Accepted'), ('declined', 'Declined'), ('ended', 'Ended')], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.CheckConstraint(condition=~Q(sender=F('recipient')), name='no_self_connection')]


class ConnectionMessage(models.Model):
    connection = models.ForeignKey(Connection, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']


class DiscoveryPass(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='discovery_passes')
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner', 'member'], name='unique_discovery_pass')]
