from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.community.models import Tag
from apps.community.services import mentors


class ProfileChoicesTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user('choices@example.com', 'strong-password')
        self.tag = Tag.objects.create(slug='python', label='Python')
        self.client = APIClient()
        self.client.force_login(self.user)

    def patch(self, data):
        return self.client.patch('/api/v1/profile/', data, format='json')

    def test_complete_onboarding_without_free_text_goal(self):
        response = self.patch({'academic_stage': '2nd year college', 'major': 'Computer science',
                               'purposes': ['build', 'discuss'], 'interests': [self.tag.id], 'onboarding_complete': True})
        self.assertEqual(response.status_code, 200, response.data)
        self.user.profile.refresh_from_db()
        self.assertEqual(self.user.profile.purposes, ['build', 'discuss'])
        self.assertEqual(self.user.profile.role, '2nd year college · Computer science')
        self.assertEqual(self.user.profile.goals, '')

    def test_conditional_role_and_validation(self):
        self.assertEqual(self.patch({'academic_stage': 'Graduate school', 'major': ''}).status_code, 400)
        self.assertEqual(self.patch({'academic_stage': 'Post grad', 'major': 'Computer science'}).status_code, 400)
        response = self.patch({'academic_stage': 'Post grad', 'profession': 'Research scientist', 'major': 'Computer science', 'purposes': ['learn', 'mentor', 'learn']})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['major'], '')
        self.assertEqual(response.data['role'], 'Research scientist')
        self.assertEqual(response.data['purposes'], ['learn', 'mentor'])
        self.assertEqual(response.data['intent'], 'both')
        self.assertEqual(self.patch({'purposes': []}).status_code, 400)
        self.assertEqual(self.patch({'purposes': ['invalid']}).status_code, 400)
        self.assertEqual(self.patch({'academic_stage': 'invalid'}).status_code, 400)
        self.assertEqual(self.patch({'profession': 'invalid'}).status_code, 400)

    def test_builders_are_not_filtered_to_mentors(self):
        other = User.objects.create_user('builder@example.com', 'strong-password')
        other.profile.purposes = ['build']
        other.profile.onboarding_complete = True
        other.profile.save()
        self.user.profile.purposes = ['build', 'discuss']
        self.user.profile.save()
        self.assertIn(other.profile, mentors(self.user))
        self.user.profile.purposes = ['learn']
        self.user.profile.save()
        self.assertNotIn(other.profile, mentors(self.user))
