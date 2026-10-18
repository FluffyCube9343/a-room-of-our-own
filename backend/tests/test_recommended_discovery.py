from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag
from apps.connections.models import Connection, DiscoveryPass
from apps.safety.models import Block


class RecommendedDiscoveryTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.viewer = cls.person('viewer')
        cls.interest = Tag.objects.create(slug='test-design', label='Design')
        cls.skill = Tag.objects.create(slug='test-python', label='Python')
        cls.viewer.profile.interests.add(cls.interest)
        cls.viewer.profile.learning.add(cls.skill)
        cls.shared = [cls.person(f'shared-{i}') for i in range(7)]
        for user in cls.shared:
            user.profile.interests.add(cls.interest)
        cls.teacher = cls.person('teacher')
        cls.teacher.profile.skills.add(cls.skill)
        cls.unrelated = cls.person('unrelated')

    @staticmethod
    def person(name):
        user = User.objects.create_user(f'{name}@example.com', 'Community!42')
        user.profile.display_name = name
        user.profile.onboarding_complete = True
        user.profile.intent = 'both'
        user.profile.save()
        return user

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_login(self.viewer)

    def test_ranked_shortlist_has_actual_common_ground(self):
        discover = self.client.get('/api/v1/discover/?feed=discover')
        recommended = self.client.get('/api/v1/discover/?feed=recommended')
        self.assertEqual(recommended.status_code, 200)
        self.assertEqual(recommended.data['count'], 6)
        self.assertEqual([p['id'] for p in recommended.data['results']], [u.id for u in self.shared[:6]])
        self.assertGreater(discover.data['count'], recommended.data['count'])

    def test_excludes_passes_connections_and_blocks(self):
        DiscoveryPass.objects.create(owner=self.viewer, member=self.shared[0])
        Connection.objects.create(sender=self.viewer, recipient=self.shared[1], target_kind='profile')
        Block.objects.create(blocker=self.viewer, blocked=self.shared[2])
        response = self.client.get('/api/v1/discover/?feed=recommended')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([p['id'] for p in response.data['results']], [u.id for u in self.shared[3:]] + [self.teacher.id])

    def test_empty_common_ground_and_invalid_feed(self):
        self.viewer.profile.interests.clear()
        self.viewer.profile.learning.clear()
        self.assertEqual(self.client.get('/api/v1/discover/?feed=recommended').data['count'], 0)
        self.assertEqual(self.client.get('/api/v1/discover/?feed=invalid').status_code, 400)
