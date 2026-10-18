from django.db import transaction, IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.community.services import visible_profiles, mentors, mentor_score, blocked_ids
from apps.community.serializers import ProfileSerializer, author
from apps.community.views import paginated
from .models import Connection, ConnectionMessage, DiscoveryPass


def accessible_connections(user):
    return Connection.objects.filter(Q(sender=user) | Q(recipient=user)).exclude(
        sender_id__in=blocked_ids(user)).exclude(recipient_id__in=blocked_ids(user)).filter(
        sender__is_active=True, recipient__is_active=True,
        sender__profile__discoverable=True, recipient__profile__discoverable=True
    ).select_related('sender__profile', 'recipient__profile', 'photo')


class ConnectionSerializer(serializers.ModelSerializer):
    member = serializers.SerializerMethodField()
    direction = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = Connection
        fields = ['id', 'member', 'direction', 'target', 'note', 'status', 'created_at']

    def get_member(self, obj):
        other = obj.recipient if obj.sender_id == self.context['request'].user.id else obj.sender
        return ProfileSerializer(other.profile, context=self.context).data

    def get_direction(self, obj):
        return 'outgoing' if obj.sender_id == self.context['request'].user.id else 'incoming'

    def get_target(self, obj):
        if obj.target_kind == 'prompt':
            prompt = obj.recipient.profile.prompts.filter(key=obj.prompt_key, visible=True).first()
            return {'kind': 'prompt', 'label': prompt.get_key_display() if prompt else 'A previous prompt',
                    'text': prompt.answer if prompt else 'This prompt is no longer on their profile.'}
        if obj.target_kind == 'photo':
            return {'kind': 'photo', 'label': 'A photo', 'text': obj.photo.caption if obj.photo else 'This photo was removed.',
                    'url': f'/api/v1/profile/photos/{obj.photo_id}/image/' if obj.photo else None}
        return {'kind': 'profile', 'label': 'Your profile', 'text': ''}


class DiscoverView(APIView):
    def get(self, request):
        search = request.query_params.get('q', '').strip()[:140]
        if search:
            candidates = visible_profiles(request.user).filter(
                Q(display_name__icontains=search) | Q(role__icontains=search) |
                Q(bio__icontains=search) | Q(university__icontains=search) |
                Q(interests__label__icontains=search) | Q(skills__label__icontains=search)
            ).distinct().order_by('display_name', 'user_id')
            return paginated(request, candidates, ProfileSerializer)
        feed = request.query_params.get('feed', 'discover')
        if feed not in ['discover', 'recommended']:
            raise ValidationError('Choose discover or recommended.')
        passed = set(DiscoveryPass.objects.filter(owner=request.user).values_list('member_id', flat=True))
        pairs = Connection.objects.filter(Q(sender=request.user) | Q(recipient=request.user)).values_list('sender_id', 'recipient_id')
        handled = {uid for pair in pairs for uid in pair}
        candidates = [p for p in mentors(request.user) if p.user_id not in passed | handled]
        if feed == 'recommended':
            candidates = [p for p in candidates if any(mentor_score(request.user.profile, p)[0])][:6]
        return paginated(request, candidates, ProfileSerializer)


class PassView(APIView):
    def put(self, request, pk):
        profile = get_object_or_404(visible_profiles(request.user), user_id=pk)
        DiscoveryPass.objects.get_or_create(owner=request.user, member=profile.user)
        return Response({'passed': True})


class ResetPasses(APIView):
    def delete(self, request):
        DiscoveryPass.objects.filter(owner=request.user).delete()
        return Response(status=204)


class ConnectionRequestInput(serializers.Serializer):
    member = serializers.IntegerField(min_value=1)
    target_kind = serializers.ChoiceField(choices=['profile', 'prompt', 'photo'])
    prompt_key = serializers.CharField(max_length=30, required=False, default='')
    photo = serializers.IntegerField(min_value=1, required=False)
    note = serializers.CharField(max_length=500, allow_blank=True, required=False, default='')


class ConnectionsView(APIView):
    def get(self, request):
        tab = request.query_params.get('tab', 'incoming')
        qs = accessible_connections(request.user)
        if tab == 'incoming':
            qs = qs.filter(recipient=request.user, status='pending')
        elif tab == 'sent':
            qs = qs.filter(sender=request.user, status='pending')
        elif tab == 'matches':
            qs = qs.filter(status='accepted')
        else:
            raise ValidationError('Choose incoming, sent, or matches.')
        return paginated(request, qs, ConnectionSerializer)

    @transaction.atomic
    def post(self, request):
        serializer = ConnectionRequestInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        profile = get_object_or_404(visible_profiles(request.user), user_id=data['member'])
        photo = None
        if data['target_kind'] == 'prompt':
            get_object_or_404(profile.prompts.filter(visible=True), key=data['prompt_key'])
        elif data['target_kind'] == 'photo':
            photo = get_object_or_404(profile.photos, pk=data.get('photo'))
        pair = ':'.join(map(str, sorted([request.user.id, profile.user_id])))
        # get_or_create plus the unique pair constraint also handles simultaneous connection requests.
        connection, created = Connection.objects.get_or_create(pair_key=pair, defaults={
            'sender': request.user, 'recipient': profile.user, 'target_kind': data['target_kind'],
            'prompt_key': data['prompt_key'] if data['target_kind'] == 'prompt' else '',
            'photo': photo, 'note': data['note']})
        if not created:
            if connection.status in ['declined', 'ended']:
                raise ValidationError('This connection is no longer available.')
            if connection.sender_id != request.user.id and connection.status == 'pending':
                connection.status = 'accepted'
                connection.save(update_fields=['status'])
        return Response(ConnectionSerializer(connection, context={'request': request}).data, status=201 if created else 200)


class ConnectionDetail(APIView):
    def get(self, request, pk):
        connection = get_object_or_404(accessible_connections(request.user), pk=pk, status__in=['pending', 'accepted'])
        return Response(ConnectionSerializer(connection, context={'request': request}).data)

    @transaction.atomic
    def patch(self, request, pk):
        connection = get_object_or_404(accessible_connections(request.user).select_for_update(of=("self",)), pk=pk)
        action = request.data.get('action')
        if action in ['accept', 'decline']:
            if connection.recipient_id != request.user.id:
                raise PermissionDenied('Only the recipient can respond to this connection request.')
            if connection.status != 'pending':
                raise ValidationError('This connection request has already been answered.')
            connection.status = 'accepted' if action == 'accept' else 'declined'
        elif action == 'end' and connection.status in ['pending', 'accepted']:
            connection.status = 'ended'
        else:
            raise ValidationError('Choose an available action: accept, decline, or end.')
        connection.save(update_fields=['status'])
        return Response({'status': connection.status})


class MessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()

    class Meta:
        model = ConnectionMessage
        fields = ['id', 'sender', 'body', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_sender(self, obj):
        return author(obj.sender)


class MessagesView(APIView):
    def get(self, request, pk):
        connection = get_object_or_404(accessible_connections(request.user), pk=pk, status='accepted')
        return paginated(request, connection.messages.select_related('sender__profile'), MessageSerializer)

    def post(self, request, pk):
        connection = get_object_or_404(accessible_connections(request.user), pk=pk, status='accepted')
        serializer = MessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(connection=connection, sender=request.user)
        return Response(serializer.data, status=201)
