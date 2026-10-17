from django.db import models


class Tag(models.Model):
    slug = models.SlugField(unique=True)
    label = models.CharField(max_length=60)

    class Meta:
        ordering = ['label']

    def __str__(self):
        return self.label
