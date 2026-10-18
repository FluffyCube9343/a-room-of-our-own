from io import BytesIO
from tempfile import TemporaryDirectory
from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.resources.models import Resource
from apps.safety.models import Block


class ResourcePhotoTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user('photo-owner@example.com', 'Photo!2026')
        self.other = User.objects.create_user('photo-reader@example.com', 'Photo!2026')
        self.client = APIClient()
        self.client.force_login(self.owner)
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        override = override_settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)
        self.fields = dict(title='A project board', description='Tested hardware.', category='electronics', sharing='loan', condition='Good', location='Rice Hall')

    def image(self, color='purple'):
        output = BytesIO()
        Image.new('RGB', (64, 48), color).save(output, format='PNG')
        return SimpleUploadedFile('board.png', output.getvalue(), content_type='image/png')

    def create(self):
        response = self.client.post('/api/v1/resources/', {**self.fields, 'image': self.image()}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_upload_normalizes_and_serves_only_to_allowed_members(self):
        resource = self.create()
        response = self.client.get(resource['photo_url'])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        with Image.open(BytesIO(b''.join(response.streaming_content))) as photo:
            self.assertEqual(photo.format, 'JPEG')
        response.close()
        self.client.force_login(self.other)
        response = self.client.get(resource['photo_url'])
        self.assertEqual(response.status_code, 200)
        response.close()
        Block.objects.create(blocker=self.owner, blocked=self.other)
        self.assertEqual(self.client.get(resource['photo_url']).status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get(resource['photo_url']).status_code, 403)

    def test_replace_remove_and_nonowner_permissions(self):
        resource = self.create()
        obj = Resource.objects.get(pk=resource['id'])
        old_name, storage = obj.image.name, obj.image.storage
        self.client.force_login(self.other)
        response = self.client.patch(f"/api/v1/resources/{obj.pk}/", {'image': self.image('red')}, format='multipart')
        self.assertEqual(response.status_code, 403)
        self.client.force_login(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(f"/api/v1/resources/{obj.pk}/", {'image': self.image('red')}, format='multipart')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(storage.exists(old_name))
        obj.refresh_from_db()
        replaced = obj.image.name
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(f"/api/v1/resources/{obj.pk}/", {'remove_photo': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['photo_url'])
        self.assertFalse(storage.exists(replaced))
        self.assertEqual(self.client.get(resource['photo_url']).status_code, 404)

    def test_invalid_and_oversized_uploads_fail_without_creating_listing(self):
        for upload in [SimpleUploadedFile('bad.jpg', b'not an image', content_type='image/jpeg'), SimpleUploadedFile('large.png', b'x' * (5 * 1024 * 1024 + 1), content_type='image/png')]:
            response = self.client.post('/api/v1/resources/', {**self.fields, 'image': upload}, format='multipart')
            self.assertEqual(response.status_code, 400, response.data)
            self.assertIn('image', response.data)
        self.assertEqual(Resource.objects.count(), 0)

    def test_photo_is_optional_and_conflicting_actions_are_rejected(self):
        response = self.client.post('/api/v1/resources/', self.fields, format='multipart')
        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data['photo_url'])
        response = self.client.patch(f"/api/v1/resources/{response.data['id']}/", {'image': self.image(), 'remove_photo': 'true'}, format='multipart')
        self.assertEqual(response.status_code, 400)
