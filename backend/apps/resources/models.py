from django.conf import settings
from django.db import models
from django.db.models import F, Q


class Resource(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shared_resources')
    title = models.CharField(max_length=140)
    description = models.TextField(max_length=3000)
    category = models.CharField(max_length=20, choices=[('electronics', 'Electronics'), ('tools', 'Tools'), ('computing', 'Computing'), ('materials', 'Materials'), ('other', 'Other')])
    sharing = models.CharField(max_length=10, choices=[('loan', 'Borrow & return'), ('give', 'Free to keep')], default='loan')
    condition = models.CharField(max_length=80)
    location = models.CharField(max_length=120, help_text='General pickup area; coordinate exact details privately.')
    status = models.CharField(max_length=12, choices=[('available', 'Available'), ('paused', 'Paused'), ('given', 'Given away')], default='available')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']

    def __str__(self):
        return self.title


class BorrowRequest(models.Model):
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name='requests')
    borrower = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='borrow_requests')
    project = models.ForeignKey('projects.Project', on_delete=models.SET_NULL, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    note = models.CharField(max_length=1000, blank=True)
    owner_note = models.CharField(max_length=1000, blank=True)
    status = models.CharField(max_length=12, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('declined', 'Declined'), ('cancelled', 'Cancelled'), ('returned', 'Returned'), ('collected', 'Collected')], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
        constraints = [models.CheckConstraint(condition=Q(end_date__gte=F('start_date')), name='borrow_dates_ordered'),
            models.UniqueConstraint(fields=['resource', 'borrower'], condition=Q(status__in=['pending', 'approved']), name='one_active_borrow_request')]
