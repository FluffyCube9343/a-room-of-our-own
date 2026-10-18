from io import BytesIO
from tempfile import TemporaryDirectory
from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag


class PostPhotoTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('photo-owner@example.com', 'Community!42')
        cls.viewer = User.objects.create_user('photo-viewer@example.com', 'Community!42')
        cls.tag = Tag.objects.create(label='Photo projects', slug='photo-projects')

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.owner)
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        override = override_settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)

    def image(self, color='blue'):
        output = BytesIO()
        Image.new('RGB', (100, 80), color).save(output, 'PNG')
        return SimpleUploadedFile('photo.png', output.getvalue(), content_type='image/png')

    def create_post(self, kind):
        data = {'title': 'A photo post', 'description': 'An example with a real uploaded photograph.', 'cover_image': self.image()}
        if kind == 'resources':
            data.update(category='tools', sharing='loan', condition='Good', location='Library')
        else:
            data.update(tags=[self.tag.id], needed_skills=[self.tag.id], is_hardware=False)
        response = self.client.post(f'/api/v1/{kind}/', data, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_resource_create_replace_preserve_clear_and_private_photo(self):
        self.check_photo_lifecycle('resources')

    def test_project_create_replace_preserve_clear_and_private_photo(self):
        self.check_photo_lifecycle('projects')

    def check_photo_lifecycle(self, kind):
        post = self.create_post(kind)
        path = f"/api/v1/{kind}/{post['id']}/"
        first = post['cover_url']
        response = self.client.get(first)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'image/jpeg')
        self.assertTrue(b''.join(response.streaming_content).startswith(b'\xff\xd8'))
        unchanged = self.client.patch(path, {'title': 'Updated title'}, format='json')
        self.assertEqual(unchanged.data['cover_url'], first)
        invalid = self.client.patch(path, {'cover_image': SimpleUploadedFile('fake.png', b'not an image', content_type='image/png')}, format='multipart')
        self.assertEqual(invalid.status_code, 400)
        replacement = self.client.patch(path, {'cover_image': self.image('green')}, format='multipart')
        self.assertEqual(replacement.status_code, 200, replacement.data)
        self.assertNotEqual(replacement.data['cover_url'], first)
        self.client.force_login(self.viewer)
        self.assertEqual(self.client.patch(path, {'cover_image': self.image()}, format='multipart').status_code, 403)
        response = self.client.get(replacement.data['cover_url'])
        self.assertEqual(response.status_code, 200)
        response.close()
        self.client.put(f'/api/v1/blocks/{self.owner.id}/')
        self.assertEqual(self.client.get(replacement.data['cover_url']).status_code, 404)
        self.client.force_login(self.owner)
        cleared = self.client.patch(path, {'cover_image': None}, format='json')
        self.assertEqual(cleared.status_code, 200, cleared.data)
        self.assertIsNone(cleared.data['cover_url'])
        self.assertEqual(self.client.get(first).status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get(first).status_code, 403)
