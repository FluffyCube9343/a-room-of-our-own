from django.db import connection, transaction, IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.http import FileResponse, Http404
from django.utils import timezone
from rest_framework import generics, serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.community.services import blocked_ids, visible_projects
from .recommendations import interest_matches, hardware_project, project_match
from apps.community.serializers import author
from apps.community.views import paginated
from apps.projects.models import Project
from .models import Resource, BorrowRequest, BorrowEvent


def log_event(resource, actor, event_type):
    BorrowEvent.objects.create(resource=resource, actor=actor, event_type=event_type)


def resources_for(user):
    return Resource.objects.filter(owner__is_active=True).exclude(owner_id__in=blocked_ids(user)).select_related('owner__profile')


def requests_for(user):
    return BorrowRequest.objects.filter(Q(borrower=user) | Q(resource__owner=user)).exclude(
        borrower_id__in=blocked_ids(user)).exclude(resource__owner_id__in=blocked_ids(user)).filter(
        borrower__is_active=True, resource__owner__is_active=True).select_related('resource__owner__profile', 'borrower__profile', 'project')


class ResourceSerializer(serializers.ModelSerializer):
    cover_image = serializers.ImageField(write_only=True, required=False, allow_null=True)
    cover_url = serializers.SerializerMethodField()
    recommendation_reason = serializers.CharField(read_only=True, default='')
    owner = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    reservations = serializers.SerializerMethodField()
    my_request = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = ['id', 'owner', 'is_owner', 'title', 'description', 'category', 'sharing', 'condition', 'location', 'status', 'reservations', 'my_request', 'recommendation_reason', 'cover_image', 'cover_url']

    def validate_cover_image(self, value):
        from apps.rooms.images import clean_cover
        return clean_cover(value)

    def get_cover_url(self, obj):
        return f'/api/v1/resources/{obj.id}/photo/?v={obj.cover_image.name.rsplit("/", 1)[-1]}' if obj.cover_image else None

    def get_owner(self, obj):
        return author(obj.owner)

    def get_is_owner(self, obj):
        return obj.owner_id == self.context['request'].user.id

    def get_reservations(self, obj):
        return list(obj.requests.filter(status='approved').values('start_date', 'end_date'))

    def get_my_request(self, obj):
        row = obj.requests.filter(borrower=self.context['request'].user, status__in=['pending', 'approved']).first()
        return {'id': row.id, 'status': row.status} if row else None

    def validate(self, data):
        if self.instance:
            has_requests = self.instance.requests.filter(status__in=['pending', 'approved']).exists()
            if has_requests and data.get('sharing', self.instance.sharing) != self.instance.sharing:
                raise ValidationError('Resolve active requests before changing how this item is shared.')
            if data.get('status') == 'given':
                raise ValidationError('Mark a giveaway collected through its approved request.')
        elif data.get('status') == 'given':
            raise ValidationError('New listings cannot already be given away.')
        return data


class ResourceList(generics.ListCreateAPIView):
    serializer_class = ResourceSerializer

    def get_queryset(self):
        qs = resources_for(self.request.user)
        if self.request.query_params.get('mine') == '1':
            qs = qs.filter(owner=self.request.user)
        else:
            qs = qs.filter(status='available')
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        query = self.request.query_params.get('q', '').strip()[:200]
        for term in query.split():
            qs = qs.filter(Q(title__icontains=term) | Q(description__icontains=term) | Q(category__icontains=term) | Q(location__icontains=term))
        project_id = self.request.query_params.get('project')
        if project_id:
            if not project_id.isdigit():
                raise ValidationError('Choose a valid project.')
            project = get_object_or_404(visible_projects(self.request.user), pk=project_id)
            if not hardware_project(project):
                return qs.none()
            ranked = []
            for item in qs.filter(status='available'):
                score, item.recommendation_reason = project_match(item, project)
                if score:
                    ranked.append((score, item))
            return [item for _, item in sorted(ranked, key=lambda pair: (-pair[0], -pair[1].id))][:6]
        if self.request.query_params.get('feed') == 'for-you':
            tags = list(self.request.user.profile.interests.all())
            ranked = []
            for item in qs:
                matches = interest_matches(item, tags)
                item.recommendation_reason = 'For your ' + ' & '.join(matches) + ' interests' if matches else ''
                ranked.append((len(matches), item))
            return [item for _, item in sorted(ranked, key=lambda pair: (-pair[0], -pair[1].id))]
        return qs

    def perform_create(self, serializer):
        resource = serializer.save(owner=self.request.user)
        log_event(resource, self.request.user, 'listed')


class ResourceDetail(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ResourceSerializer
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return resources_for(self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.owner_id != self.request.user.id:
            raise PermissionDenied('Only the owner can edit this resource.')
        if serializer.instance.status == 'given':
            raise ValidationError('This item has already been given away.')
        serializer.save()

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        resource = get_object_or_404(self.get_queryset().select_for_update(of=('self',)), pk=kwargs['pk'])
        if resource.owner_id != request.user.id:
            raise PermissionDenied('Only the owner can remove this listing.')
        if resource.requests.filter(status='approved').exists():
            raise ValidationError('Resolve approved reservations in Manage requests before removing this listing.')
        photo_storage, photo_name = resource.cover_image.storage, resource.cover_image.name
        resource.delete()
        if photo_name:
            transaction.on_commit(lambda: photo_storage.delete(photo_name))
        return Response(status=204)


class ResourcePhoto(APIView):
    def get(self, request, pk):
        resource = get_object_or_404(resources_for(request.user), pk=pk)
        if not resource.cover_image:
            raise Http404
        try:
            response = FileResponse(resource.cover_image.open('rb'), content_type='image/jpeg')
        except FileNotFoundError:
            raise Http404
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class BorrowSerializer(serializers.ModelSerializer):
    resource = ResourceSerializer(read_only=True)
    borrower = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title', read_only=True, default=None)

    class Meta:
        model = BorrowRequest
        fields = ['id', 'resource', 'borrower', 'project', 'project_title', 'is_owner', 'start_date', 'end_date', 'note', 'owner_note', 'status', 'created_at']
        read_only_fields = ['id', 'owner_note', 'status', 'created_at']

    def get_borrower(self, obj):
        return author(obj.borrower)

    def get_is_owner(self, obj):
        return obj.resource.owner_id == self.context['request'].user.id

    def validate(self, data):
        if data['end_date'] < data['start_date'] or data['start_date'] < timezone.localdate():
            raise ValidationError('Choose today or a future start date, with the end on or after the start.')
        if data.get('project') and data['project'].owner_id != self.context['request'].user.id:
            raise ValidationError('Choose one of your own projects.')
        return data


class BorrowCreate(APIView):
    @transaction.atomic
    def post(self, request, pk):
        resource = get_object_or_404(resources_for(request.user).select_for_update(of=("self",)), pk=pk)
        if resource.owner_id == request.user.id or resource.status != 'available':
            raise ValidationError('This item is not available for you to request.')
        serializer = BorrowSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        if resource.requests.filter(borrower=request.user, status__in=['pending', 'approved']).exists():
            raise ValidationError('You already have an active request for this item.')
        try:
            with transaction.atomic():
                serializer.save(resource=resource, borrower=request.user)
        except IntegrityError:
            raise ValidationError('You already have an active request for this item.')
        log_event(resource, request.user, 'requested')
        return Response(serializer.data, status=201)


class BorrowList(APIView):
    def get(self, request):
        return paginated(request, requests_for(request.user), BorrowSerializer)


class BorrowUpdate(APIView):
    @transaction.atomic
    def patch(self, request, pk):
        # Lock the resource first so simultaneous approvals share a lock.
        existing = get_object_or_404(requests_for(request.user), pk=pk)
        resource = Resource.objects.select_for_update().get(pk=existing.resource_id)
        row = BorrowRequest.objects.select_for_update().get(pk=pk)
        action = request.data.get('action')
        is_owner = resource.owner_id == request.user.id
        if action == 'cancel':
            if not ((row.borrower_id == request.user.id and row.status == 'pending') or (is_owner and row.status == 'approved')):
                raise ValidationError('A borrower can cancel a pending request; an owner can cancel a reservation.')
            row.status = 'cancelled'
        else:
            if not is_owner:
                raise PermissionDenied('Only the owner can manage this request.')
            if action == 'approve' and row.status == 'pending':
                if resource.status != 'available' or row.end_date < timezone.localdate():
                    raise ValidationError('This item or these dates are no longer available.')
                conflicts = resource.requests.filter(status='approved')
                if resource.sharing == 'loan':
                    conflicts = conflicts.filter(start_date__lte=row.end_date, end_date__gte=row.start_date)
                if conflicts.exists():
                    raise ValidationError('This item is already reserved for those dates.')
                row.status = 'approved'
                log_event(resource, request.user, 'approved')
            elif action == 'decline' and row.status == 'pending':
                row.status = 'declined'
            elif action == 'return' and row.status == 'approved' and resource.sharing == 'loan':
                row.status = 'returned'
                log_event(resource, request.user, 'returned')
            elif action == 'collect' and row.status == 'approved' and resource.sharing == 'give':
                row.status = 'collected'
                log_event(resource, request.user, 'collected')
                resource.status = 'given'
                resource.save(update_fields=['status'])
                resource.requests.filter(status='pending').exclude(pk=row.pk).update(status='declined')
            else:
                raise ValidationError('This request cannot make that transition.')
            if 'owner_note' in request.data:
                row.owner_note = serializers.CharField(max_length=1000, allow_blank=True).run_validation(request.data['owner_note'])
        row.save()
        return Response(BorrowSerializer(row, context={'request': request}).data)


class ImpactView(APIView):
    def get(self, request):
        from django.db.models import Count
        counts = {key: 0 for key, _ in BorrowEvent.EVENTS}
        for row in BorrowEvent.objects.values('event_type').annotate(n=Count('id')):
            counts[row['event_type']] = row['n']
        weekly = []
        live_rollup = False
        try:
            # The continuous aggregate only exists on Tiger Data; skip quietly elsewhere.
            with connection.cursor() as cur:
                cur.execute("""
                    SELECT day::date, event_type, events
                    FROM resources_borrowevent_daily
                    WHERE day >= now() - INTERVAL '7 days'
                    ORDER BY day
                """)
                weekly = [{'day': str(day), 'event_type': kind, 'events': n} for day, kind, n in cur.fetchall()]
            live_rollup = True
        except Exception:
            pass
        return Response({
            'parts_shared': counts['listed'],
            'parts_reused': counts['returned'] + counts['collected'],
            'active_loans': counts['approved'] - counts['returned'],
            'weekly': weekly,
            'live_rollup': live_rollup,
        })
