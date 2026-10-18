from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag
from apps.projects.models import Project
from apps.resources.models import Resource
from apps.safety.models import Block


class ResourceProjectDiscoveryTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('finder@example.com', 'password')
        self.owner = User.objects.create_user('maker@example.com', 'password')
        self.client = APIClient()
        self.client.force_login(self.user)
        self.tag = Tag.objects.create(label='Python', slug='python')
        self.user.profile.interests.add(self.tag)
        self.board = Resource.objects.create(owner=self.owner, title='Raspberry Pi board', description='Python computing kit', category='computing', condition='Good', location='Library')
        self.tool = Resource.objects.create(owner=self.owner, title='Soldering iron', description='Electronics tool', category='tools', condition='Good', location='Engineering')

    def test_resource_search_ranking_filters_and_privacy(self):
        path = '/api/v1/resources/'
        data = self.client.get(path, {'feed': 'for-you'}).data['results']
        self.assertEqual(data[0]['id'], self.board.id)
        self.assertIn('Python', data[0]['recommendation_reason'])
        self.assertEqual(self.client.get(path, {'q': 'library python'}).data['count'], 1)
        self.assertEqual(self.client.get(path, {'q': 'python', 'category': 'tools'}).data['count'], 0)
        self.assertEqual(self.client.get(path, {'q': 'python', 'mine': '1'}).data['count'], 0)
        self.board.status = 'paused'
        self.board.save()
        self.assertEqual(self.client.get(path, {'q': 'python'}).data['count'], 0)
        Block.objects.create(blocker=self.user, blocked=self.owner)
        self.assertEqual(self.client.get(path, {'feed': 'for-you'}).data['count'], 0)

    def test_project_search_and_hardware_suggestions(self):
        hardware = Project.objects.create(owner=self.owner, title='Connected hardware garden', description='A Raspberry Pi sensor project', is_hardware=True)
        hardware.needed_skills.add(self.tag)
        software = Project.objects.create(owner=self.owner, title='Reading app', description='A book club website')
        self.assertEqual(self.client.get('/api/v1/projects/', {'q': 'garden python'}).data['count'], 1)
        self.assertEqual(self.client.get('/api/v1/projects/', {'q': 'missing'}).data['count'], 0)
        path = '/api/v1/resources/'
        rows = self.client.get(path, {'project': hardware.id}).data['results']
        self.assertEqual(rows[0]['id'], self.board.id)
        self.assertIn('raspberry', rows[0]['recommendation_reason'])
        self.assertEqual(self.client.get(path, {'project': software.id}).data['count'], 0)
        self.assertEqual(self.client.get(path, {'project': 'invalid'}).status_code, 400)
        self.board.status = 'given'
        self.board.save()
        self.assertNotIn(self.board.id, [r['id'] for r in self.client.get(path, {'project': hardware.id}).data['results']])
        Block.objects.create(blocker=self.user, blocked=self.owner)
        self.assertEqual(self.client.get(path, {'project': hardware.id}).status_code, 404)
        self.assertEqual(self.client.get('/api/v1/projects/', {'q': 'garden'}).data['count'], 0)
