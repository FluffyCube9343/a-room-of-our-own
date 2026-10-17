from datetime import timedelta
from io import BytesIO
from tempfile import TemporaryDirectory
from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import User, ProfilePhoto, ProfilePrompt
from apps.connections.models import Connection, ConnectionMessage
from apps.resources.models import Resource, BorrowRequest
from apps.projects.models import Project


class CommunityExpansionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = User.objects.create_user('alice@example.com', 'Community!42')
        cls.bob = User.objects.create_user('bob@example.com', 'Community!42')
        cls.eve = User.objects.create_user('eve@example.com', 'Community!42')
        for user in [cls.alice, cls.bob, cls.eve]:
            user.profile.display_name = user.email.split('@')[0]
            user.profile.onboarding_complete = True
            user.profile.intent = 'both'
            user.profile.save()
        ProfilePrompt.objects.create(profile=cls.bob.profile, key='building', answer='An accessible campus map.')
        ProfilePrompt.objects.create(profile=cls.bob.profile, key='challenge', answer='Private draft.', visible=False)
        cls.resource = Resource.objects.create(owner=cls.bob, title='Arduino kit', description='A tested kit.', category='electronics', sharing='loan', condition='Good', location='Engineering quad')

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.alice)
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        override = override_settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)

    def req(self, method, path, data=None):
        return getattr(self.client, method)('/api/v1' + path, data=data, format='json')

    def upload(self, caption='My project'):
        content = BytesIO()
        Image.new('RGB', (48, 32), '#8b6681').save(content, format='PNG')
        return self.client.post('/api/v1/profile/photos/', {'image': SimpleUploadedFile('project.png', content.getvalue(), content_type='image/png'), 'caption': caption}, format='multipart')

    def like(self, **overrides):
        return self.req('post', '/connections/', {'member': self.bob.id, 'target_kind': 'prompt', 'prompt_key': 'building', 'note': 'I love this idea.', **overrides})

    def borrow(self, resource=None, **overrides):
        today = timezone.localdate()
        return self.req('post', f'/resources/{(resource or self.resource).id}/requests/', {
            'start_date': (today + timedelta(days=1)).isoformat(), 'end_date': (today + timedelta(days=3)).isoformat(),
            'note': 'For my prototype.', **overrides})

    def test_prompt_library_visibility_and_selection_limit(self):
        self.assertEqual(len(self.req('get', '/profile/prompt-options/').data['results']), 18)
        public = self.req('get', f'/members/{self.bob.id}/').data
        self.assertEqual([p['key'] for p in public['prompts']], ['building'])
        self.assertNotIn('Private draft.', str(public))
        self.client.force_login(self.bob)
        self.assertEqual(len(self.req('get', '/profile/').data['prompts']), 2)
        prompts = [{'key': key, 'answer': key, 'visible': True, 'order': i} for i, key in enumerate(['ask', 'wish', 'learn', 'building'])]
        self.assertEqual(self.req('patch', '/profile/', {'prompts': prompts}).status_code, 400)
        prompts[-1]['visible'] = False
        self.assertEqual(self.req('patch', '/profile/', {'prompts': prompts}).status_code, 200)

    def test_prompt_order_and_old_basics_edits_preserve_prompts(self):
        prompts = [{'key': 'building', 'answer': 'A', 'order': 2, 'visible': True}, {'key': 'reuse', 'answer': 'B', 'order': 0, 'visible': True}]
        self.assertEqual(self.req('patch', '/profile/', {'prompts': prompts}).status_code, 200)
        self.req('patch', '/profile/', {'display_name': 'Alice'})
        self.assertEqual([p['key'] for p in self.req('get', '/profile/').data['prompts']], ['reuse', 'building'])

    def test_professional_links_validate_domain_and_https(self):
        valid = {'resume_url': 'https://example.com/resume.pdf', 'linkedin_url': 'https://www.linkedin.com/in/alice', 'github_url': 'https://github.com/alice'}
        self.assertEqual(self.req('patch', '/profile/', valid).status_code, 200)
        for field, value in [('resume_url', 'javascript:alert(1)'), ('linkedin_url', 'https://linkedin.com.evil.com/alice'), ('github_url', 'http://github.com/alice')]:
            self.assertEqual(self.req('patch', '/profile/', {field: value}).status_code, 400)
        self.assertEqual(self.req('patch', '/profile/', {'github_url': ''}).status_code, 200)

    def test_photo_upload_caption_order_delete_and_limits(self):
        first = self.upload()
        self.assertEqual(first.status_code, 201)
        second = self.upload('Another project')
        first_id, second_id = first.data['id'], second.data['id']
        self.assertEqual(self.req('patch', f'/profile/photos/{first_id}/', {'caption': 'A changed caption'}).status_code, 200)
        self.assertEqual(self.req('put', '/profile/photos/order/', {'ids': [second_id, first_id]}).status_code, 200)
        self.assertEqual(self.req('get', '/profile/').data['photos'][0]['id'], second_id)
        self.assertEqual(self.req('put', '/profile/photos/order/', {'ids': [first_id, first_id]}).status_code, 400)
        image_response = self.client.get(first.data['url'])
        self.assertEqual(image_response.status_code, 200)
        self.assertEqual(image_response['Content-Type'], 'image/jpeg')
        self.assertEqual(image_response['Cache-Control'], 'private, no-store')
        image_response.close()
        for _ in range(4):
            self.assertEqual(self.upload().status_code, 201)
        self.assertEqual(self.upload().status_code, 400)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.req('delete', f'/profile/photos/{first_id}/').status_code, 204)
        self.assertEqual(self.client.get(first.data['url']).status_code, 404)

    def test_photo_rejects_non_images_and_oversized_uploads(self):
        for body in [b'<svg onload="alert(1)"></svg>', b'x' * (5*1024*1024+1)]:
            response = self.client.post('/api/v1/profile/photos/', {'image': SimpleUploadedFile('image.jpg', body, content_type='image/jpeg')}, format='multipart')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(ProfilePhoto.objects.count(), 0)

    def test_photo_access_respects_owner_hidden_profile_block_and_anonymous(self):
        photo = self.upload().data
        self.client.force_login(self.bob)
        response = self.client.get(photo['url'])
        self.assertEqual(response.status_code, 200)
        response.close()
        self.assertEqual(self.req('patch', f"/profile/photos/{photo['id']}/", {'caption': 'stolen'}).status_code, 404)
        self.assertEqual(self.req('delete', f"/profile/photos/{photo['id']}/").status_code, 404)
        self.alice.profile.discoverable = False
        self.alice.profile.save()
        self.assertEqual(self.client.get(photo['url']).status_code, 404)
        self.alice.profile.discoverable = True
        self.alice.profile.save()
        self.req('put', f'/blocks/{self.alice.id}/')
        self.assertEqual(self.client.get(photo['url']).status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get(photo['url']).status_code, 403)

    def test_like_accept_and_private_conversation(self):
        response = self.like()
        self.assertEqual(response.status_code, 201)
        pk = response.data['id']
        self.assertEqual(self.like().status_code, 200)
        self.assertEqual(Connection.objects.count(), 1)
        self.assertEqual(self.req('patch', f'/connections/{pk}/', {'action': 'accept'}).status_code, 403)
        self.assertEqual(self.req('post', f'/connections/{pk}/messages/', {'body': 'Too early'}).status_code, 404)
        self.client.force_login(self.bob)
        self.assertEqual(self.req('get', '/connections/?tab=incoming').data['count'], 1)
        self.assertEqual(self.req('patch', f'/connections/{pk}/', {'action': 'accept'}).status_code, 200)
        self.assertEqual(self.req('post', f'/connections/{pk}/messages/', {'body': 'Hello!'}).status_code, 201)
        self.client.force_login(self.eve)
        self.assertEqual(self.req('get', f'/connections/{pk}/').status_code, 404)
        self.assertEqual(self.req('get', f'/connections/{pk}/messages/').status_code, 404)
        self.client.force_login(self.alice)
        self.assertEqual(self.req('get', f'/connections/{pk}/messages/').data['results'][0]['body'], 'Hello!')
        self.assertEqual(self.req('patch', f'/connections/{pk}/', {'action': 'end'}).status_code, 200)
        self.assertEqual(self.req('post', f'/connections/{pk}/messages/', {'body': 'After ending'}).status_code, 404)

    def test_reverse_like_creates_mutual_connection(self):
        self.like()
        self.client.force_login(self.bob)
        response = self.req('post', '/connections/', {'member': self.alice.id, 'target_kind': 'profile'})
        self.assertEqual(response.data['status'], 'accepted')
        self.assertEqual(Connection.objects.count(), 1)

    def test_like_targets_must_belong_to_visible_recipient(self):
        self.assertEqual(self.like(prompt_key='challenge').status_code, 404)
        self.assertEqual(self.like(member=self.alice.id).status_code, 404)
        photo = self.upload().data
        self.assertEqual(self.like(target_kind='photo', photo=photo['id']).status_code, 404)
        self.assertEqual(self.like(note='x'*501).status_code, 400)

    def test_pass_reset_and_block_close_connections(self):
        self.req('put', f'/discover/passes/{self.bob.id}/')
        self.assertNotIn(self.bob.id, [p['id'] for p in self.req('get', '/discover/').data['results']])
        self.req('delete', '/discover/passes/')
        self.assertIn(self.bob.id, [p['id'] for p in self.req('get', '/discover/').data['results']])
        pk = self.like().data['id']
        self.assertNotIn(self.bob.id, [p['id'] for p in self.req('get', '/discover/').data['results']])
        self.req('put', f'/blocks/{self.bob.id}/')
        self.assertEqual(Connection.objects.get(pk=pk).status, 'ended')
        self.assertEqual(self.req('get', f'/connections/{pk}/').status_code, 404)

    def test_loan_request_approval_conflict_return_and_privacy(self):
        first = self.borrow()
        self.assertEqual(first.status_code, 201)
        self.assertEqual(self.borrow().status_code, 400)
        pk = first.data['id']
        self.assertEqual(self.req('patch', f'/borrow-requests/{pk}/', {'action': 'approve'}).status_code, 403)
        self.client.force_login(self.eve)
        second = self.borrow()
        second_id = second.data['id']
        self.assertEqual(self.req('get', '/borrow-requests/').data['count'], 1)
        self.assertEqual(self.req('patch', f'/borrow-requests/{pk}/', {'action': 'cancel'}).status_code, 404)
        self.client.force_login(self.bob)
        self.assertEqual(self.req('patch', f'/borrow-requests/{pk}/', {'action': 'approve', 'owner_note': 'Meet at the library.'}).status_code, 200)
        self.assertEqual(self.req('patch', f'/borrow-requests/{second_id}/', {'action': 'approve'}).status_code, 400)
        self.client.force_login(self.eve)
        self.assertNotIn('Meet at the library.', str(self.req('get', f'/resources/{self.resource.id}/').data))
        self.client.force_login(self.alice)
        self.assertEqual(self.req('get', '/borrow-requests/').data['results'][0]['owner_note'], 'Meet at the library.')
        self.assertEqual(self.req('patch', f'/borrow-requests/{pk}/', {'action': 'return'}).status_code, 403)
        self.client.force_login(self.bob)
        self.assertEqual(self.req('patch', f'/borrow-requests/{pk}/', {'action': 'return'}).status_code, 200)
        self.assertEqual(self.req('patch', f'/borrow-requests/{second_id}/', {'action': 'approve'}).status_code, 200)

    def test_borrowing_date_validation_ownership_and_closed_listing(self):
        past = (timezone.localdate() - timedelta(days=1)).isoformat()
        self.assertEqual(self.borrow(start_date=past).status_code, 400)
        self.assertEqual(self.borrow(end_date=past).status_code, 400)
        self.assertEqual(self.req('patch', f'/resources/{self.resource.id}/', {'title': 'Stolen'}).status_code, 403)
        project = Project.objects.create(owner=self.bob, title='Private idea', description='A project')
        self.assertEqual(self.borrow(project=project.id).status_code, 400)
        self.resource.status = 'paused'
        self.resource.save()
        self.assertEqual(self.borrow().status_code, 400)
        self.client.force_login(self.bob)
        self.assertEqual(self.borrow().status_code, 400)

    def test_giveaway_only_one_recipient_and_closes_after_collection(self):
        self.resource.sharing = 'give'
        self.resource.save()
        first = self.borrow().data['id']
        self.client.force_login(self.eve)
        second = self.borrow().data['id']
        self.client.force_login(self.bob)
        self.req('patch', f'/borrow-requests/{first}/', {'action': 'approve'})
        self.assertEqual(self.req('patch', f'/borrow-requests/{second}/', {'action': 'approve'}).status_code, 400)
        self.assertEqual(self.req('patch', f'/borrow-requests/{first}/', {'action': 'collect'}).status_code, 200)
        self.resource.refresh_from_db()
        self.assertEqual(self.resource.status, 'given')
        self.assertEqual(BorrowRequest.objects.get(pk=second).status, 'declined')

    def test_block_hides_resources_and_cancels_pending_requests(self):
        pk = self.borrow().data['id']
        self.req('put', f'/blocks/{self.bob.id}/')
        self.assertEqual(BorrowRequest.objects.get(pk=pk).status, 'cancelled')
        self.assertEqual(self.req('get', '/resources/').data['count'], 0)
        self.assertEqual(self.req('get', f'/resources/{self.resource.id}/').status_code, 404)
        self.assertEqual(self.req('get', '/borrow-requests/').data['count'], 0)
