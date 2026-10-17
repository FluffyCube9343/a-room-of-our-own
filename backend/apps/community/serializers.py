from urllib.parse import urlparse
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from apps.accounts.models import User, Profile, ProfilePrompt, ProfilePhoto
from apps.community.models import Tag
from apps.rooms.models import Room
from apps.projects.models import Project, ProjectInterest
from apps.connections.models import SavedProfile
from apps.safety.models import Report
from .services import mentor_score


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'slug', 'label']


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    display_name = serializers.CharField(max_length=80)

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate(self, data):
        try:
            validate_password(data['password'], User(email=data['email'], first_name=data['display_name']))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': exc.messages})
        return data


class PromptSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source='get_key_display', read_only=True)

    class Meta:
        model = ProfilePrompt
        fields = ['key', 'label', 'answer', 'order', 'visible']


class PhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProfilePhoto
        fields = ['id', 'url', 'caption', 'order']
        read_only_fields = ['id', 'url', 'order']

    def get_url(self, obj):
        return f'/api/v1/profile/photos/{obj.id}/image/'


class ProfileSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user_id', read_only=True)
    interests = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all(), required=False)
    skills = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all(), required=False)
    learning = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all(), required=False)
    prompts = PromptSerializer(many=True, required=False)
    reasons = serializers.SerializerMethodField()
    saved = serializers.SerializerMethodField()
    photos = PhotoSerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = ['id', 'display_name', 'pronouns', 'bio', 'university', 'role', 'goals', 'intent',
                  'discoverable', 'onboarding_complete', 'interests', 'skills', 'learning', 'prompts', 'reasons', 'saved',
                  'photos', 'resume_url', 'linkedin_url', 'github_url']

    def validate_resume_url(self, value):
        return https_url(value)

    def validate_linkedin_url(self, value):
        https_url(value)
        if value and (urlparse(value).hostname or '').lower() not in ['linkedin.com', 'www.linkedin.com']:
            raise serializers.ValidationError('Use a linkedin.com profile link.')
        return value

    def validate_github_url(self, value):
        https_url(value)
        if value and (urlparse(value).hostname or '').lower() not in ['github.com', 'www.github.com']:
            raise serializers.ValidationError('Use a github.com profile link.')
        return value

    def to_representation(self, obj):
        data = super().to_representation(obj)
        if obj.user_id != self.context['request'].user.id:
            data['prompts'] = [p for p in data['prompts'] if p['visible']]
        return data

    def get_reasons(self, obj):
        return mentor_score(self.context['request'].user.profile, obj)[1]

    def get_saved(self, obj):
        return SavedProfile.objects.filter(owner=self.context['request'].user, member_id=obj.user_id).exists()

    def validate_prompts(self, value):
        if len({p['key'] for p in value}) != len(value):
            raise serializers.ValidationError('Choose each prompt only once.')
        if sum(p.get('visible', True) for p in value) > 3:
            raise serializers.ValidationError('Choose up to three prompts to show on your profile.')
        if len(value) > 18:
            raise serializers.ValidationError('Too many prompts.')
        return value

    def validate(self, data):
        if data.get('onboarding_complete', False):
            if not data.get('interests', list(self.instance.interests.all())):
                raise serializers.ValidationError({'interests': 'Choose at least one interest.'})
            if not data.get('role', self.instance.role).strip():
                raise serializers.ValidationError({'role': 'Add your academic year or role.'})
            if not data.get('goals', self.instance.goals).strip():
                raise serializers.ValidationError({'goals': 'Tell us what you hope to find.'})
        return data

    @transaction.atomic
    def update(self, instance, validated_data):
        prompts = validated_data.pop('prompts', None)
        instance = super().update(instance, validated_data)
        if prompts is not None:
            instance.prompts.all().delete()
            ProfilePrompt.objects.bulk_create([ProfilePrompt(profile=instance, **p) for p in prompts])
        return instance


def author(user):
    return {'id': user.id, 'display_name': user.profile.display_name, 'role': user.profile.role}


def https_url(value):
    if value and urlparse(value).scheme != 'https':
        raise serializers.ValidationError('Use a secure URL beginning with https://.')
    return value


class RoomSerializer(serializers.ModelSerializer):
    host = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())
    rsvp_status = serializers.SerializerMethodField()
    attendee_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    meeting_url = serializers.URLField(max_length=500, write_only=True)

    class Meta:
        model = Room
        fields = ['id', 'host', 'title', 'description', 'format', 'tags', 'starts_at', 'ends_at',
                  'meeting_url', 'status', 'rsvp_status', 'attendee_count', 'is_owner']

    def get_host(self, obj):
        return author(obj.host)

    def get_rsvp_status(self, obj):
        return next((r.status for r in obj.rsvps.all() if r.user_id == self.context['request'].user.id), None)

    def get_attendee_count(self, obj):
        return sum(r.status == 'going' for r in obj.rsvps.all())

    def get_is_owner(self, obj):
        return obj.host_id == self.context['request'].user.id

    def validate_meeting_url(self, value):
        return https_url(value)

    def validate(self, data):
        start = data.get('starts_at', getattr(self.instance, 'starts_at', None))
        end = data.get('ends_at', getattr(self.instance, 'ends_at', None))
        if start and end and end <= start:
            raise serializers.ValidationError({'ends_at': 'End time must be after the start time.'})
        if ('starts_at' in data or not self.instance) and start <= timezone.now():
            raise serializers.ValidationError({'starts_at': 'Choose a start time in the future.'})
        return data

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Meeting links are never emitted by list/home serializers.
        if self.context.get('detail'):
            if data['is_owner'] or (data['rsvp_status'] == 'going' and obj.status == 'scheduled' and obj.ends_at > timezone.now()):
                data['meeting_url'] = obj.meeting_url
        return data


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.SerializerMethodField()
    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())
    needed_skills = serializers.PrimaryKeyRelatedField(many=True, queryset=Tag.objects.all())
    interest_status = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'owner', 'title', 'description', 'tags', 'needed_skills', 'repository_url', 'status', 'interest_status', 'is_owner']

    def get_owner(self, obj):
        return author(obj.owner)

    def get_interest_status(self, obj):
        return next((r.status for r in obj.requests.all() if r.requester_id == self.context['request'].user.id), None)

    def get_is_owner(self, obj):
        return obj.owner_id == self.context['request'].user.id

    def validate_repository_url(self, value):
        return https_url(value)


class InterestSerializer(serializers.ModelSerializer):
    requester = serializers.SerializerMethodField()

    class Meta:
        model = ProjectInterest
        fields = ['requester', 'introduction', 'status', 'updated_at']

    def get_requester(self, obj):
        return author(obj.requester)


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['member', 'room', 'project', 'category', 'details']

    def validate(self, data):
        if sum(data.get(key) is not None for key in ['member', 'room', 'project']) != 1:
            raise serializers.ValidationError('Choose exactly one report target.')
        return data
