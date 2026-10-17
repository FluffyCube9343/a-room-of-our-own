from django.conf import settings
from django.db import models
from django.db.models import Q, F


class Block(models.Model):
    blocker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocks')
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['blocker', 'blocked'], name='unique_block'),
                       models.CheckConstraint(condition=~Q(blocker=F('blocked')), name='no_self_block')]


class Report(models.Model):
    reporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submitted_reports')
    member = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    room = models.ForeignKey('rooms.Room', on_delete=models.CASCADE, null=True, blank=True)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, null=True, blank=True)
    category = models.CharField(max_length=30, choices=[('harassment', 'Harassment'), ('spam', 'Spam'), ('inappropriate', 'Inappropriate content'), ('other', 'Other concern')])
    details = models.TextField(max_length=2000, blank=True)
    status = models.CharField(max_length=12, choices=[('open', 'Open'), ('reviewed', 'Reviewed'), ('resolved', 'Resolved')], default='open')
    staff_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=(
            Q(member__isnull=False, room__isnull=True, project__isnull=True) |
            Q(member__isnull=True, room__isnull=False, project__isnull=True) |
            Q(member__isnull=True, room__isnull=True, project__isnull=False)), name='report_exactly_one_target')]
