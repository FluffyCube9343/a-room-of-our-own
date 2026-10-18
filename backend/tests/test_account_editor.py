from io import BytesIO
from tempfile import TemporaryDirectory

from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.community.serializers import author


class AccountEditorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('owner@example.com', 'Community!42')
        cls.other = User.objects.create_user('other@example.com', 'Community!42')

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.owner)

    def update_email(self, email):
        return self.client.patch('/api/v1/account/', {'email': email}, format='json')

    def test_email_update_is_normalized_preserves_session_and_changes_login(self):
        response = self.update_email('  Updated@Example.com  ')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'email': 'updated@example.com'})
        self.assertEqual(self.client.get('/api/v1/auth/me/').data['user']['email'], 'updated@example.com')
        self.other.refresh_from_db()
        self.assertEqual(self.other.email, 'other@example.com')
        self.client.logout()
        self.assertFalse(self.client.login(email='owner@example.com', password='Community!42'))
        self.assertTrue(self.client.login(email='updated@example.com', password='Community!42'))

    def test_invalid_duplicate_and_empty_email_do_not_change_account(self):
        for email in ['not-an-email', '', 'OTHER@EXAMPLE.COM']:
            response = self.update_email(email)
            self.assertEqual(response.status_code, 400)
            self.assertIn('email', response.data)
        self.assertEqual(self.client.patch('/api/v1/account/', {}, format='json').status_code, 400)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.email, 'owner@example.com')

    def test_account_update_requires_authentication(self):
        self.client.logout()
        self.assertEqual(self.update_email('updated@example.com').status_code, 403)

    def test_avatar_uses_first_photo_and_follows_explicit_reordering(self):
        self.assertIsNone(self.client.get('/api/v1/profile/').data['avatar_url'])
        with TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            def upload(name):
                content = BytesIO()
                Image.new('RGB', (32, 32), 'white').save(content, 'PNG')
                response = self.client.post('/api/v1/profile/photos/', {
                    'image': SimpleUploadedFile(name, content.getvalue(), content_type='image/png'),
                }, format='multipart')
                self.assertEqual(response.status_code, 201)
                return response.data['id']

            first, newest = upload('first.png'), upload('newest.png')
            self.assertEqual(author(self.owner)['avatar_url'], f'/api/v1/profile/photos/{first}/image/')
            self.assertEqual(self.client.get('/api/v1/profile/').data['avatar_url'], f'/api/v1/profile/photos/{first}/image/')
            self.client.put('/api/v1/profile/photos/order/', {'ids': [newest, first]}, format='json')
            self.assertEqual(self.client.get('/api/v1/profile/').data['avatar_url'], f'/api/v1/profile/photos/{newest}/image/')
            self.client.put('/api/v1/profile/photos/order/', {'ids': [first, newest]}, format='json')
            self.assertEqual(self.client.get('/api/v1/profile/').data['avatar_url'], f'/api/v1/profile/photos/{first}/image/')
            self.client.delete(f'/api/v1/profile/photos/{newest}/')
            self.assertEqual(self.client.get('/api/v1/profile/').data['avatar_url'], f'/api/v1/profile/photos/{first}/image/')
            self.client.delete(f'/api/v1/profile/photos/{first}/')
            self.assertIsNone(self.client.get('/api/v1/profile/').data['avatar_url'])
            self.assertIsNone(author(self.owner)['avatar_url'])
