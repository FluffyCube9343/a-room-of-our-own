from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.db.models import Q, Count, F
from django.middleware.csrf import get_token
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import generics, permissions, status
from rest_framework.exceptions import MethodNotAllowed, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from apps.accounts.models import User
from apps.community.models import Tag
from apps.rooms.models import RSVP
from apps.connections.models import SavedProfile
from apps.projects.models import ProjectInterest
from apps.safety.models import Block
from .serializers import (SignupSerializer, ProfileSerializer, TagSerializer, RoomSerializer,
                          ProjectSerializer, InterestSerializer, ReportSerializer, author)
from .services import visible_profiles, visible_rooms, visible_projects, mentors, recommendations, blocked_ids


def csrf_failure(request, reason=''):
    return JsonResponse({'detail': 'Your session changed. Please try again or refresh the page.'}, status=403)


def paginated(request, items, serializer=None, context=None):
    pager = PageNumberPagination()
    page = pager.paginate_queryset(items, request)
    data = serializer(page, many=True, context=context or {'request': request}).data if serializer else page
    return pager.get_paginated_response(data)


class CsrfView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'csrfToken': get_token(request)})


@method_decorator(csrf_protect, name='dispatch')
class AuthView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request, action):
        if action == 'logout':
            logout(request)
            return Response({'detail': 'Signed out.', 'csrfToken': get_token(request)})
        if action == 'signup':
            serializer = SignupSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            try:
                with transaction.atomic():
                    user = User.objects.create_user(data['email'], data['password'])
                    user.profile.display_name = data['display_name']
                    user.profile.save()
            except IntegrityError:
                raise ValidationError({'email': 'An account with this email already exists.'})
        elif action == 'login':
            email = request.data.get('email', '')
            password = request.data.get('password', '')
            if not isinstance(email, str) or not isinstance(password, str):
                raise ValidationError('Enter a valid email and password.')
            user = authenticate(request, email=email.strip().lower(), password=password)
            if not user:
                raise ValidationError('The email or password is incorrect.')
        else:
            raise ValidationError('Unknown authentication action.')
        login(request, user)
        return Response({'id': user.id, 'onboarding_complete': user.profile.onboarding_complete, 'csrfToken': get_token(request)})


class MeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'user': None})
        return Response({'user': {'id': request.user.id, 'email': request.user.email,
                         'profile': ProfileSerializer(request.user.profile, context={'request': request}).data}})


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_object(self):
        return self.request.user.profile


class TagsView(generics.ListAPIView):
    serializer_class = TagSerializer
    queryset = Tag.objects.all()


class HomeView(APIView):
    def get(self, request):
        room_id = request.query_params.get('room')
        tags = None
        if room_id:
            if not room_id.isdigit():
                raise ValidationError({'room': 'Use a numeric room ID.'})
            room = get_object_or_404(visible_rooms(request.user), pk=room_id)
            tags = list(room.tags.values_list('id', flat=True))
        rooms, people, projects = recommendations(request.user, tags)
        context = {'request': request}
        return Response({'rooms': RoomSerializer(rooms[:3], many=True, context=context).data,
                         'mentors': ProfileSerializer(people[:3], many=True, context=context).data,
                         'projects': ProjectSerializer(projects[:3], many=True, context=context).data})


class RoomList(generics.ListCreateAPIView):
    serializer_class = RoomSerializer

    def get_queryset(self):
        qs = visible_rooms(self.request.user)
        if self.request.query_params.get('mine') == '1':
            qs = qs.filter(Q(host=self.request.user) | Q(collaborations__user=self.request.user, collaborations__status='approved')).distinct()
        else:
            qs = qs.filter(Q(format='chatroom') | Q(starts_at__gt=timezone.now()), status='scheduled')
        text = self.request.query_params.get('q', '').strip()[:140]
        if text:
            qs = qs.filter(Q(title__icontains=text) | Q(description__icontains=text) | Q(tags__label__icontains=text) | Q(host__profile__display_name__icontains=text)).distinct()
        kind = self.request.query_params.get('kind')
        if kind:
            qs = qs.filter(format=kind)
        topic = self.request.query_params.get('topic')
        if topic:
            qs = qs.filter(tags__slug=topic)
        if self.request.query_params.get('mine') != '1' and self.request.query_params.get('feed', 'for-you') == 'for-you':
            interests = self.request.user.profile.interests.values_list('id', flat=True)
            qs = qs.annotate(interest_matches=Count('tags', filter=Q(tags__id__in=interests), distinct=True)).order_by(
                '-interest_matches', F('starts_at').asc(nulls_last=True), 'id')
        return qs

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)


class RoomDetail(generics.RetrieveUpdateAPIView):
    serializer_class = RoomSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return visible_rooms(self.request.user)

    def get_serializer_context(self):
        return {**super().get_serializer_context(), 'detail': True}

    def perform_update(self, serializer):
        room = serializer.instance
        if room.host_id != self.request.user.id:
            if not room.collaborations.filter(user=self.request.user, status='approved').exists():
                raise PermissionDenied('Only the host and approved collaborators can edit this room.')
            if 'status' in serializer.validated_data:
                raise PermissionDenied('Only the host can cancel or reopen this room.')
        serializer.save()


class RSVPView(APIView):
    @transaction.atomic
    def put(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user).select_for_update(of=("self",)), pk=pk)
        if room.host_id == request.user.id:
            raise ValidationError('You are already hosting this room.')
        if room.status != 'scheduled' or (room.format != 'chatroom' and room.starts_at <= timezone.now()):
            raise ValidationError('This room is no longer accepting RSVPs.')
        rsvp, _ = RSVP.objects.get_or_create(room=room, user=request.user)
        if rsvp.status == 'removed':
            raise PermissionDenied('The host has removed this RSVP.')
        rsvp.status = 'going'
        rsvp.save()
        return Response({'status': 'going'})

    def delete(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk)
        RSVP.objects.filter(room=room, user=request.user).exclude(status='removed').update(status='cancelled')
        return Response(status=status.HTTP_204_NO_CONTENT)


class AttendeesView(APIView):
    def room(self, request, pk):
        room = get_object_or_404(visible_rooms(request.user), pk=pk)
        if room.host_id != request.user.id:
            raise PermissionDenied('Only the host can manage attendees.')
        return room

    def get(self, request, pk, user_id=None):
        if user_id is not None:
            raise MethodNotAllowed('GET')
        room = self.room(request, pk)
        rows = room.rsvps.exclude(status='cancelled').exclude(user_id__in=blocked_ids(request.user)).select_related('user__profile')
        return paginated(request, [{'user': author(r.user), 'status': r.status} for r in rows])

    def patch(self, request, pk, user_id=None):
        if user_id is None:
            raise MethodNotAllowed('PATCH')
        room = self.room(request, pk)
        rsvp = get_object_or_404(room.rsvps.exclude(user_id__in=blocked_ids(request.user)), user_id=user_id)
        new_status = request.data.get('status')
        if new_status not in ['removed', 'cancelled']:
            raise ValidationError('Choose removed or cancelled (restore eligibility).')
        rsvp.status = new_status
        rsvp.save()
        if new_status == 'removed':
            room.collaborations.filter(user_id=user_id).update(status='declined')
        return Response({'status': rsvp.status})


class MentorList(APIView):
    def get(self, request):
        return paginated(request, mentors(request.user), ProfileSerializer)


class MemberDetail(generics.RetrieveAPIView):
    serializer_class = ProfileSerializer
    lookup_field = 'user_id'
    lookup_url_kwarg = 'pk'

    def get_queryset(self):
        return visible_profiles(self.request.user)


class SavedProfilesView(APIView):
    def get(self, request, pk=None):
        if pk is not None:
            raise MethodNotAllowed('GET')
        profiles = visible_profiles(request.user).filter(user__saved_by__owner=request.user).order_by('user_id')
        return paginated(request, profiles, ProfileSerializer)

    def put(self, request, pk=None):
        if pk is None:
            raise MethodNotAllowed('PUT')
        member = get_object_or_404(visible_profiles(request.user), user_id=pk)
        SavedProfile.objects.get_or_create(owner=request.user, member=member.user)
        return Response({'saved': True})

    def delete(self, request, pk=None):
        if pk is None:
            raise MethodNotAllowed('DELETE')
        SavedProfile.objects.filter(owner=request.user, member_id=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectList(generics.ListCreateAPIView):
    serializer_class = ProjectSerializer

    def get_queryset(self):
        qs = visible_projects(self.request.user)
        return qs.filter(owner=self.request.user) if self.request.query_params.get('mine') == '1' else qs.filter(status='open')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class ProjectDetail(generics.RetrieveUpdateAPIView):
    serializer_class = ProjectSerializer
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        return visible_projects(self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.owner_id != self.request.user.id:
            raise PermissionDenied('Only the owner can edit this project.')
        serializer.save()


class ProjectInterestView(APIView):
    @transaction.atomic
    def put(self, request, pk):
        project = get_object_or_404(visible_projects(request.user).select_for_update(of=("self",)), pk=pk)
        if project.owner_id == request.user.id:
            raise ValidationError('You already own this project.')
        if project.status != 'open':
            raise ValidationError('This project is closed to new requests.')
        serializer = InterestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ProjectInterest.objects.update_or_create(project=project, requester=request.user,
            defaults={'introduction': serializer.validated_data.get('introduction', ''), 'status': 'pending'})
        return Response({'status': 'pending'})

    def delete(self, request, pk):
        project = get_object_or_404(visible_projects(request.user), pk=pk)
        ProjectInterest.objects.filter(project=project, requester=request.user).update(status='withdrawn')
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectRequestsView(APIView):
    def get(self, request, pk):
        project = get_object_or_404(visible_projects(request.user), pk=pk)
        if project.owner_id != request.user.id:
            raise PermissionDenied('Only the project owner can view requests.')
        rows = project.requests.filter(status='pending').exclude(requester_id__in=blocked_ids(request.user)).select_related('requester__profile')
        return paginated(request, rows, InterestSerializer)


class ReportsView(APIView):
    def post(self, request):
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get('member'):
            get_object_or_404(visible_profiles(request.user), user=data['member'])
        elif data.get('room'):
            get_object_or_404(visible_rooms(request.user), pk=data['room'].pk)
        elif data.get('project'):
            get_object_or_404(visible_projects(request.user), pk=data['project'].pk)
        serializer.save(reporter=request.user)
        return Response({'detail': 'Your report was received. Our moderators can review it.'}, status=201)


class BlocksView(APIView):
    def get(self, request, pk=None):
        if pk is not None:
            raise MethodNotAllowed('GET')
        rows = Block.objects.filter(blocker=request.user).select_related('blocked__profile').order_by('-created_at')
        return paginated(request, [author(row.blocked) for row in rows])

    @transaction.atomic
    def put(self, request, pk=None):
        if pk is None:
            raise MethodNotAllowed('PUT')
        if pk == request.user.id:
            raise ValidationError('You cannot block yourself.')
        # A visible author can be blocked even when their full profile is hidden.
        member = get_object_or_404(User, pk=pk, is_active=True)
        Block.objects.get_or_create(blocker=request.user, blocked=member)
        SavedProfile.objects.filter(owner=request.user, member=member).delete()
        SavedProfile.objects.filter(owner=member, member=request.user).delete()
        RSVP.objects.filter(room__host=member, user=request.user, status='going').update(status='cancelled')
        RSVP.objects.filter(room__host=request.user, user=member, status='going').update(status='cancelled')
        ProjectInterest.objects.filter(project__owner=member, requester=request.user).update(status='withdrawn')
        ProjectInterest.objects.filter(project__owner=request.user, requester=member).update(status='withdrawn')
        from apps.connections.models import Connection
        from apps.resources.models import BorrowRequest
        from django.db.models import Q
        Connection.objects.filter(Q(sender=request.user, recipient=member) | Q(sender=member, recipient=request.user)).update(status='ended')
        BorrowRequest.objects.filter(Q(borrower=request.user, resource__owner=member) | Q(borrower=member, resource__owner=request.user), status='pending').update(status='cancelled')
        return Response({'blocked': True})

    def delete(self, request, pk=None):
        if pk is None:
            raise MethodNotAllowed('DELETE')
        Block.objects.filter(blocker=request.user, blocked_id=pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
