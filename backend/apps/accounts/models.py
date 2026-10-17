from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models.functions import Lower
from .prompts import PROMPT_CHOICES


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required.')
        user = self.model(email=email.strip().lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        Profile.objects.get_or_create(user=user, defaults={'display_name': email.split('@')[0]})
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.update(is_staff=True, is_superuser=True, is_active=True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    objects = UserManager()

    class Meta:
        constraints = [models.UniqueConstraint(Lower('email'), name='unique_lower_email')]


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    display_name = models.CharField(max_length=80)
    pronouns = models.CharField(max_length=40, blank=True)
    bio = models.TextField(max_length=1200, blank=True)
    university = models.CharField(max_length=120, default='University of Virginia')
    role = models.CharField(max_length=120, blank=True)
    goals = models.TextField(max_length=1000, blank=True)
    intent = models.CharField(max_length=12, choices=[('learn', 'Find a mentor'), ('mentor', 'Be a mentor'), ('both', 'Both')], default='learn')
    discoverable = models.BooleanField(default=True)
    onboarding_complete = models.BooleanField(default=False)
    interests = models.ManyToManyField('community.Tag', blank=True, related_name='interested_profiles')
    skills = models.ManyToManyField('community.Tag', blank=True, related_name='skilled_profiles')
    learning = models.ManyToManyField('community.Tag', blank=True, related_name='learning_profiles')
    resume_url = models.URLField(max_length=500, blank=True)
    linkedin_url = models.URLField(max_length=500, blank=True)
    github_url = models.URLField(max_length=500, blank=True)

    def __str__(self):
        return self.display_name


class ProfilePrompt(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='prompts')
    key = models.CharField(max_length=30, choices=PROMPT_CHOICES)
    answer = models.TextField(max_length=600)
    order = models.PositiveSmallIntegerField(default=0)
    visible = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']
        constraints = [models.UniqueConstraint(fields=['profile', 'key'], name='unique_profile_prompt')]


class ProfilePhoto(models.Model):
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='photos')
    image = models.ImageField(upload_to='profile-photos/')
    caption = models.CharField(max_length=240, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'id']


# Files remain private and are removed after a successful database deletion.
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction


@receiver(post_delete, sender=ProfilePhoto)
def delete_photo_file(sender, instance, **kwargs):
    storage, name = instance.image.storage, instance.image.name
    if name:
        transaction.on_commit(lambda: storage.delete(name))
