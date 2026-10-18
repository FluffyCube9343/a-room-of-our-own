import re
from difflib import SequenceMatcher
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.community.services import visible_rooms, blocked_ids
from apps.community.serializers import RoomSerializer, author
from apps.community.views import paginated
from .models import RSVP, RoomMessage, RoomCollaborator


class SimilarRooms(APIView):
    def get(self, request):
        title = request.query_params.get('title', '').strip().lower()[:140]
        tags = {int(t) for t in request.query_params.get('tags', '').split(',') if t.isdigit()}
        if len(title) < 3 and not tags:
            return Response({'results': []})
        words = set(re.findall(r'\w+', title)) - {'a', 'the', 'room', 'for', 'and', 'of', 'in'}
        candidates = visible_rooms(request.user).filter(Q(format='chatroom') | Q(ends_at__gt=timezone.now()), status='scheduled')
        ranked = []
        for room in candidates:
            overlap = len(tags & {t.id for t in room.tags.all()})
            title_words = set(re.findall(r'\w+', room.title.lower()))
            common = len(words & title_words)
            ratio = SequenceMatcher(None, title, room.title.lower()).ratio() if title else 0
            if overlap or common or ratio >= .65:
                ranked.append((overlap + common + ratio, room))
        ranked.sort(key=lambda item: (-item[0], item[1].id))
        return Response({'results': RoomSerializer([r for _, r in ranked[:5]], many=True, context={'request': request}).data})


class RoomCover(APIView):
    def get(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk)
        if not room.cover_image:
            raise Http404
        try:
            response = FileResponse(room.cover_image.open('rb'), content_type='image/jpeg')
        except FileNotFoundError:
            raise Http404
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class MessageInput(serializers.Serializer):
    body = serializers.CharField(max_length=2000, trim_whitespace=True)
    reply_to_id = serializers.IntegerField(required=False, allow_null=True)


class RoomMessages(APIView):
    def room(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk, format='chatroom')
        if room.status != 'scheduled':
            raise PermissionDenied('This chatroom is closed.')
        if room.rsvps.filter(user=request.user, status='removed').exists():
            raise PermissionDenied('The host removed your access to this room.')
        if room.host_id != request.user.id and not room.rsvps.filter(user=request.user, status='going').exists() and not room.collaborations.filter(user=request.user, status='approved').exists():
            raise PermissionDenied('Join this chatroom to read and send messages.')
        return room

    def get(self, request, pk):
        room = self.room(request, pk)
        rows = room.messages.exclude(sender_id__in=blocked_ids(request.user)).filter(sender__is_active=True).select_related('sender__profile')
        before = request.query_params.get('before')
        after = request.query_params.get('after')
        ids = request.query_params.get('ids')
        if ids is not None:
            values = ids.split(',')
            if len(values) > 100 or not all(v.isdigit() for v in values):
                raise ValidationError('Supply up to 100 message IDs.')
            return Response({'results': RoomMessageSerializer(rows.filter(id__in=values), many=True, context={'request': request}).data})
        if after:
            if not after.isdigit() or before:
                raise ValidationError('Use one numeric message cursor.')
            rows = rows.filter(id__gt=int(after)).order_by('id')
        if before:
            if not before.isdigit():
                raise ValidationError('Use a numeric message cursor.')
            rows = rows.filter(id__lt=int(before))
        return paginated(request, rows, RoomMessageSerializer)

    @transaction.atomic
    def post(self, request, pk):
        room = self.room(request, pk)
        data = MessageInput(data=request.data)
        data.is_valid(raise_exception=True)
        reply_id = data.validated_data.get('reply_to_id')
        if reply_id:
            get_object_or_404(room.messages.exclude(sender_id__in=blocked_ids(request.user)), id=reply_id, deleted_at__isnull=True, sender__is_active=True)
        message = RoomMessage.objects.create(room=room, sender=request.user, **data.validated_data)
        return Response(RoomMessageSerializer(message, context={'request': request}).data, status=201)


class RoomMessageSerializer(serializers.ModelSerializer):
    sender = serializers.SerializerMethodField()
    reply = serializers.SerializerMethodField()

    class Meta:
        model = RoomMessage
        fields = ['id', 'sender', 'body', 'created_at', 'edited_at', 'deleted_at', 'reply']

    def get_sender(self, obj):
        return author(obj.sender)

    def get_reply(self, obj):
        reply = obj.reply_to
        request = self.context.get('request')
        if not reply or reply.deleted_at or not reply.sender.is_active:
            return None
        if request and reply.sender_id in blocked_ids(request.user):
            return None
        return {'id': reply.id, 'sender': author(reply.sender), 'body': reply.body[:240]}


class RoomMessageDetail(RoomMessages):
    http_method_names = ['patch', 'delete', 'options']

    def patch(self, request, pk, message_id):
        room = self.room(request, pk)
        message = get_object_or_404(room.messages, pk=message_id, sender=request.user, deleted_at__isnull=True)
        data = MessageInput(data=request.data)
        data.is_valid(raise_exception=True)
        message.body = data.validated_data['body']
        message.edited_at = timezone.now()
        message.save(update_fields=['body', 'edited_at'])
        return Response(RoomMessageSerializer(message, context={'request': request}).data)

    def delete(self, request, pk, message_id):
        room = self.room(request, pk)
        message = get_object_or_404(room.messages, pk=message_id)
        if message.sender_id != request.user.id and room.host_id != request.user.id:
            raise PermissionDenied('Only the author or room host can delete this message.')
        message.body = ''
        message.deleted_at = timezone.now()
        message.save(update_fields=['body', 'deleted_at'])
        return Response(status=204)


class RoomMembers(RoomMessages):
    http_method_names = ['get', 'options']

    def get(self, request, pk):
        from apps.accounts.models import User
        room = self.room(request, pk)
        ids = {room.host_id} | set(room.rsvps.filter(status='going').values_list('user_id', flat=True)) | set(room.collaborations.filter(status='approved').values_list('user_id', flat=True))
        ids -= set(room.rsvps.filter(status='removed').values_list('user_id', flat=True))
        users = User.objects.filter(id__in=ids, is_active=True).exclude(id__in=blocked_ids(request.user)).select_related('profile').order_by('id')
        return paginated(request, [author(user) for user in users])


class Collaborators(APIView):
    def get(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk)
        if room.host_id != request.user.id:
            raise PermissionDenied('Only the host can review requests.')
        rows = room.collaborations.exclude(user_id__in=blocked_ids(request.user)).filter(user__is_active=True).select_related('user__profile').order_by('id')
        return paginated(request, [{'user': author(row.user), 'status': row.status} for row in rows])

    def post(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk)
        if room.host_id == request.user.id or room.status != 'scheduled' or (room.ends_at and room.ends_at <= timezone.now()):
            raise ValidationError('This room is not accepting collaboration requests.')
        if room.rsvps.filter(user=request.user, status='removed').exists():
            raise PermissionDenied('The host removed your access to this room.')
        row, _ = RoomCollaborator.objects.get_or_create(room=room, user=request.user)
        if row.status == 'declined':
            raise PermissionDenied('The host declined your request.')
        return Response({'status': row.status})

    def patch(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk)
        if room.host_id != request.user.id:
            raise PermissionDenied('Only the host can manage collaborators.')
        user_id = request.data.get('user_id')
        if not isinstance(user_id, int) or request.data.get('status') not in ['approved', 'declined']:
            raise ValidationError('Choose a user and approved or declined status.')
        row = get_object_or_404(room.collaborations.exclude(user_id__in=blocked_ids(request.user)), user_id=user_id)
        if room.rsvps.filter(user_id=user_id, status='removed').exists() and request.data['status'] == 'approved':
            raise ValidationError('Restore this attendee before approving collaboration.')
        row.status = request.data['status']
        row.save(update_fields=['status'])
        return Response({'status': row.status})
