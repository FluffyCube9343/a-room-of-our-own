from datetime import timedelta
from io import StringIO
from django.core.cache import cache
from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag
from apps.rooms.models import Room, RSVP
from apps.projects.models import Project, ProjectInterest
from apps.connections.models import SavedProfile
from apps.safety.models import Block, Report

PREFIX = '/api/v1'


class CommunityTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = User.objects.create_user('host@example.com', 'SomethingUnique!42')
        cls.member = User.objects.create_user('member@example.com', 'SomethingUnique!42')
        cls.other = User.objects.create_user('other@example.com', 'SomethingUnique!42')
        cls.tag = Tag.objects.create(slug='python', label='Python')
        for user in [cls.owner, cls.member, cls.other]:
            p = user.profile
            p.onboarding_complete = True
            p.role = 'Student'
            p.goals = 'Learn with people'
            p.intent = 'both'
            p.save()
            p.interests.add(cls.tag)
            p.skills.add(cls.tag)
            p.learning.add(cls.tag)
        cls.room = Room.objects.create(host=cls.owner, title='A shared room', description='A helpful conversation.',
            starts_at=timezone.now() + timedelta(days=1), ends_at=timezone.now() + timedelta(days=1, hours=1),
            meeting_url='https://example.com/private-meeting')
        cls.room.tags.add(cls.tag)
        cls.project = Project.objects.create(owner=cls.owner, title='A shared idea', description='Build something helpful.')
        cls.project.tags.add(cls.tag)
        cls.project.needed_skills.add(cls.tag)

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.member)

    def request(self, method, path, data=None):
        return getattr(self.client, method)(PREFIX + path, data=data, format='json')

    def test_community_requires_authentication(self):
        self.client.logout()
        for path in ['/rooms/', '/projects/', '/mentors/', '/home/', '/profile/', '/blocks/']:
            self.assertEqual(self.request('get', path).status_code, 403, path)
        self.assertIsNone(self.request('get', '/auth/me/').data['user'])

    def test_csrf_required_for_login_signup_logout_and_writes(self):
        strict = APIClient(enforce_csrf_checks=True)
        for action in ['login', 'signup', 'logout']:
            self.assertEqual(strict.post(PREFIX + f'/auth/{action}/', {}, format='json').status_code, 403)
        token = strict.get(PREFIX + '/auth/csrf/').data['csrfToken']
        response = strict.post(PREFIX + '/auth/login/', {'email': 'MEMBER@example.com', 'password': 'SomethingUnique!42'}, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        fresh = response.data['csrfToken']
        self.assertNotEqual(token, fresh)
        path = PREFIX + f'/rooms/{self.room.id}/rsvp/'
        self.assertEqual(strict.put(path, {}, format='json').status_code, 403)
        self.assertEqual(strict.put(path, {}, format='json', HTTP_X_CSRFTOKEN=fresh).status_code, 200)
        self.assertEqual(strict.post(PREFIX + '/auth/logout/', {}, format='json').status_code, 403)
        self.assertEqual(strict.post(PREFIX + '/auth/logout/', {}, format='json', HTTP_X_CSRFTOKEN=fresh).status_code, 200)

    def test_signup_password_validation_and_case_insensitive_email(self):
        self.client.logout()
        payload = {'display_name': 'New Person', 'email': 'New@Example.com', 'password': '12345678'}
        self.assertEqual(self.request('post', '/auth/signup/', payload).status_code, 400)
        payload['password'] = 'CoffeeAndCode!42'
        response = self.request('post', '/auth/signup/', payload)
        self.assertEqual(response.status_code, 200)
        user = User.objects.get(email='new@example.com')
        self.assertTrue(user.check_password(payload['password']))
        self.assertEqual(user.profile.display_name, 'New Person')
        self.assertFalse(user.profile.onboarding_complete)
        self.assertEqual(self.request('post', '/auth/signup/', payload).status_code, 400)

    def test_profile_updates_are_owned_and_onboarding_is_validated(self):
        response = self.request('patch', '/profile/', {'id': self.owner.id, 'display_name': 'My name'})
        self.assertEqual(response.status_code, 200)
        self.member.profile.refresh_from_db()
        self.owner.profile.refresh_from_db()
        self.assertEqual(self.member.profile.display_name, 'My name')
        self.assertNotEqual(self.owner.profile.display_name, 'My name')
        self.assertEqual(self.request('patch', '/profile/', {'onboarding_complete': True, 'interests': []}).status_code, 400)
        self.assertEqual(self.request('patch', '/profile/', {'prompts': [{'key': 'ask', 'answer': 'A'}, {'key': 'ask', 'answer': 'B'}]}).status_code, 400)

    def test_ownership_enforced_and_client_cannot_set_owner(self):
        self.assertEqual(self.request('patch', f'/rooms/{self.room.id}/', {'title': 'Stolen'}).status_code, 403)
        self.assertEqual(self.request('patch', f'/projects/{self.project.id}/', {'title': 'Stolen'}).status_code, 403)
        response = self.request('post', '/projects/', {'owner': self.owner.id, 'title': 'Mine', 'description': 'My project', 'tags': [self.tag.id], 'needed_skills': [self.tag.id]})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Project.objects.get(pk=response.data['id']).owner_id, self.member.id)

    def test_meeting_link_only_in_authorized_detail(self):
        path = f'/rooms/{self.room.id}/'
        self.assertNotIn('meeting_url', self.request('get', path).data)
        self.assertNotIn('meeting_url', self.request('get', '/rooms/').data['results'][0])
        self.request('put', path + 'rsvp/')
        self.assertEqual(self.request('get', path).data['meeting_url'], self.room.meeting_url)
        self.assertNotIn('meeting_url', self.request('get', '/rooms/').data['results'][0])
        self.assertNotIn('meeting_url', self.request('get', '/home/').data['rooms'][0])
        self.request('delete', path + 'rsvp/')
        self.assertNotIn('meeting_url', self.request('get', path).data)
        self.client.force_login(self.owner)
        self.assertIn('meeting_url', self.request('get', path).data)

    def test_cancelled_and_ended_rooms_hide_links(self):
        RSVP.objects.create(room=self.room, user=self.member)
        self.room.status = 'cancelled'
        self.room.save()
        self.assertNotIn('meeting_url', self.request('get', f'/rooms/{self.room.id}/').data)
        self.room.status = 'scheduled'
        self.room.starts_at = timezone.now() - timedelta(hours=2)
        self.room.ends_at = timezone.now() - timedelta(hours=1)
        self.room.save()
        self.assertNotIn('meeting_url', self.request('get', f'/rooms/{self.room.id}/').data)

    def test_rsvp_idempotency_and_removed_attendee_cannot_restore_self(self):
        path = f'/rooms/{self.room.id}/rsvp/'
        for _ in range(2):
            self.assertEqual(self.request('put', path).status_code, 200)
        self.assertEqual(RSVP.objects.count(), 1)
        self.assertEqual(self.request('get', f'/rooms/{self.room.id}/attendees/').status_code, 403)
        self.assertEqual(self.request('patch', f'/rooms/{self.room.id}/attendees/{self.member.id}/', {'status': 'removed'}).status_code, 403)
        self.client.force_login(self.owner)
        response = self.request('patch', f'/rooms/{self.room.id}/attendees/{self.member.id}/', {'status': 'removed'})
        self.assertEqual(response.status_code, 200)
        self.client.force_login(self.member)
        self.assertNotIn('meeting_url', self.request('get', f'/rooms/{self.room.id}/').data)
        self.request('delete', path)
        self.assertEqual(self.request('put', path).status_code, 403)
        self.client.force_login(self.owner)
        self.request('patch', f'/rooms/{self.room.id}/attendees/{self.member.id}/', {'status': 'cancelled'})
        self.client.force_login(self.member)
        self.assertEqual(self.request('put', path).status_code, 200)

    def test_rsvp_rejects_cancelled_started_and_own_room(self):
        path = f'/rooms/{self.room.id}/rsvp/'
        self.client.force_login(self.owner)
        self.assertEqual(self.request('put', path).status_code, 400)
        self.client.force_login(self.member)
        self.room.status = 'cancelled'
        self.room.save()
        self.assertEqual(self.request('put', path).status_code, 400)
        self.room.status = 'scheduled'
        self.room.starts_at = timezone.now() - timedelta(minutes=10)
        self.room.save()
        self.assertEqual(self.request('put', path).status_code, 400)

    def test_project_request_persistence_idempotency_and_privacy(self):
        path = f'/projects/{self.project.id}/interest/'
        for _ in range(2):
            self.assertEqual(self.request('put', path, {'introduction': 'I can help!'}).status_code, 200)
        self.assertEqual(ProjectInterest.objects.count(), 1)
        self.assertEqual(self.request('get', f'/projects/{self.project.id}/interests/').status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.request('put', path).status_code, 400)
        response = self.request('get', f'/projects/{self.project.id}/interests/')
        self.assertEqual(response.data['results'][0]['introduction'], 'I can help!')
        self.client.force_login(self.other)
        self.assertNotIn('requests', self.request('get', f'/projects/{self.project.id}/').data)
        self.client.force_login(self.member)
        self.request('delete', path)
        self.assertEqual(ProjectInterest.objects.get().status, 'withdrawn')
        self.project.status = 'closed'
        self.project.save()
        self.assertEqual(self.request('put', path).status_code, 400)

    def test_save_is_private_idempotent_and_not_a_match(self):
        path = f'/saved-profiles/{self.owner.id}/'
        for _ in range(2):
            self.assertEqual(self.request('put', path).status_code, 200)
        self.assertEqual(SavedProfile.objects.count(), 1)
        self.assertEqual(self.request('get', '/saved-profiles/').data['count'], 1)
        self.client.force_login(self.owner)
        self.assertEqual(self.request('get', '/saved-profiles/').data['count'], 0)
        self.client.force_login(self.member)
        self.request('delete', path)
        self.assertEqual(SavedProfile.objects.count(), 0)
        self.assertEqual(self.request('put', f'/saved-profiles/{self.member.id}/').status_code, 404)

    def test_block_filters_both_directions_and_direct_ids(self):
        self.request('put', f'/rooms/{self.room.id}/rsvp/')
        self.request('put', f'/projects/{self.project.id}/interest/')
        self.request('put', f'/saved-profiles/{self.owner.id}/')
        self.assertEqual(self.request('put', f'/blocks/{self.owner.id}/').status_code, 200)
        self.assertEqual(RSVP.objects.get().status, 'cancelled')
        self.assertEqual(ProjectInterest.objects.get().status, 'withdrawn')
        self.assertEqual(SavedProfile.objects.count(), 0)
        for path in [f'/members/{self.owner.id}/', f'/rooms/{self.room.id}/', f'/projects/{self.project.id}/']:
            self.assertEqual(self.request('get', path).status_code, 404)
        for path in [f'/rooms/{self.room.id}/rsvp/', f'/projects/{self.project.id}/interest/', f'/saved-profiles/{self.owner.id}/']:
            self.assertEqual(self.request('put', path).status_code, 404)
        self.assertEqual(self.request('get', '/rooms/').data['count'], 0)
        self.assertEqual(self.request('get', '/projects/').data['count'], 0)
        self.assertNotIn(self.owner.id, [p['id'] for p in self.request('get', '/mentors/').data['results']])
        self.client.force_login(self.owner)
        self.assertEqual(self.request('get', f'/members/{self.member.id}/').status_code, 404)
        self.client.force_login(self.member)
        self.request('delete', f'/blocks/{self.owner.id}/')
        self.assertEqual(self.request('get', f'/rooms/{self.room.id}/').status_code, 200)
        self.assertNotIn('meeting_url', self.request('get', f'/rooms/{self.room.id}/').data)

    def test_hidden_profile_stays_out_of_discovery_without_hiding_authorship(self):
        self.owner.profile.discoverable = False
        self.owner.profile.save()
        self.assertEqual(self.request('get', f'/members/{self.owner.id}/').status_code, 404)
        response = self.request('get', f'/rooms/{self.room.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('email', response.data['host'])
        self.assertNotIn(self.owner.id, [p['id'] for p in self.request('get', '/mentors/').data['results']])

    def test_report_validation_privacy_and_database_constraint(self):
        response = self.request('post', '/reports/', {'room': self.room.id, 'category': 'spam', 'details': 'Please review.'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(response.data), ['detail'])
        self.assertEqual(Report.objects.get().reporter, self.member)
        self.assertEqual(self.request('get', '/reports/').status_code, 405)
        self.assertEqual(self.request('post', '/reports/', {'category': 'spam'}).status_code, 400)
        self.assertEqual(self.request('post', '/reports/', {'member': self.owner.id, 'room': self.room.id, 'category': 'spam'}).status_code, 400)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Report.objects.create(reporter=self.member, category='spam')

    def test_recommendations_explain_real_overlap_and_respect_intent(self):
        self.member.profile.intent = 'learn'
        self.member.profile.save()
        self.other.profile.intent = 'learn'
        self.other.profile.save()
        data = self.request('get', '/mentors/').data['results']
        self.assertEqual([row['id'] for row in data], [self.owner.id])
        self.assertIn('You both care about Python', data[0]['reasons'])
        self.assertIn('They can help with Python', data[0]['reasons'])
        self.assertNotIn('email', data[0])
        self.owner.profile.interests.clear()
        self.owner.profile.skills.clear()
        self.assertEqual(self.request('get', '/mentors/').data['results'][0]['reasons'], ['Explore someone new'])

    def test_url_and_date_validation(self):
        self.client.force_login(self.owner)
        path = f'/rooms/{self.room.id}/'
        self.assertEqual(self.request('patch', path, {'meeting_url': 'http://example.com'}).status_code, 400)
        self.assertEqual(self.request('patch', path, {'ends_at': (self.room.starts_at - timedelta(hours=1)).isoformat()}).status_code, 400)
        self.assertEqual(self.request('patch', path, {'starts_at': (timezone.now() - timedelta(days=1)).isoformat()}).status_code, 400)
        self.assertEqual(self.request('patch', f'/projects/{self.project.id}/', {'repository_url': 'javascript:alert(1)'}).status_code, 400)

    def test_unsupported_route_shapes_return_errors_not_server_failures(self):
        for path in ['/blocks/', '/saved-profiles/']:
            self.assertEqual(self.request('put', path).status_code, 405)
            self.assertEqual(self.request('delete', path).status_code, 405)
            self.assertEqual(self.request('get', path + f'{self.owner.id}/').status_code, 405)
        self.assertEqual(self.request('patch', f'/rooms/{self.room.id}/attendees/').status_code, 405)
        self.assertEqual(self.request('get', f'/rooms/{self.room.id}/attendees/{self.member.id}/').status_code, 405)
        self.assertEqual(self.request('get', '/home/?room=invalid').status_code, 400)

    @override_settings(DEBUG=True)
    def test_seed_is_repeatable(self):
        call_command('seed_demo', stdout=StringIO())
        counts = (User.objects.count(), Room.objects.count(), Project.objects.count())
        call_command('seed_demo', stdout=StringIO())
        self.assertEqual(counts, (User.objects.count(), Room.objects.count(), Project.objects.count()))
        self.assertTrue(User.objects.get(email='maya@room.demo').check_password('RoomDemo!2026'))
