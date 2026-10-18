from datetime import timedelta
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag
from apps.rooms.models import Room, RSVP, RoomCollaborator
from apps.safety.models import Block


class RoomFeaturesTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.host = User.objects.create_user('roomhost@example.com', 'strong-password')
        cls.member = User.objects.create_user('roommember@example.com', 'strong-password')
        cls.other = User.objects.create_user('roomother@example.com', 'strong-password')
        cls.tag = Tag.objects.create(label='Algorithms', slug='algorithms')
        for user in [cls.host, cls.member, cls.other]:
            user.profile.onboarding_complete = True
            user.profile.save()
        cls.room = Room.objects.create(host=cls.host, title='Algorithms together', description='Discuss algorithms', format='chatroom')
        cls.room.tags.add(cls.tag)

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.member)

    def call(self, method, path, data=None):
        return getattr(self.client, method)('/api/v1' + path, data=data, format='json')

    def test_session_locations_and_private_details(self):
        payload = {'title': 'A session', 'description': 'Discuss a topic together', 'tags': [self.tag.id],
                   'starts_at': (timezone.now() + timedelta(days=1)).isoformat(),
                   'ends_at': (timezone.now() + timedelta(days=1, hours=1)).isoformat()}
        self.assertEqual(self.call('post', '/rooms/', payload).status_code, 400)
        for location in [{'physical_location': 'Rice Hall 101'}, {'meeting_url': 'https://example.com/meet'},
                         {'physical_location': 'Rice Hall 101', 'meeting_url': 'https://example.com/meet'}]:
            response = self.call('post', '/rooms/', {**payload, **location})
            self.assertEqual(response.status_code, 201, response.data)
        pk = response.data['id']
        self.client.force_login(self.other)
        self.assertNotIn('physical_location', self.call('get', f'/rooms/{pk}/').data)
        self.call('put', f'/rooms/{pk}/rsvp/')
        self.assertEqual(self.call('get', f'/rooms/{pk}/').data['physical_location'], 'Rice Hall 101')
        self.assertNotIn('physical_location', self.call('get', '/rooms/').data['results'][0])
        self.call('delete', f'/rooms/{pk}/rsvp/')
        self.assertNotIn('physical_location', self.call('get', f'/rooms/{pk}/').data)

    def test_chat_creation_membership_and_messages(self):
        response = self.call('post', '/rooms/', {'title': 'CS chat', 'description': 'A topic discussion', 'format': 'chatroom', 'tags': [self.tag.id]})
        self.assertEqual(response.status_code, 201, response.data)
        self.assertIsNone(response.data['starts_at'])
        path = f'/rooms/{self.room.id}'
        self.assertEqual(self.call('get', path + '/messages/').status_code, 403)
        self.assertEqual(self.call('post', path + '/messages/', {'body': 'Hello'}).status_code, 403)
        self.assertEqual(self.call('put', path + '/rsvp/').status_code, 200)
        self.assertEqual(self.call('post', path + '/messages/', {'body': '  '}).status_code, 400)
        self.assertEqual(self.call('post', path + '/messages/', {'body': 'Hello algorithms'}).status_code, 201)
        self.assertEqual(self.call('get', path + '/messages/').data['count'], 1)
        self.client.force_login(self.host)
        self.call('patch', path + f'/attendees/{self.member.id}/', {'status': 'removed'})
        self.client.force_login(self.member)
        self.assertEqual(self.call('get', path + '/messages/').status_code, 403)
        self.assertEqual(self.call('put', path + '/rsvp/').status_code, 403)

    def test_approval_and_host_only_controls(self):
        path = f'/rooms/{self.room.id}/'
        self.assertEqual(self.call('patch', path, {'title': 'Updated'}).status_code, 403)
        self.assertEqual(self.call('post', path + 'collaborators/').data['status'], 'pending')
        self.assertEqual(self.call('patch', path + 'collaborators/', {'user_id': self.member.id, 'status': 'approved'}).status_code, 403)
        self.client.force_login(self.host)
        self.assertEqual(self.call('patch', path + 'collaborators/', {'user_id': self.member.id, 'status': 'approved'}).status_code, 200)
        self.client.force_login(self.member)
        self.assertEqual(self.call('patch', path, {'title': 'Updated'}).status_code, 200)
        self.assertEqual(self.call('patch', path, {'status': 'cancelled'}).status_code, 403)
        self.assertEqual(self.call('get', path + 'messages/').status_code, 200)
        self.assertEqual(self.call('get', '/rooms/?mine=1').data['count'], 1)
        self.client.force_login(self.host)
        self.call('patch', path + 'collaborators/', {'user_id': self.member.id, 'status': 'declined'})
        self.client.force_login(self.member)
        self.assertEqual(self.call('patch', path, {'title': 'Another update'}).status_code, 403)

    def test_search_similarity_and_privacy(self):
        self.assertEqual(self.call('get', '/rooms/?q=algorithms').data['count'], 1)
        self.assertEqual(self.call('get', '/rooms/?q=missing').data['count'], 0)
        self.assertEqual(self.call('get', '/rooms/?kind=chatroom').data['count'], 1)
        self.assertEqual(len(self.call('get', '/rooms/similar/?title=Algorithms').data['results']), 1)
        self.assertEqual(len(self.call('get', f'/rooms/similar/?tags={self.tag.id}').data['results']), 1)
        self.host.profile.skills.add(self.tag)
        self.assertEqual(self.call('get', '/discover/?q=algorithms').data['count'], 1)
        self.host.profile.discoverable = False
        self.host.profile.save()
        self.assertEqual(self.call('get', '/discover/?q=algorithms').data['count'], 0)
        Block.objects.create(blocker=self.member, blocked=self.host)
        self.assertEqual(self.call('get', '/rooms/?q=algorithms').data['count'], 0)
        self.assertEqual(self.call('get', '/rooms/similar/?title=Algorithms').data['results'], [])

    def test_personalized_ranking_and_filters(self):
        second_tag = Tag.objects.create(label='Security', slug='security')
        unrelated = Room.objects.create(host=self.host, title='Other topic', format='chatroom')
        self.member.profile.interests.add(second_tag)
        match = Room.objects.create(host=self.host, title='Security discussion', format='chatroom')
        match.tags.add(second_tag)
        results = self.call('get', '/rooms/').data['results']
        self.assertEqual(results[0]['id'], match.id)
        self.assertEqual(results[0]['matching_interests'], ['Security'])
        self.assertEqual(next(row for row in results if row['id'] == unrelated.id)['matching_interests'], [])
        self.assertEqual(self.call('get', '/rooms/?feed=all').data['results'][0]['id'], self.room.id)
        self.assertEqual(self.call('get', '/rooms/?topic=algorithms').data['count'], 1)
        self.assertEqual(self.call('get', '/rooms/?q=Security&kind=chatroom').data['results'][0]['id'], match.id)
        self.member.profile.interests.clear()
        self.assertEqual(self.call('get', '/rooms/').data['count'], 3)

    def test_closed_rooms_and_blocked_messages(self):
        RSVP.objects.create(room=self.room, user=self.member)
        self.room.messages.create(sender=self.other, body='Hello')
        Block.objects.create(blocker=self.member, blocked=self.other)
        path = f'/rooms/{self.room.id}/messages/'
        self.assertEqual(self.call('get', path).data['count'], 0)
        self.room.status = 'cancelled'
        self.room.save()
        self.assertEqual(self.call('post', path, {'body': 'Hello'}).status_code, 403)
        self.assertEqual(self.call('get', path).status_code, 403)
        self.assertEqual(self.call('post', f'/rooms/{self.room.id}/collaborators/').status_code, 400)
