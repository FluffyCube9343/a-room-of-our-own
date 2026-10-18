from django.conf import settings
from django.db import models


class Project(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=140)
    cover_image = models.ImageField(upload_to='project-covers/', blank=True)
    cover_credit = models.CharField(max_length=1000, blank=True)
    description = models.TextField(max_length=4000)
    tags = models.ManyToManyField('community.Tag', blank=True, related_name='projects')
    needed_skills = models.ManyToManyField('community.Tag', blank=True, related_name='projects_needing')
    repository_url = models.URLField(max_length=500, blank=True)
    is_hardware = models.BooleanField(default=False)
    status = models.CharField(max_length=12, choices=[('open', 'Open'), ('closed', 'Closed')], default='open')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', 'id']

    def __str__(self):
        return self.title


class ProjectInterest(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='requests')
    requester = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    introduction = models.TextField(max_length=1000, blank=True)
    status = models.CharField(max_length=12, choices=[('pending', 'Pending'), ('withdrawn', 'Withdrawn')], default='pending')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        constraints = [models.UniqueConstraint(fields=['project', 'requester'], name='unique_project_request')]
