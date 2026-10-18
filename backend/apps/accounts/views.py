import warnings
from io import BytesIO
from uuid import uuid4
from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import User, Profile, ProfilePhoto
from .prompts import PROMPT_CHOICES
from apps.community.serializers import PhotoSerializer
from apps.community.services import visible_profiles


class AccountSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(max_length=254)

    class Meta:
        model = User
        fields = ['email']

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exclude(pk=self.instance.pk).exists():
            raise ValidationError('An account with this email already exists.')
        return value


class AccountDetail(APIView):
    def patch(self, request):
        serializer = AccountSerializer(request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            raise ValidationError({'email': 'An account with this email already exists.'})
        return Response(serializer.data)


class PromptOptions(APIView):
    def get(self, request):
        return Response({'results': [{'key': key, 'label': label} for key, label in PROMPT_CHOICES]})


class PhotoUpload(APIView):
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request):
        profile = Profile.objects.select_for_update().get(user=request.user)
        if profile.photos.count() >= 6:
            raise ValidationError('You can add up to six photos. Remove one to make space.')
        upload = request.FILES.get('image')
        if not upload or upload.size > 5 * 1024 * 1024:
            raise ValidationError({'image': 'Choose a JPEG, PNG, or WebP image under 5 MB.'})
        details = PhotoSerializer(data=request.data)
        details.is_valid(raise_exception=True)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(upload) as original:
                    if original.format not in ['JPEG', 'PNG', 'WEBP'] or original.width * original.height > 25_000_000:
                        raise ValueError('Unsupported format or dimensions')
                    # Decode/re-encode; discard EXIF/location metadata and any extra payload.
                    original.load()
                    normalized = ImageOps.exif_transpose(original)
                    normalized.thumbnail((1800, 1800))
                    rgba = normalized.convert('RGBA')
                    clean = Image.new('RGB', rgba.size, 'white')
                    clean.paste(rgba, mask=rgba.getchannel('A'))
                    output = BytesIO()
                    clean.save(output, format='JPEG', quality=88)
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
            raise ValidationError({'image': 'That image could not be read. Use a JPEG, PNG, or WebP up to 25 megapixels.'})
        photo = ProfilePhoto(profile=profile, caption=details.validated_data.get('caption', ''),
                             order=max([p.order for p in profile.photos.all()], default=-1) + 1)
        photo.image.save(f'{uuid4().hex}.jpg', ContentFile(output.getvalue()), save=False)
        try:
            photo.save()
        except Exception:
            photo.image.delete(save=False)
            raise
        return Response(PhotoSerializer(photo).data, status=201)


class PhotoDetail(APIView):
    def patch(self, request, pk):
        photo = get_object_or_404(ProfilePhoto, pk=pk, profile__user=request.user)
        serializer = PhotoSerializer(photo, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        get_object_or_404(ProfilePhoto, pk=pk, profile__user=request.user).delete()
        return Response(status=204)


class PhotoOrder(APIView):
    @transaction.atomic
    def put(self, request):
        profile = Profile.objects.select_for_update().get(user=request.user)
        field = serializers.ListField(child=serializers.IntegerField(min_value=1), max_length=6)
        ids = field.run_validation(request.data.get('ids'))
        photos = list(profile.photos.all())
        if len(ids) != len(photos) or set(ids) != {p.id for p in photos}:
            raise ValidationError('Include each of your photos exactly once.')
        for photo in photos:
            photo.order = ids.index(photo.id)
        ProfilePhoto.objects.bulk_update(photos, ['order'])
        return Response({'detail': 'Photo order saved.'})


class PhotoImage(APIView):
    def get(self, request, pk):
        photo = get_object_or_404(ProfilePhoto.objects.select_related('profile'), pk=pk)
        if photo.profile.user_id != request.user.id:
            get_object_or_404(visible_profiles(request.user), pk=photo.profile_id)
        try:
            response = FileResponse(photo.image.open('rb'), content_type='image/jpeg')
        except FileNotFoundError:
            from django.http import Http404
            raise Http404
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
